const PT_MONTHS: Record<string, string> = {
  "janeiro": "01", "jan": "01",
  "fevereiro": "02", "fev": "02",
  "marco": "03", "mar": "03", "março": "03",
  "abril": "04", "abr": "04",
  "maio": "05", "mai": "05",
  "junho": "06", "jun": "06",
  "julho": "07", "jul": "07",
  "agosto": "08", "ago": "08",
  "setembro": "09", "set": "09",
  "outubro": "10", "out": "10",
  "novembro": "11", "nov": "11",
  "dezembro": "12", "dez": "12"
};

const EN_MONTHS: Record<string, string> = {
  "january": "01", "jan": "01",
  "february": "02", "feb": "02",
  "march": "03", "mar": "03",
  "april": "04", "apr": "04",
  "may": "05",
  "june": "06", "jun": "06",
  "july": "07", "jul": "07",
  "august": "08", "aug": "08",
  "september": "09", "sep": "09", "sept": "09",
  "october": "10", "oct": "10",
  "november": "11", "nov": "11",
  "december": "12", "dec": "12"
};

const PT_MONTH_ABBR: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
};

const EN_MONTH_ABBR: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
};

/**
 * Normalizes a single date string into standard "Mês YYYY" (e.g. "Set 2019"), "YYYY", or "Atual"/"Present"
 */
export function formatDate(dateStr?: string, lang: "pt" | "en" = "pt"): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  const lower = trimmed.toLowerCase();

  if (["atual", "present", "presente", "current", "hoje", "now"].includes(lower)) {
    return lang === "pt" ? "Atual" : "Present";
  }

  // YYYY-MM
  const yyyyMm = lower.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (yyyyMm) {
    const mNum = yyyyMm[2].padStart(2, "0");
    const mName = lang === "pt" ? PT_MONTH_ABBR[mNum] : EN_MONTH_ABBR[mNum];
    return `${mName} ${yyyyMm[1]}`;
  }

  // MM/YYYY
  const mmYyyy = lower.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (mmYyyy) {
    const mNum = mmYyyy[1].padStart(2, "0");
    const mName = lang === "pt" ? PT_MONTH_ABBR[mNum] : EN_MONTH_ABBR[mNum];
    return `${mName} ${mmYyyy[2]}`;
  }

  // Text month + year, e.g. "setembro de 2019", "julho 2017", "jan. 2009"
  const norm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const textMatch = norm.match(/\b([a-z]+)\.?\s+(?:de\s+)?(\d{4})\b/);
  if (textMatch) {
    const monthWord = textMatch[1];
    const year = textMatch[2];
    const monthNum = PT_MONTHS[monthWord] || EN_MONTHS[monthWord];
    if (monthNum) {
      const mName = lang === "pt" ? PT_MONTH_ABBR[monthNum] : EN_MONTH_ABBR[monthNum];
      return `${mName} ${year}`;
    }
  }

  // Just 4-digit year
  const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return trimmed;
}

/**
 * Standardizes a date range with clean, consistent en-dash spacing: "Set 2019 – Out 2024" or "2010 – 2012"
 * Handles unseparated cases like "setembro de 2019 outubro de 2024" safely.
 */
export function formatDateRange(startDate?: string, endDate?: string, lang: "pt" | "en" = "pt"): string {
  if (!startDate && !endDate) return "";

  // Check if startDate contains an unseparated range like "setembro de 2019 outubro de 2024"
  if (startDate && (!endDate || endDate === "Atual" || endDate === "")) {
    const twoDatesMatch = startDate.match(/^(.+?\b(?:19\d\d|20\d\d))\s+(.+?\b(?:19\d\d|20\d\d|\batual\b|\bpresente?\b))$/i);
    if (twoDatesMatch) {
      startDate = twoDatesMatch[1];
      endDate = twoDatesMatch[2];
    }
  }

  const start = formatDate(startDate, lang);
  const end = formatDate(endDate, lang);

  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end;
  if (start === end) return start; // Avoid repetitive "2009 – 2009"

  return `${start} – ${end}`;
}
