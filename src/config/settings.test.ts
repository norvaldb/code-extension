import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace, window } from 'vscode';
import { getAnalyzeProjectSettings } from './settings';

function mockConfig(values: Record<string, unknown>): void {
  vi.mocked(workspace.getConfiguration).mockReturnValue({
    get: vi.fn().mockImplementation((key: string) => values[key]),
  } as unknown as ReturnType<typeof workspace.getConfiguration>);
}

describe('getAnalyzeProjectSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clamps numeric values to limits and floors decimals', () => {
    mockConfig({
      contentBudgetBytes: 999_999,
      maxFilenameLength: 10,
      maxIssues: 50.9,
      maxScannedFiles: 99,
      issuesPerFile: 30,
      titleMaxLength: 39,
    });

    const settings = getAnalyzeProjectSettings();

    expect(settings.contentBudgetBytes).toBe(250_000);
    expect(settings.maxFilenameLength).toBe(20);
    expect(settings.maxIssues).toBe(50);
    expect(settings.maxScannedFiles).toBe(100);
    expect(settings.issuesPerFile).toBe(25);
    expect(settings.titleMaxLength).toBe(40);
  });

  it('ignores invalid regex patterns and logs a warning', () => {
    mockConfig({
      priorityPatterns: ['[bad', 'package\\.json$'],
    });

    const settings = getAnalyzeProjectSettings();

    expect(settings.priorityPatterns).toHaveLength(1);
    expect(settings.priorityPatterns[0].test('package.json')).toBe(true);

    expect(window.createOutputChannel).toHaveBeenCalledWith('Analyze Project');
    const channel = vi.mocked(window.createOutputChannel).mock.results[0]
      .value as { appendLine: ReturnType<typeof vi.fn> };
    expect(channel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring invalid priority regex pattern: [bad')
    );
  });

  it('normalizes stopWords to lowercase and removes invalid entries', () => {
    mockConfig({
      stopWords: ['The', 'API', '', '  ', 123, null],
    });

    const settings = getAnalyzeProjectSettings();

    expect(settings.stopWords.has('the')).toBe(true);
    expect(settings.stopWords.has('api')).toBe(true);
    expect(settings.stopWords.has('')).toBe(false);
    expect(settings.stopWords.has('The')).toBe(false);
  });

  it('sanitizes fallback report base name and falls back when empty', () => {
    mockConfig({ fallbackReportBaseName: '***' });
    expect(getAnalyzeProjectSettings().fallbackReportBaseName).toBe('analysis');

    mockConfig({ fallbackReportBaseName: ' My Report_1! ' });
    expect(getAnalyzeProjectSettings().fallbackReportBaseName).toBe('myreport1');
  });
});
