import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace, window } from 'vscode';
import { scanProject } from './projectScanner';

function uri(path: string): { fsPath: string } {
  return { fsPath: path };
}

function mockConfig(values: Record<string, unknown>): void {
  vi.mocked(workspace.getConfiguration).mockReturnValue({
    get: vi.fn().mockImplementation((key: string) => values[key]),
  } as unknown as ReturnType<typeof workspace.getConfiguration>);
}

describe('scanProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workspace.asRelativePath).mockImplementation((u: { fsPath?: string } | string) => {
      const raw = typeof u === 'string' ? u : (u.fsPath ?? '');
      return raw.replace('/workspace/', '');
    });
  });

  it('truncates file content at line boundary and appends marker', async () => {
    mockConfig({
      contentBudgetBytes: 10_000,
      maxScannedFiles: 500,
      excludedGlobs: ['**/node_modules/**'],
      priorityPatterns: [],
    });

    vi.mocked(workspace.findFiles).mockResolvedValueOnce([uri('/workspace/src/main.ts')]);
    vi.mocked(workspace.fs.readFile).mockResolvedValueOnce(
      new TextEncoder().encode('line1\n' + 'a'.repeat(15_000))
    );

    const context = await scanProject();

    expect(context.keyFiles).toHaveLength(1);
    expect(context.keyFiles[0].path).toBe('src/main.ts');
    expect(context.keyFiles[0].content).toBe('line1\n... [truncated]');
  });

  it('emits warnings to output channel when files are unreadable', async () => {
    mockConfig({
      contentBudgetBytes: 10_000,
      maxScannedFiles: 500,
      excludedGlobs: ['**/node_modules/**'],
      priorityPatterns: [],
    });

    vi.mocked(workspace.findFiles).mockResolvedValueOnce([
      uri('/workspace/src/fail.ts'),
      uri('/workspace/src/ok.ts'),
    ]);

    vi.mocked(workspace.fs.readFile)
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce(new TextEncoder().encode('const x = 1;'));

    const context = await scanProject();

    expect(context.keyFiles).toHaveLength(1);
    expect(context.keyFiles[0].path).toBe('src/ok.ts');

    expect(window.createOutputChannel).toHaveBeenCalledWith('Analyze Project');
    const channel = vi.mocked(window.createOutputChannel).mock.results[0]
      .value as { appendLine: ReturnType<typeof vi.fn> };

    expect(channel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read file /workspace/src/fail.ts: permission denied')
    );
    expect(channel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Project scan skipped 1 unreadable file(s).')
    );
  });
});
