import { authenticatedUserId, authorizationUrl, createOAuthState, type MailProvider } from "@/lib/mail-oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { provider?: MailProvider };
    if (body.provider !== "google" && body.provider !== "microsoft") {
      return Response.json({ error: "Choose Google or Microsoft." }, { status: 400 });
    }
    const userId = await authenticatedUserId(request);
    const state = createOAuthState(body.provider, userId);
    return Response.json({ authorizationUrl: authorizationUrl(body.provider, state) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox OAuth is not configured.";
    const status = message.includes("configured") ? 503 : 401;
    return Response.json({ error: message }, { status });
  }
}
