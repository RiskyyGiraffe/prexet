import { syncGmailPage } from "@/lib/inbox";
import { authenticatedUserId } from "@/lib/mail-oauth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const body = await request.json() as {
      mailboxId?: string;
      pageToken?: string;
      syncQuery?: string;
    };
    if (!body.mailboxId) {
      return Response.json({ error: "Choose a Gmail account to sync." }, { status: 400 });
    }
    const result = await syncGmailPage({
      userId,
      mailboxId: body.mailboxId,
      pageToken: body.pageToken,
      syncQuery: body.syncQuery,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The inbox could not be synchronized.";
    const status = message.includes("Sign in") ? 401
      : message.includes("Enable") || message.includes("Choose") ? 400
        : message.includes("Reconnect") ? 409
          : 502;
    return Response.json({ error: message }, { status });
  }
}
