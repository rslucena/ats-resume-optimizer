import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { sanitizeLocation } from "../services/cvExtractor.ts";
import type { ResumeData } from "../types/resume.ts";
import { sanitizeResumeUtf8, sanitizeUtf8 } from "../utils/encoding.ts";
import type { DocumentMetadata } from "./pdf.ts";

export interface CoverLetterDocxInput {
  profile: ResumeData;
  content: string;
  metadata: DocumentMetadata;
}

export async function generateCoverLetterDocx(
  input: CoverLetterDocxInput,
): Promise<Buffer> {
  const profile = sanitizeResumeUtf8(input.profile);
  const metadata = sanitizeResumeUtf8(input.metadata);
  const content = sanitizeUtf8(input.content || "");
  const children: Paragraph[] = [];

  // Candidate Name
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: profile.fullName,
          bold: true,
          size: 32, // 16pt
          font: "Arial",
          color: "000000",
        }),
      ],
    }),
  );

  // Headline
  if (profile.headline) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: profile.headline,
            bold: true,
            size: 22, // 11pt
            font: "Arial",
            color: "333333",
          }),
        ],
      }),
    );
  }

  // Contact line
  const cleanLocation = sanitizeLocation(profile.location);
  const contactParts = [
    profile.email,
    profile.phone,
    cleanLocation,
    profile.linkedin,
    profile.github,
  ].filter(Boolean);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contactParts.join("   |   "),
          size: 19, // 9.5pt
          font: "Arial",
          color: "555555",
        }),
      ],
      spacing: { after: 240 },
    }),
  );

  // Title / Subject Heading
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: metadata.title.toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: "Arial",
          color: "000000",
        }),
      ],
      spacing: { before: 180, after: 180 },
    }),
  );

  // Letter Body Paragraphs
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const p of paragraphs) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: p,
            size: 21, // 10.5pt
            font: "Arial",
            color: "222222",
          }),
        ],
        spacing: { after: 180, line: 276 },
      }),
    );
  }

  const doc = new Document({
    creator: metadata.author,
    title: metadata.title,
    subject: metadata.subject,
    description: "Carta de Apresentação",
    keywords: metadata.keywords.join(", "),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
