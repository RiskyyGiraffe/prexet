import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { decryptMailToken, encryptMailToken, type EncryptedToken } from "@/lib/mail-token-crypto";

type MailboxConnectionRow = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft";
  email: string;
  display_name: string | null;
  encrypted_access_token: string;
  access_token_iv: string;
  access_token_tag: string;
  encrypted_refresh_token: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
  access_token_expires_at: string | null;
  status: "connected" | "needs_reauth" | "revoked";
  updated_at: string;
};

export type PublicMailbox = {
  id: string;
  provider: "google" | "microsoft";
  email: string;
  displayName: string;
  status: MailboxConnectionRow["status"];
};

export type GmailAttachment = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

function required(name: "GOOGLE_MAIL_CLIENT_ID" | "GOOGLE_MAIL_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function encryptedToken(ciphertext: string, iv: string, tag: string): EncryptedToken {
  return { ciphertext, iv, tag };
}

function publicMailbox(row: MailboxConnectionRow): PublicMailbox {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    displayName: row.display_name || row.email,
    status: row.status,
  };
}

export async function listMailboxes(userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("prexet_mailbox_connections")
    .select("id,provider,email,display_name,status")
    .eq("user_id", userId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Connected mailboxes could not be loaded.");
  return (data || []).map((row) => ({
    id: row.id as string,
    provider: row.provider as PublicMailbox["provider"],
    email: row.email as string,
    displayName: (row.display_name || row.email) as string,
    status: row.status as PublicMailbox["status"],
  }));
}

async function mailboxForUser(userId: string, mailboxId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("prexet_mailbox_connections")
    .select("*")
    .eq("id", mailboxId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("That sending mailbox is not connected to your account.");
  return data as MailboxConnectionRow;
}

async function markNeedsReauth(mailboxId: string) {
  await createSupabaseAdminClient()
    .from("prexet_mailbox_connections")
    .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
    .eq("id", mailboxId);
}

async function refreshGoogleAccessToken(row: MailboxConnectionRow) {
  if (!row.encrypted_refresh_token || !row.refresh_token_iv || !row.refresh_token_tag) {
    await markNeedsReauth(row.id);
    throw new Error("Reconnect this Gmail account before sending.");
  }

  const refreshToken = decryptMailToken(encryptedToken(
    row.encrypted_refresh_token,
    row.refresh_token_iv,
    row.refresh_token_tag,
  ));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_MAIL_CLIENT_ID"),
      client_secret: required("GOOGLE_MAIL_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    await markNeedsReauth(row.id);
    throw new Error(result.error_description || "Reconnect this Gmail account before sending.");
  }

  const token = encryptMailToken(result.access_token);
  const expiresAt = new Date(Date.now() + (result.expires_in || 3600) * 1000).toISOString();
  const { error } = await createSupabaseAdminClient()
    .from("prexet_mailbox_connections")
    .update({
      encrypted_access_token: token.ciphertext,
      access_token_iv: token.iv,
      access_token_tag: token.tag,
      access_token_expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id);
  if (error) throw new Error("The refreshed Gmail token could not be stored.");
  return result.access_token;
}

async function googleAccessToken(row: MailboxConnectionRow, forceRefresh = false) {
  if (row.status === "needs_reauth" || row.status === "revoked") {
    throw new Error("Reconnect this Gmail account before sending.");
  }
  const expiresSoon = !row.access_token_expires_at
    || new Date(row.access_token_expires_at).getTime() <= Date.now() + 60_000;
  if (forceRefresh || expiresSoon) return refreshGoogleAccessToken(row);
  return decryptMailToken(encryptedToken(
    row.encrypted_access_token,
    row.access_token_iv,
    row.access_token_tag,
  ));
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(safeHeader(value), "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function plainTextFromHtml(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizedHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");
}

function mimeMessage({
  from,
  displayName,
  to,
  subject,
  bodyHtml,
  attachments,
}: {
  from: string;
  displayName: string;
  to: string;
  subject: string;
  bodyHtml: string;
  attachments: GmailAttachment[];
}) {
  const mixedBoundary = `prexet_mixed_${crypto.randomUUID()}`;
  const alternativeBoundary = `prexet_alt_${crypto.randomUUID()}`;
  const html = sanitizedHtml(bodyHtml);
  const headers = [
    `From: "${safeHeader(displayName).replaceAll('"', "'")}" <${safeHeader(from)}>`,
    `To: ${safeHeader(to)}`,
    `Subject: ${encodedSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
  ];
  const alternative = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(plainTextFromHtml(html), "utf8").toString("base64")),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    `--${alternativeBoundary}--`,
  ];
  const attachmentParts = attachments.flatMap((attachment) => {
    const fileName = safeHeader(attachment.name).replaceAll('"', "'");
    return [
      `--${mixedBoundary}`,
      `Content-Type: ${safeHeader(attachment.mimeType || "application/octet-stream")}; name="${fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${fileName}"`,
      "",
      wrapBase64(Buffer.from(attachment.bytes).toString("base64")),
    ];
  });
  return [...headers, ...alternative, ...attachmentParts, `--${mixedBoundary}--`, ""].join("\r\n");
}

export async function sendGmailMessage({
  userId,
  mailboxId,
  to,
  subject,
  bodyHtml,
  attachments,
}: {
  userId: string;
  mailboxId: string;
  to: string;
  subject: string;
  bodyHtml: string;
  attachments: GmailAttachment[];
}) {
  const row = await mailboxForUser(userId, mailboxId);
  if (row.provider !== "google") throw new Error("Choose a connected Gmail account for this send.");
  const raw = Buffer.from(mimeMessage({
    from: row.email,
    displayName: row.display_name || row.email,
    to,
    subject,
    bodyHtml,
    attachments,
  }), "utf8").toString("base64url");

  async function send(forceRefresh = false) {
    const accessToken = await googleAccessToken(row, forceRefresh);
    return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  }

  let response = await send();
  if (response.status === 401) response = await send(true);
  const result = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message || "Gmail did not send this message.");
  }
  return { messageId: result.id, mailbox: publicMailbox(row) };
}

export async function disconnectMailbox(userId: string, mailboxId: string) {
  const row = await mailboxForUser(userId, mailboxId);
  if (row.provider === "google") {
    const token = row.encrypted_refresh_token && row.refresh_token_iv && row.refresh_token_tag
      ? decryptMailToken(encryptedToken(row.encrypted_refresh_token, row.refresh_token_iv, row.refresh_token_tag))
      : decryptMailToken(encryptedToken(row.encrypted_access_token, row.access_token_iv, row.access_token_tag));
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  }
  const { error } = await createSupabaseAdminClient()
    .from("prexet_mailbox_connections")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", mailboxId)
    .eq("user_id", userId);
  if (error) throw new Error("The mailbox could not be disconnected.");
}
