import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { writeReports } from './fileWriter';
import type { Issue } from '../types';

describe('writeReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a single file when there are 10 or fewer issues', async () => {
    const issues: Issue[] = Array.from({ length: 5 }, (_, i) => ({
      title: `Issue ${i}`,
      severity: 'Minor' as const,
      description: 'desc',
      mitigation: 'fix',
    }));

    const result = await writeReports('security-issues', issues, 'security', 'copilot', 'summary');

    expect(result.fileNames).toHaveLength(1);
    expect(result.fileNames[0]).toBe('security-issues.md');
    expect(workspace.fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('writes two files when there are more than 10 issues', async () => {
    const issues: Issue[] = Array.from({ length: 15 }, (_, i) => ({
      title: `Issue ${i}`,
      severity: 'Major' as const,
      description: 'desc',
      mitigation: 'fix',
    }));

    const result = await writeReports('analysis', issues, 'analyze', 'claude', 'summary');

    expect(result.fileNames).toHaveLength(2);
    expect(result.fileNames[0]).toBe('analysis-part1.md');
    expect(result.fileNames[1]).toBe('analysis-part2.md');
    expect(workspace.fs.writeFile).toHaveBeenCalledTimes(2);
  });

  it('returns the correct number of URIs', async () => {
    const issues: Issue[] = Array.from({ length: 3 }, (_, i) => ({
      title: `Issue ${i}`,
      severity: 'Critical' as const,
      description: 'desc',
      mitigation: 'fix',
    }));

    const result = await writeReports('report', issues, 'check', 'copilot', 'summary');

    expect(result.uris).toHaveLength(1);
  });

  it('encodes content as Uint8Array when writing', async () => {
    const issues: Issue[] = [
      { title: 'Issue', severity: 'Minor', description: 'desc', mitigation: 'fix' },
    ];

    await writeReports('report', issues, 'check', 'copilot', 'summary');

    const calls = (workspace.fs.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const content = calls[0][1] as Uint8Array;
    expect(content).toBeInstanceOf(Uint8Array);
  });
});
