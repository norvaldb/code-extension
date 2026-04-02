import * as vscode from 'vscode';
import type { Issue, LLMProvider } from '../types';
import { formatIssues } from './formatter';

const ISSUES_PER_FILE = 10;

export interface WriteResult {
  uris: vscode.Uri[];
  fileNames: string[];
}

export async function writeReports(
  baseName: string,
  issues: Issue[],
  prompt: string,
  provider: LLMProvider,
  summary: string
): Promise<WriteResult> {
  const workspaceUri = getWorkspaceUri();
  const uris: vscode.Uri[] = [];
  const fileNames: string[] = [];

  if (issues.length <= ISSUES_PER_FILE) {
    const content = formatIssues(issues, { prompt, provider, summary });
    const fileName = `${baseName}.md`;
    const uri = vscode.Uri.joinPath(workspaceUri, fileName);
    await vscode.workspace.fs.writeFile(uri, encode(content));
    uris.push(uri);
    fileNames.push(fileName);
  } else {
    const part1 = issues.slice(0, ISSUES_PER_FILE);
    const part2 = issues.slice(ISSUES_PER_FILE, ISSUES_PER_FILE * 2);

    const content1 = formatIssues(part1, { prompt, provider, summary, partLabel: 'Part 1' });
    const fileName1 = `${baseName}-part1.md`;
    const uri1 = vscode.Uri.joinPath(workspaceUri, fileName1);
    await vscode.workspace.fs.writeFile(uri1, encode(content1));
    uris.push(uri1);
    fileNames.push(fileName1);

    const content2 = formatIssues(part2, {
      prompt,
      provider,
      summary,
      partLabel: 'Part 2 — Address Part 1 issues first',
    });
    const fileName2 = `${baseName}-part2.md`;
    const uri2 = vscode.Uri.joinPath(workspaceUri, fileName2);
    await vscode.workspace.fs.writeFile(uri2, encode(content2));
    uris.push(uri2);
    fileNames.push(fileName2);
  }

  return { uris, fileNames };
}

function getWorkspaceUri(): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder open');
  }
  return folders[0].uri;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
