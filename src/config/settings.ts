import * as vscode from 'vscode';
import { appendWarning } from '../logging/outputChannel';

export const LIMITS = {
  contentBudgetBytes: { min: 10_000, max: 250_000 },
  maxFilenameLength: { min: 20, max: 80 },
  maxIssues: { min: 5, max: 50 },
  maxScannedFiles: { min: 100, max: 5_000 },
  issuesPerFile: { min: 5, max: 25 },
  titleMaxLength: { min: 40, max: 120 },
  maxPatternCount: 1_000,
  maxRegexLength: 300,
  maxPatternLength: 500,
  maxStopWordCount: 500,
  maxStopWordLength: 40,
} as const;

export const DEFAULTS = {
  contentBudgetBytes: 60_000,
  maxFilenameLength: 35,
  maxIssues: 20,
  maxScannedFiles: 500,
  issuesPerFile: 10,
  titleMaxLength: 60,
  fallbackReportBaseName: 'analysis',
  stopWords: [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
    'this', 'that', 'these', 'those', 'please',
  ],
  priorityPatterns: [
    'package\\.json$',
    'pom\\.xml$',
    'build\\.gradle(\\.kts)?$',
    'tsconfig(\\..*)?\\.json$',
    'vite\\.config\\.(ts|js|mts|mjs)$',
    'application\\.(yml|yaml|properties)$',
    'bootstrap\\.(yml|yaml|properties)$',
    'persistence\\.xml$',
    'SecurityConfig\\.(java|kt)$',
    'WebSecurityConfig\\.(java|kt)$',
    '.*Config\\.(java|kt)$',
    'src\\/main\\.(ts|js|tsx|jsx)$',
    'src\\/index\\.(ts|js|tsx|jsx)$',
    'index\\.html$',
    '.*Controller\\.(java|kt)$',
    '.*Service\\.(java|kt)$',
    '.*Repository\\.(java|kt)$',
    '.*Entity\\.(java|kt)$',
  ],
  excludedGlobs: [
    '**/node_modules/**',
    '**/.git/**',
    '**/out/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**',
    '**/.gradle/**',
    '**/.idea/**',
    '**/*.min.js',
    '**/*.map',
  ],
} as const;

export interface AnalyzeProjectSettings {
  contentBudgetBytes: number;
  maxFilenameLength: number;
  maxIssues: number;
  maxScannedFiles: number;
  issuesPerFile: number;
  titleMaxLength: number;
  fallbackReportBaseName: string;
  stopWords: Set<string>;
  priorityPatterns: RegExp[];
  excludedGlobs: string[];
  cleanCodePatterns: string[];
  stackIssuePatterns: Record<string, string[]>;
}

export function getAnalyzeProjectSettings(): AnalyzeProjectSettings {
  const config = vscode.workspace.getConfiguration('analyzeProject');

  const contentBudgetBytes = clampNumber(
    config.get<number>('contentBudgetBytes'),
    DEFAULTS.contentBudgetBytes,
    LIMITS.contentBudgetBytes.min,
    LIMITS.contentBudgetBytes.max
  );

  const maxFilenameLength = clampNumber(
    config.get<number>('maxFilenameLength'),
    DEFAULTS.maxFilenameLength,
    LIMITS.maxFilenameLength.min,
    LIMITS.maxFilenameLength.max
  );

  const maxIssues = clampNumber(
    config.get<number>('maxIssues'),
    DEFAULTS.maxIssues,
    LIMITS.maxIssues.min,
    LIMITS.maxIssues.max
  );

  const maxScannedFiles = clampNumber(
    config.get<number>('maxScannedFiles'),
    DEFAULTS.maxScannedFiles,
    LIMITS.maxScannedFiles.min,
    LIMITS.maxScannedFiles.max
  );

  const issuesPerFile = clampNumber(
    config.get<number>('issuesPerFile'),
    DEFAULTS.issuesPerFile,
    LIMITS.issuesPerFile.min,
    LIMITS.issuesPerFile.max
  );

  const titleMaxLength = clampNumber(
    config.get<number>('titleMaxLength'),
    DEFAULTS.titleMaxLength,
    LIMITS.titleMaxLength.min,
    LIMITS.titleMaxLength.max
  );

  const fallbackReportBaseName = sanitizeFallbackName(
    config.get<string>('fallbackReportBaseName')
  );

  const stopWords = buildStopWordSet(config.get<unknown>('stopWords'));
  const priorityPatterns = buildRegexPatterns(config.get<unknown>('priorityPatterns'));
  const excludedGlobs = sanitizeStringArray(
    config.get<unknown>('excludedGlobs'),
    DEFAULTS.excludedGlobs,
    LIMITS.maxPatternCount,
    LIMITS.maxRegexLength
  );
  const cleanCodePatterns = sanitizeStringArray(
    config.get<unknown>('cleanCodePatterns'),
    [],
    LIMITS.maxPatternCount,
    LIMITS.maxPatternLength
  );
  const stackIssuePatterns = sanitizeStackIssuePatterns(
    config.get<unknown>('stackIssuePatterns')
  );

  return {
    contentBudgetBytes,
    maxFilenameLength,
    maxIssues,
    maxScannedFiles,
    issuesPerFile,
    titleMaxLength,
    fallbackReportBaseName,
    stopWords,
    priorityPatterns,
    excludedGlobs,
    cleanCodePatterns,
    stackIssuePatterns,
  };
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeFallbackName(value: string | undefined): string {
  if (typeof value !== 'string') return DEFAULTS.fallbackReportBaseName;
  const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
  return cleaned || DEFAULTS.fallbackReportBaseName;
}

function sanitizeStringArray(
  value: unknown,
  fallback: readonly string[],
  maxItems: number,
  maxLength: number
): string[] {
  const source = Array.isArray(value) ? value : [...fallback];

  const out: string[] = [];
  for (const item of source) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLength) continue;
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }

  return out;
}

function buildStopWordSet(value: unknown): Set<string> {
  const words = sanitizeStringArray(
    value,
    DEFAULTS.stopWords,
    LIMITS.maxStopWordCount,
    LIMITS.maxStopWordLength
  );
  return new Set(words.map((w) => w.toLowerCase()));
}

function buildRegexPatterns(value: unknown): RegExp[] {
  const patterns = sanitizeStringArray(
    value,
    DEFAULTS.priorityPatterns,
    LIMITS.maxPatternCount,
    LIMITS.maxRegexLength
  );

  const out: RegExp[] = [];
  for (const pattern of patterns) {
    try {
      out.push(new RegExp(pattern));
    } catch {
      appendWarning(`Ignoring invalid priority regex pattern: ${pattern}`);
    }
  }

  return out;
}

function sanitizeStackIssuePatterns(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, string[]> = {};
  let totalPatterns = 0;

  for (const [stack, rawPatterns] of Object.entries(value)) {
    if (typeof stack !== 'string' || !stack.trim()) continue;
    const patterns = sanitizeStringArray(
      rawPatterns,
      [],
      LIMITS.maxPatternCount,
      LIMITS.maxPatternLength
    );
    if (patterns.length === 0) continue;

    const remaining = LIMITS.maxPatternCount - totalPatterns;
    if (remaining <= 0) break;

    const kept = patterns.slice(0, remaining);
    out[stack] = kept;
    totalPatterns += kept.length;
  }

  return out;
}