import { disconnectMailbox, listMailboxes } from "@/lib/gmail";
import { authenticatedUserId } from "@/lib/mail-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    return Response.json({ mailboxes: await listMailboxes(userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailboxes could not be loaded.";
    return Response.json({ error: message }, { status: message.includes("Sign in") ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const mailboxId = new URL(request.url).searchParams.get("id");
    if (!mailboxId) return Response.json({ error: "Choose a mailbox to disconnect." }, { status: 400 });
    await disconnectMailbox(userId, mailboxId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The mailbox could not be disconnected.";
    return Response.json({ error: message }, { status: message.includes("Sign in") ? 401 : 500 });
  }
}
