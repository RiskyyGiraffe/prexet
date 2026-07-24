import JSZip from "jszip";

export type DocxParagraph = {
  id: string;
  text: string;
};

export type TrackedReplacement = {
  paragraphId: string;
  oldText: string;
  newText: string;
  reason?: string;
};

const paragraphPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphText(paragraphXml: string) {
  const chunks: string[] = [];
  const textPattern = /<w:(?:t|delText)(?:\s[^>]*)?>([\s\S]*?)<\/w:(?:t|delText)>/g;
  for (const match of paragraphXml.matchAll(textPattern)) chunks.push(decodeXml(match[1]));
  return chunks.join("");
}

async function loadDocumentXml(input: ArrayBuffer | Uint8Array) {
  const zip = await JSZip.loadAsync(input);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("The Word document does not contain word/document.xml.");
  return { zip, documentXml: await documentFile.async("string") };
}

export async function extractDocxParagraphs(input: ArrayBuffer | Uint8Array): Promise<DocxParagraph[]> {
  const { documentXml } = await loadDocumentXml(input);
  return Array.from(documentXml.matchAll(paragraphPattern), (match, index) => ({
    id: `p-${index}`,
    text: paragraphText(match[0]).trim(),
  })).filter((paragraph) => paragraph.text.length > 0);
}

function textRun(text: string, runProperties = "") {
  if (!text) return "";
  return `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function trackedDelete(text: string, id: number, author: string, date: string, runProperties = "") {
  return `<w:del w:id="${id}" w:author="${escapeXml(author)}" w:date="${date}"><w:r>${runProperties}<w:delText xml:space="preserve">${escapeXml(text)}</w:delText></w:r></w:del>`;
}

function trackedInsert(text: string, id: number, author: string, date: string, runProperties = "") {
  return `<w:ins w:id="${id}" w:author="${escapeXml(author)}" w:date="${date}"><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:ins>`;
}

function rewriteParagraph(
  paragraphXml: string,
  replacements: TrackedReplacement[],
  author: string,
  date: string,
  firstRevisionId: number,
) {
  const sourceText = paragraphText(paragraphXml);
  const located = replacements.map((replacement) => ({
    ...replacement,
    start: sourceText.indexOf(replacement.oldText),
  })).filter((replacement) => replacement.start >= 0)
    .sort((a, b) => a.start - b.start);

  if (!located.length) return { xml: paragraphXml, applied: 0, nextRevisionId: firstRevisionId };

  const paragraphOpen = paragraphXml.match(/^<w:p(?=[\s>])[^>]*>/)?.[0] || "<w:p>";
  const paragraphProperties = paragraphXml.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const runProperties = paragraphXml.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0] || "";
  let cursor = 0;
  let revisionId = firstRevisionId;
  let applied = 0;
  const body: string[] = [paragraphProperties];

  for (const replacement of located) {
    if (replacement.start < cursor || !replacement.oldText || replacement.oldText === replacement.newText) continue;
    body.push(textRun(sourceText.slice(cursor, replacement.start), runProperties));
    body.push(trackedDelete(replacement.oldText, revisionId, author, date, runProperties));
    revisionId += 1;
    body.push(trackedInsert(replacement.newText, revisionId, author, date, runProperties));
    revisionId += 1;
    cursor = replacement.start + replacement.oldText.length;
    applied += 1;
  }

  body.push(textRun(sourceText.slice(cursor), runProperties));
  return {
    xml: `${paragraphOpen}${body.join("")}</w:p>`,
    applied,
    nextRevisionId: revisionId,
  };
}

function highestRevisionId(xml: string) {
  let highest = 0;
  for (const match of xml.matchAll(/w:id="(\d+)"/g)) highest = Math.max(highest, Number(match[1]));
  return highest;
}

export async function applyTrackedReplacements(
  input: ArrayBuffer | Uint8Array,
  replacements: TrackedReplacement[],
  options: { author?: string; date?: string } = {},
) {
  const { zip, documentXml } = await loadDocumentXml(input);
  const author = options.author || "Prexet AI";
  const date = options.date || new Date().toISOString();
  const byParagraph = new Map<string, TrackedReplacement[]>();
  replacements.forEach((replacement) => {
    const current = byParagraph.get(replacement.paragraphId) || [];
    current.push(replacement);
    byParagraph.set(replacement.paragraphId, current);
  });

  let paragraphIndex = 0;
  let revisionId = highestRevisionId(documentXml) + 1;
  let applied = 0;
  const redlinedXml = documentXml.replace(paragraphPattern, (paragraphXml) => {
    const paragraphId = `p-${paragraphIndex}`;
    paragraphIndex += 1;
    const paragraphReplacements = byParagraph.get(paragraphId) || [];
    if (!paragraphReplacements.length) return paragraphXml;
    const rewritten = rewriteParagraph(paragraphXml, paragraphReplacements, author, date, revisionId);
    revisionId = rewritten.nextRevisionId;
    applied += rewritten.applied;
    return rewritten.xml;
  });

  if (!applied) throw new Error("None of the proposed edits matched the source document exactly.");
  zip.file("word/document.xml", redlinedXml);

  const settingsFile = zip.file("word/settings.xml");
  if (settingsFile) {
    const settingsXml = await settingsFile.async("string");
    if (!settingsXml.includes("<w:trackRevisions")) {
      zip.file("word/settings.xml", settingsXml.replace(/<\/w:settings>/, "<w:trackRevisions/></w:settings>"));
    }
  }

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes, applied };
}
