import { getAnalyzeProjectSettings } from '../config/settings';

export function generateFileName(prompt: string, suffix?: string): string {
  const settings = getAnalyzeProjectSettings();
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !settings.stopWords.has(w));

  const slug = buildSlug(words, settings.maxFilenameLength);
  const base = slug || settings.fallbackReportBaseName;
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
