import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { auth } from "@/lib/auth";
import { encryptMailToken } from "@/lib/mail-token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type MailProvider = "google" | "microsoft";

type OAuthState = {
  provider: MailProvider;
  userId: string;
  nonce: string;
  expiresAt: number;
};

type ProviderTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export async function authenticatedUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) throw new Error("Sign in before connecting a mailbox.");
  return session.user.id;
}

export function createOAuthState(provider: MailProvider, userId: string) {
  const state: OAuthState = {
    provider,
    userId,
    nonce: randomBytes(16).toString("hex"),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const payload = base64Url(JSON.stringify(state));
  const signature = createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(value: string): OAuthState {
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) throw new Error("The mailbox connection has invalid state.");
  const expectedSignature = createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload).digest();
  const receivedSignature = Buffer.from(suppliedSignature, "base64url");
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
    throw new Error("The mailbox connection has invalid state.");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  if (state.expiresAt < Date.now()) throw new Error("The mailbox connection expired. Please try again.");
  if (state.provider !== "google" && state.provider !== "microsoft") throw new Error("Unknown mailbox provider.");
  return state;
}

export function authorizationUrl(provider: MailProvider, state: string) {
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: required("GOOGLE_MAIL_CLIENT_ID"),
      redirect_uri: `${appUrl}/api/mail/callback/google`,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "openid email https://www.googleapis.com/auth/gmail.send",
      state,
    }).toString();
    return url.toString();
  }
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.search = new URLSearchParams({
    client_id: required("MICROSOFT_MAIL_CLIENT_ID"),
    redirect_uri: `${appUrl}/api/mail/callback/microsoft`,
    response_type: "code",
    response_mode: "query",
    scope: "openid email profile offline_access User.Read Mail.Send",
    state,
  }).toString();
  return url.toString();
}

export async function exchangeAuthorizationCode(provider: MailProvider, code: string) {
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const isGoogle = provider === "google";
  const response = await fetch(isGoogle
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required(isGoogle ? "GOOGLE_MAIL_CLIENT_ID" : "MICROSOFT_MAIL_CLIENT_ID"),
      client_secret: required(isGoogle ? "GOOGLE_MAIL_CLIENT_SECRET" : "MICROSOFT_MAIL_CLIENT_SECRET"),
      redirect_uri: `${appUrl}/api/mail/callback/${provider}`,
      grant_type: "authorization_code",
      code,
      ...(isGoogle ? {} : { scope: "openid email profile offline_access User.Read Mail.Send" }),
    }),
  });
  const tokens = await response.json() as ProviderTokens & { error_description?: string };
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || "The provider did not issue mailbox tokens.");
  return tokens;
}

export async function providerMailbox(provider: MailProvider, accessToken: string) {
  const response = await fetch(provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await response.json() as { sub?: string; id?: string; email?: string; mail?: string; userPrincipalName?: string; name?: string; displayName?: string };
  const email = profile.email || profile.mail || profile.userPrincipalName;
  if (!response.ok || !email) throw new Error("The provider did not return a mailbox address.");
  return {
    providerAccountId: profile.sub || profile.id || email,
    email,
    displayName: profile.name || profile.displayName || email,
  };
}

export async function persistMailboxConnection(userId: string, provider: MailProvider, tokens: ProviderTokens) {
  const mailbox = await providerMailbox(provider, tokens.access_token);
  const accessToken = encryptMailToken(tokens.access_token);
  const refreshToken = tokens.refresh_token ? encryptMailToken(tokens.refresh_token) : undefined;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("prexet_mailbox_connections")
    .select("encrypted_refresh_token,refresh_token_iv,refresh_token_tag")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("email", mailbox.email)
    .maybeSingle();
  const { error } = await supabase
    .from("prexet_mailbox_connections")
    .upsert({
      user_id: userId,
      provider,
      provider_account_id: mailbox.providerAccountId,
      email: mailbox.email,
      display_name: mailbox.displayName,
      encrypted_access_token: accessToken.ciphertext,
      access_token_iv: accessToken.iv,
      access_token_tag: accessToken.tag,
      encrypted_refresh_token: refreshToken?.ciphertext || existing?.encrypted_refresh_token || null,
      refresh_token_iv: refreshToken?.iv || existing?.refresh_token_iv || null,
      refresh_token_tag: refreshToken?.tag || existing?.refresh_token_tag || null,
      access_token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      scopes: tokens.scope?.split(" ") || [],
      status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider,email" });
  if (error) throw new Error("The mailbox tokens could not be stored securely.");
  return mailbox;
}
