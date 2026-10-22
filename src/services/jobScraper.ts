import * as cheerio from "cheerio";
import { sanitizeUtf8, stripJobBoilerplate } from "../utils/encoding.ts";

export interface ScrapedJobData {
  title: string;
  company: string;
  description: string;
}

export function extractJobFromHtml(html: string, url?: string): ScrapedJobData {
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer, header and other non-content elements
  $("script, style, noscript, nav, footer, header, svg, iframe, form, button").remove();

  // Add whitespace after every structural and inline tag so words NEVER get glued together (e.g. NestJS.Informações or Contratação6Contratação)
  $("p, li, div, h1, h2, h3, h4, span, br, td, th, section, article").after(" \n ");

  // Extract Title
  let title = "";
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const metaTitle = $("title").text();
  const h1Text = $("h1").first().text().trim();

  if (h1Text && h1Text.length < 100) {
    title = h1Text;
  } else if (ogTitle && ogTitle.length < 100) {
    title = ogTitle;
  } else if (metaTitle) {
    title = metaTitle.split(/[-–|]/)[0].trim();
  } else {
    title = "Engenheiro de Software";
  }

  // Extract Company
  let company = "";
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  const companyEl = $(".company-name, [data-company], .employer, .company, [itemprop='hiringOrganization']").first().text().trim();

  if (companyEl && companyEl.length < 60) {
    company = companyEl;
  } else if (ogSiteName && ogSiteName.length < 60) {
    company = ogSiteName;
  } else if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      company = hostname.split(".")[0];
      company = company.charAt(0).toUpperCase() + company.slice(1);
    } catch {
      company = "Empresa Confidencial";
    }
  } else {
    company = "Empresa Confidencial";
  }

  // Extract Main Description
  const mainEl = $("main, article, [role='main'], .job-description, #job-description, .description");
  let rawText = "";

  if (mainEl.length > 0) {
    rawText = mainEl.first().text();
  } else {
    rawText = $("body").text();
  }

  // Clean whitespace, unglue any remaining punctuation, normalize line breaks, and strip Gupy boilerplate
  const cleanedDescription = stripJobBoilerplate(
    sanitizeUtf8(
      rawText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join("\n")
    )
  );

  return {
    title: sanitizeUtf8(title),
    company: sanitizeUtf8(company),
    description: cleanedDescription || "Descrição não extraída automaticamente. Cole o texto da vaga manualmente."
  };
}

export async function scrapeJobUrl(url: string): Promise<ScrapedJobData> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao acessar URL da vaga (${response.status} ${response.statusText}). Cole a descrição manualmente.`);
  }

  const html = await response.text();
  return extractJobFromHtml(html, url);
}
