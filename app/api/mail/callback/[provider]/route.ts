import { authenticatedUserId, exchangeAuthorizationCode, persistMailboxConnection, verifyOAuthState, type MailProvider } from "@/lib/mail-oauth";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/mail/callback/[provider]">) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  try {
    const { provider } = await context.params;
    if (provider !== "google" && provider !== "microsoft") throw new Error("Unknown mailbox provider.");
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    if (!code || !stateValue) throw new Error(url.searchParams.get("error_description") || "The provider did not return an authorization code.");
    const state = verifyOAuthState(stateValue);
    if (state.provider !== provider) throw new Error("The mailbox provider did not match the connection request.");
    const sessionUserId = await authenticatedUserId(request);
    if (sessionUserId !== state.userId) throw new Error("Sign in again before connecting this mailbox.");
    const tokens = await exchangeAuthorizationCode(provider as MailProvider, code);
    await persistMailboxConnection(state.userId, provider as MailProvider, tokens, {
      enableInbox: state.accessMode === "inbox",
    });
    return Response.redirect(`${appUrl}/?mailbox=${state.accessMode === "inbox" ? "inbox_connected" : "connected"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox connection failed.";
    return Response.redirect(`${appUrl}/?mailbox_error=${encodeURIComponent(message)}`);
  }
}
