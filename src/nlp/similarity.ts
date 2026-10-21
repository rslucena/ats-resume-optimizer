import leven from "leven";

export function termSimilarity(a: string, b: string): number {
  const strA = a.toLowerCase().trim();
  const strB = b.toLowerCase().trim();

  if (strA === strB) return 1.0;
  if (!strA || !strB) return 0.0;

  const distance = leven(strA, strB);
  const maxLength = Math.max(strA.length, strB.length);
  return 1 - distance / maxLength;
}
