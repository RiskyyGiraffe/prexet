import { queryInbox } from "@/lib/inbox";
import { authenticatedUserId } from "@/lib/mail-oauth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const body = await request.json() as { question?: string; mailboxId?: string };
    const question = String(body.question || "").trim();
    if (question.length < 3 || question.length > 1000) {
      return Response.json({ error: "Ask an inbox question between 3 and 1,000 characters." }, { status: 400 });
    }
    return Response.json(await queryInbox(userId, question, body.mailboxId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The inbox question could not be answered.";
    const status = message.includes("Sign in") ? 401
      : message.includes("Enable") ? 400
        : message.includes("configured") ? 503
          : 502;
    return Response.json({ error: message }, { status });
  }
}
