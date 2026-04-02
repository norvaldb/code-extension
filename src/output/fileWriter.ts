import { TextEncoder } from 'node:util';
import * as vscode from 'vscode';
import type { Issue, LLMProvider } from '../types';
import { formatIssues } from './formatter';
import { getAnalyzeProjectSettings } from '../config/settings';

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
  const settings = getAnalyzeProjectSettings();
  const issuesPerFile = settings.issuesPerFile;
  const workspaceUri = getWorkspaceUri();
  const uris: vscode.Uri[] = [];
  const fileNames: string[] = [];

  if (issues.length <= issuesPerFile) {
    const content = formatIssues(issues, { prompt, provider, summary });
    const fileName = `${baseName}.md`;
    const uri = vscode.Uri.joinPath(workspaceUri, fileName);
    await vscode.workspace.fs.writeFile(uri, encode(content));
    uris.push(uri);
    fileNames.push(fileName);
  } else {
    const chunks = chunkIssues(issues, issuesPerFile);
    for (let i = 0; i < chunks.length; i += 1) {
      const partNumber = i + 1;
      const partLabel =
        partNumber === 1
          ? 'Part 1'
          : `Part ${partNumber} - Address Part ${partNumber - 1} issues first`;

      const content = formatIssues(chunks[i], {
        prompt,
        provider,
        summary,
        partLabel,
      });

      const fileName = `${baseName}-part${partNumber}.md`;
      const uri = vscode.Uri.joinPath(workspaceUri, fileName);
      await vscode.workspace.fs.writeFile(uri, encode(content));
      uris.push(uri);
      fileNames.push(fileName);
    }
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

function chunkIssues(issues: Issue[], size: number): Issue[][] {
  const chunks: Issue[][] = [];
  for (let i = 0; i < issues.length; i += size) {
    chunks.push(issues.slice(i, i + size));
  }
  return chunks;
}
