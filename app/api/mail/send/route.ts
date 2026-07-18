import { sendGmailMessage, type GmailAttachment } from "@/lib/gmail";
import { authenticatedUserId } from "@/lib/mail-oauth";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxAttachmentBytes = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const form = await request.formData();
    const mailboxId = String(form.get("mailboxId") || "");
    const to = String(form.get("to") || "").trim();
    const subject = String(form.get("subject") || "").trim();
    const bodyHtml = String(form.get("bodyHtml") || "").trim();
    if (!mailboxId || !emailPattern.test(to) || !subject || !bodyHtml) {
      return Response.json({ error: "Choose a sender and provide a valid recipient, subject, and message." }, { status: 400 });
    }
    if (subject.length > 998 || bodyHtml.length > 1_000_000) {
      return Response.json({ error: "This message is too large to send." }, { status: 413 });
    }

    const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (files.length > 10 || totalBytes > maxAttachmentBytes) {
      return Response.json({ error: "Use no more than 10 attachments totaling 4 MB in this version." }, { status: 413 });
    }
    const attachments: GmailAttachment[] = await Promise.all(files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
    })));
    const result = await sendGmailMessage({ userId, mailboxId, to, subject, bodyHtml, attachments });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The email could not be sent.";
    const status = message.includes("Sign in") ? 401 : message.includes("Reconnect") ? 409 : 502;
    return Response.json({ error: message }, { status });
  }
}
