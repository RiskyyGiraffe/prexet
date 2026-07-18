import { applyTrackedReplacements, extractDocxParagraphs, type TrackedReplacement } from "@/lib/docx-redline";

export const runtime = "nodejs";

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type OpenRouterResult = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function safeOutputName(fileName: string) {
  const stem = fileName.replace(/\.docx$/i, "").replace(/[^a-z0-9._-]+/gi, "_");
  return `${stem || "document"}_prexet_redline.docx`;
}

function isReplacement(value: unknown): value is TrackedReplacement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.paragraphId === "string"
    && typeof item.oldText === "string"
    && typeof item.newText === "string"
    && item.oldText.length > 0;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENROUTER_API_KEY is not configured on the server." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("document");
    const instructions = String(formData.get("instructions") || "Make the agreement balanced and commercially reasonable.").trim();
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".docx")) {
      return Response.json({ error: "Upload a .docx Word document." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "Word documents are limited to 10 MB for this preview." }, { status: 413 });
    }

    const input = await file.arrayBuffer();
    const paragraphs = await extractDocxParagraphs(input);
    if (!paragraphs.length) return Response.json({ error: "No editable paragraphs were found." }, { status: 422 });
    const model = process.env.OPENROUTER_REDLINE_MODEL || DEFAULT_MODEL;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://prexet.com",
        "X-OpenRouter-Title": "Prexet",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 5000,
        messages: [
          {
            role: "system",
            content: "You are a precise commercial contract redlining assistant. Return only targeted edits. Each oldText must be an exact, contiguous substring of the supplied paragraph. Do not rewrite whole paragraphs when a short surgical change will work. Do not invent facts, party names, dates, or business terms.",
          },
          {
            role: "user",
            content: `Review this Word document under the following authority:\n\n${instructions}\n\nPropose up to 20 precise tracked replacements. Use the paragraph id exactly as supplied. If no change is warranted, return an empty replacements array.\n\nPARAGRAPHS\n${JSON.stringify(paragraphs)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prexet_document_redline",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                replacements: {
                  type: "array",
                  maxItems: 20,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      paragraphId: { type: "string" },
                      oldText: { type: "string" },
                      newText: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["paragraphId", "oldText", "newText", "reason"],
                  },
                },
              },
              required: ["replacements"],
            },
          },
        },
      }),
    });

    const result = await response.json() as OpenRouterResult;
    if (!response.ok) {
      return Response.json({ error: result.error?.message || "OpenRouter could not complete the review." }, { status: 502 });
    }
    const content = result.choices?.[0]?.message?.content;
    if (!content) return Response.json({ error: "The review model returned no result." }, { status: 502 });
    const parsed = JSON.parse(content) as { replacements?: unknown[] };
    const replacements = (parsed.replacements || []).filter(isReplacement);
    if (!replacements.length) return Response.json({ error: "The review completed without any proposed changes." }, { status: 422 });

    const redline = await applyTrackedReplacements(input, replacements, { author: "Prexet AI" });
    return new Response(Buffer.from(redline.bytes), {
      headers: {
        "Content-Type": DOCX_TYPE,
        "Content-Disposition": `attachment; filename="${safeOutputName(file.name)}"`,
        "X-Prexet-Changes": String(redline.applied),
        "X-Prexet-Model": model,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to redline this document.";
    return Response.json({ error: message }, { status: 500 });
  }
}
