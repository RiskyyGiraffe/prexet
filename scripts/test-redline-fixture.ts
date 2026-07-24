import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

import { applyTrackedReplacements, extractDocxParagraphs, type TrackedReplacement } from "../lib/docx-redline";

const sourceUrl = "https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/files/Attachment%20G%20-%20Non-Disclosure%20Agreement.docx";
const outputDirectory = path.join(process.cwd(), "artifacts", "redline-test");

async function main() {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Unable to download the public USGS NDA (${response.status}).`);
  const original = new Uint8Array(await response.arrayBuffer());
  const paragraphs = await extractDocxParagraphs(original);
  const paragraph = (needle: string) => {
    const match = paragraphs.find((item) => item.text.includes(needle));
    if (!match) throw new Error(`Fixture paragraph not found: ${needle}`);
    return match.id;
  };

  const replacements: TrackedReplacement[] = [
    {
      paragraphId: paragraph("to any individual other than"),
      oldText: "to any individual other than an appropriate or authorized Government employee",
      newText: "to any individual except an appropriate or authorized Government employee with a need to know",
      reason: "Clarify the permitted recipient group.",
    },
    {
      paragraphId: paragraph("For the purposes of this agreements"),
      oldText: "For the purposes of this agreements",
      newText: "For the purposes of this agreement",
      reason: "Correct a grammatical error.",
    },
    {
      paragraphId: paragraph("at any time, including subsequent"),
      oldText: "at any time, including subsequent to the performance of duties under TBD",
      newText: "during and after the performance of duties under Contract No. TBD, for so long as the information remains non-public",
      reason: "Tie the continuing obligation to the confidentiality of the information.",
    },
  ];

  const redline = await applyTrackedReplacements(original, replacements, {
    author: "Prexet AI test",
    date: "2026-07-17T12:00:00.000Z",
  });
  await mkdir(outputDirectory, { recursive: true });
  const originalPath = path.join(outputDirectory, "USGS_Attachment_G_NDA_original.docx");
  const redlinePath = path.join(outputDirectory, "USGS_Attachment_G_NDA_prexet_redline.docx");
  await writeFile(originalPath, original);
  await writeFile(redlinePath, redline.bytes);

  const zip = await JSZip.loadAsync(redline.bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const settingsXml = await zip.file("word/settings.xml")?.async("string");
  if (!documentXml || !settingsXml?.includes("<w:trackRevisions")) throw new Error("Tracked revisions were not enabled.");
  const deletionCount = (documentXml.match(/<w:del\b/g) || []).length;
  const insertionCount = (documentXml.match(/<w:ins\b/g) || []).length;
  if (deletionCount < replacements.length || insertionCount < replacements.length) {
    throw new Error("The generated Word file is missing tracked insertions or deletions.");
  }
  console.log(JSON.stringify({ sourceUrl, originalPath, redlinePath, applied: redline.applied, deletionCount, insertionCount }, null, 2));
}

void main();
