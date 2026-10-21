import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from "docx";
import type { ResumeData } from "../types/resume.ts";
import type { DocumentMetadata } from "./pdf.ts";

export async function generateAtsDocx(
  resume: ResumeData,
  metadata: DocumentMetadata
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Candidate Name (Heading 1 / Title style, single column)
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: resume.fullName,
          bold: true,
          size: 32, // 16pt
          font: "Arial",
          color: "000000"
        })
      ]
    })
  );

  // Headline
  if (resume.headline) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.headline,
            bold: true,
            size: 22, // 11pt
            font: "Arial",
            color: "333333"
          })
        ]
      })
    );
  }

  // Contact Info Line (Clean ATS body format)
  const contactParts = [
    resume.email,
    resume.phone,
    resume.location,
    resume.linkedin,
    resume.github
  ].filter(Boolean);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contactParts.join("   |   "),
          size: 19, // 9.5pt
          font: "Arial",
          color: "555555"
        })
      ],
      spacing: { after: 200 }
    })
  );

  // Helper for Section Headings
  const createSectionHeader = (title: string) => {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: "Arial",
          color: "000000"
        })
      ],
      spacing: { before: 240, after: 100 }
    });
  };

  // 1. Resumo Profissional
  if (resume.summary) {
    children.push(createSectionHeader("Resumo Profissional"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.summary,
            size: 20, // 10pt
            font: "Arial",
            color: "111111"
          })
        ],
        spacing: { after: 160 }
      })
    );
  }

  // 2. Experiência Profissional
  if (resume.experiences && resume.experiences.length > 0) {
    children.push(createSectionHeader("Experiência Profissional"));

    for (const exp of resume.experiences) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${exp.role} — ${exp.company}`,
              bold: true,
              size: 21,
              font: "Arial",
              color: "000000"
            }),
            new TextRun({
              text: `   (${exp.startDate} - ${exp.endDate})`,
              italics: true,
              size: 18,
              font: "Arial",
              color: "666666"
            })
          ],
          spacing: { before: 120, after: 60 }
        })
      );

      const bulletLines = exp.description
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

      for (const bullet of bulletLines) {
        const text = bullet.replace(/^[•\-\*]\s*/, "");
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text,
                size: 19,
                font: "Arial",
                color: "222222"
              })
            ],
            spacing: { after: 40 }
          })
        );
      }
    }
  }

  // 3. Formação Acadêmica
  if (resume.education && resume.education.length > 0) {
    children.push(createSectionHeader("Formação Acadêmica"));

    for (const edu of resume.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: edu.degree,
              bold: true,
              size: 20,
              font: "Arial",
              color: "000000"
            }),
            new TextRun({
              text: ` — ${edu.institution} (${edu.startDate} - ${edu.endDate})`,
              size: 19,
              font: "Arial",
              color: "444444"
            })
          ],
          spacing: { after: 80 }
        })
      );
    }
  }

  // 4. Habilidades Técnicas
  if (resume.skills && resume.skills.length > 0) {
    children.push(createSectionHeader("Habilidades Técnicas"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.skills.join("   •   "),
            size: 20,
            font: "Arial",
            color: "222222"
          })
        ],
        spacing: { after: 120 }
      })
    );
  }

  // 5. Certificações
  if (resume.certifications && resume.certifications.length > 0) {
    children.push(createSectionHeader("Certificações"));
    for (const cert of resume.certifications) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: cert,
              size: 19,
              font: "Arial",
              color: "222222"
            })
          ]
        })
      );
    }
  }

  // Create Document with OpenXML coreProperties metadata
  const doc = new Document({
    creator: metadata.author,
    title: metadata.title,
    description: metadata.subject,
    keywords: metadata.keywords.join(", "),
    category: metadata.category || "Currículo",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000
            }
          }
        },
        children
      }
    ]
  });

  return await Packer.toBuffer(doc);
}
