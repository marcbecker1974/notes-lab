/**
 * Splits article text into roughly `size`-character chunks, each starting about
 * `overlap` characters before the previous one ended, so a sentence cut at a boundary
 * still appears whole in one of the two chunks. Chunks end at a space when one is near
 * the limit and start at a word, so words are not cut. No chunk is longer than `size`.
 */
export function chunkText(text: string, size = 500, overlap = 100): string[] {
  const t = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + size, t.length);
    if (end < t.length) {
      for (let i = end; i >= start + size * 0.8; i--) {
        if (/\s/.test(t[i])) {
          end = i;
          break;
        }
      }
    }
    const piece = t.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= t.length) break;
    let next = end - overlap;
    while (next < end && !/\s/.test(t[next - 1])) next++;
    start = Math.max(next, start + 1);
  }
  return chunks;
}
