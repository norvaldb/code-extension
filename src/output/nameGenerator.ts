const MAX_LENGTH = 35;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those', 'please', 'analyze', 'check',
  'look', 'find', 'review', 'project',
]);

export function generateFileName(prompt: string, suffix?: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const slug = buildSlug(words, MAX_LENGTH);
  const base = slug || 'analysis';
  return suffix ? `${base}-${suffix}` : base;
}

function buildSlug(words: string[], maxLength: number): string {
  const parts: string[] = [];
  let length = 0;

  for (const word of words) {
    const needed = parts.length === 0 ? word.length : word.length + 1;
    if (length + needed > maxLength) break;
    parts.push(word);
    length += needed;
  }

  return parts.join('-');
}
