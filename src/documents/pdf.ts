import { PDFDocument } from "pdf-lib";
import PDFKitDoc from "pdfkit";
import { sanitizeLocation } from "../services/cvExtractor.ts";
import type { ResumeData } from "../types/resume.ts";
import { formatDateRange } from "../utils/dateFormat.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../utils/encoding.ts";

export interface DocumentMetadata {
  title: string;
  author: string;
  keywords: string[];
  subject: string;
  creator: string;
  category?: string;
}

export async function generateAtsPdf(
  rawResume: ResumeData,
  rawMetadata: DocumentMetadata,
): Promise<Uint8Array> {
  const resume = sanitizeResumeUtf8(rawResume);
  const metadata = sanitizeResumeUtf8(rawMetadata);

  // Step 1: Render ATS-friendly single-column layout using PDFKit
  const rawPdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFKitDoc({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 45, right: 45 },
      info: {
        Title: sanitizeUtf8(metadata.title),
        Author: sanitizeUtf8(metadata.author),
        Subject: sanitizeUtf8(metadata.subject),
        Keywords: (metadata.keywords || [])
          .map((k) => sanitizeUtf8(k))
          .join(", "),
        Creator: sanitizeUtf8(metadata.creator),
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // HEADER - Name & Contact Info (ATS Rule: contact info directly in body, never in header/footer)
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(resume.fullName, { align: "left" });
    doc.moveDown(0.2);

    if (resume.headline) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#222222")
        .text(resume.headline);
      doc.moveDown(0.2);
    }

    const cleanLocation = sanitizeLocation(resume.location);
    const contactParts = [
      resume.email,
      resume.phone,
      cleanLocation,
      resume.linkedin,
      resume.github,
    ].filter(Boolean);

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#444444")
      .text(contactParts.join("  |  "));
    doc.moveDown(0.8);

    // Helper for Section Titles
    const renderSectionTitle = (title: string) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text(title.toUpperCase());
      doc.moveDown(0.2);
      // Clean thin separator line
      const y = doc.y;
      doc
        .moveTo(45, y)
        .lineTo(550, y)
        .lineWidth(0.75)
        .strokeColor("#888888")
        .stroke();
      doc.moveDown(0.4);
    };

    // SECTION 1: RESUMO PROFISSIONAL (Weight 3)
    if (resume.summary) {
      renderSectionTitle("Resumo Profissional");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#111111")
        .text(resume.summary, {
          align: "justify",
          lineGap: 2,
        });
      doc.moveDown(0.8);
    }

    // SECTION 2: EXPERIÊNCIA PROFISSIONAL (Weight 2 & First Line Rule)
    if (resume.experiences && resume.experiences.length > 0) {
      renderSectionTitle("Experiência Profissional");

      for (const exp of resume.experiences) {
        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .fillColor("#000000")
          .text(exp.role, { continued: true });
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor("#444444")
          .text(` — ${exp.company}`);

        const dateRange = formatDateRange(exp.startDate, exp.endDate);
        doc
          .font("Helvetica-Oblique")
          .fontSize(8.5)
          .fillColor("#666666")
          .text(dateRange);
        doc.moveDown(0.25);

        // Bullets
        const lines = exp.description
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        for (const line of lines) {
          const cleanLine =
            line.startsWith("•") || line.startsWith("-") ? line : `• ${line}`;
          doc
            .font("Helvetica")
            .fontSize(9.5)
            .fillColor("#222222")
            .text(cleanLine, {
              indent: 10,
              lineGap: 2,
              align: "left",
            });
        }
        doc.moveDown(0.4);
      }
    }

    // SECTION 3: FORMAÇÃO ACADÊMICA
    if (resume.education && resume.education.length > 0) {
      renderSectionTitle("Formação Acadêmica");

      for (const edu of resume.education) {
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#000000")
          .text(edu.degree);
        const eduDates = formatDateRange(edu.startDate, edu.endDate);
        const eduSubtitle = eduDates
          ? `${edu.institution}  (${eduDates})`
          : edu.institution;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#444444")
          .text(eduSubtitle);
        doc.moveDown(0.4);
      }
      doc.moveDown(0.4);
    }

    // SECTION 4: HABILIDADES TÉCNICAS
    if (resume.skills && resume.skills.length > 0) {
      renderSectionTitle("Habilidades Técnicas");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#222222")
        .text(resume.skills.join("  •  "), {
          lineGap: 2,
        });
      doc.moveDown(0.6);
    }

    // SECTION 5: CERTIFICAÇÕES
    if (resume.certifications && resume.certifications.length > 0) {
      renderSectionTitle("Certificações");
      for (const cert of resume.certifications) {
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor("#222222")
          .text(`• ${cert}`);
      }
      doc.moveDown(0.4);
    }

    doc.end();
  });

  // Step 2: Inject Binary Metadata (Info Dict and XMP stream) using PDF-Lib
  const pdfDoc = await PDFDocument.load(rawPdfBuffer);

  pdfDoc.setTitle(metadata.title);
  pdfDoc.setAuthor(metadata.author);
  pdfDoc.setSubject(metadata.subject);
  pdfDoc.setKeywords(metadata.keywords);
  pdfDoc.setCreator(metadata.creator);
  pdfDoc.setProducer("ATS Resume Optimizer Engine");

  // Save the modified PDF binary
  const modifiedPdfBytes = await pdfDoc.save();
  return modifiedPdfBytes;
}
