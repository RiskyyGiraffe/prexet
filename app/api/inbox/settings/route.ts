import { listMailboxes } from "@/lib/gmail";
import { getInboxSettings, saveInboxSettings } from "@/lib/inbox";
import { authenticatedUserId } from "@/lib/mail-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const [settings, mailboxes] = await Promise.all([
      getInboxSettings(userId),
      listMailboxes(userId),
    ]);
    return Response.json({ settings, mailboxes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox settings could not be loaded.";
    return Response.json({ error: message }, { status: message.includes("Sign in") ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    const body = await request.json() as { onboardingCompleted?: boolean; enabled?: boolean };
    const settings = await saveInboxSettings(userId, {
      onboardingCompleted: typeof body.onboardingCompleted === "boolean" ? body.onboardingCompleted : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    });
    return Response.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox settings could not be saved.";
    return Response.json({ error: message }, { status: message.includes("Sign in") ? 401 : 500 });
  }
}
