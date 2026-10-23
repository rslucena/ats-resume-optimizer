import { PDFDocument } from "pdf-lib";
import PDFKitDoc from "pdfkit";
import { sanitizeLocation } from "../services/cvExtractor.ts";
import type { ResumeData } from "../types/resume.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../utils/encoding.ts";
import type { DocumentMetadata } from "./pdf.ts";

export interface CoverLetterPdfInput {
  profile: ResumeData;
  content: string;
  metadata: DocumentMetadata;
}

export async function generateCoverLetterPdf(
  input: CoverLetterPdfInput,
): Promise<Uint8Array> {
  const profile = sanitizeResumeUtf8(input.profile);
  const metadata = sanitizeResumeUtf8(input.metadata);
  const content = sanitizeUtf8(input.content || "");

  const rawPdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFKitDoc({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 48, right: 48 },
      info: {
        Title: sanitizeUtf8(metadata.title),
        Author: sanitizeUtf8(metadata.author),
        Subject: sanitizeUtf8(metadata.subject),
        Keywords: (metadata.keywords || []).join(", "),
        Creator: sanitizeUtf8(metadata.creator),
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // HEADER - Name & Contact Info
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#111111")
      .text(profile.fullName, { align: "left" });
    doc.moveDown(0.2);

    if (profile.headline) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#333333")
        .text(profile.headline);
      doc.moveDown(0.2);
    }

    const cleanLocation = sanitizeLocation(profile.location);
    const contactParts = [
      profile.email,
      profile.phone,
      cleanLocation,
      profile.linkedin,
      profile.github,
    ].filter(Boolean);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#555555")
      .text(contactParts.join("  |  "));
    doc.moveDown(0.6);

    // Separator line
    const y = doc.y;
    doc
      .moveTo(48, y)
      .lineTo(547, y)
      .lineWidth(0.75)
      .strokeColor("#888888")
      .stroke();
    doc.moveDown(0.8);

    // Title / Subject
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#000000")
      .text(metadata.title.toUpperCase(), { align: "left" });
    doc.moveDown(0.6);

    // Letter Body Paragraphs
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    doc.font("Helvetica").fontSize(10).fillColor("#222222");

    for (const p of paragraphs) {
      doc.text(p, {
        align: "justify",
        lineGap: 3.5,
      });
      doc.moveDown(0.8);
    }

    doc.end();
  });

  // Inject XMP Metadata with pdf-lib
  try {
    const pdfDoc = await PDFDocument.load(rawPdfBuffer);
    pdfDoc.setTitle(metadata.title);
    pdfDoc.setAuthor(metadata.author);
    pdfDoc.setSubject(metadata.subject);
    pdfDoc.setKeywords(metadata.keywords || []);
    pdfDoc.setProducer(
      "ATS Resume Optimizer & Job Tracker (Cover Letter Studio)",
    );
    pdfDoc.setCreator(metadata.creator);

    return await pdfDoc.save();
  } catch {
    return new Uint8Array(rawPdfBuffer);
  }
}
