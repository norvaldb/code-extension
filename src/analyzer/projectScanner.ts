import * as vscode from 'vscode';
import type { KeyFile, ProjectContext } from '../types';
import { detectStacks } from './stackDetector';
import { getAnalyzeProjectSettings } from '../config/settings';
import { appendWarning } from '../logging/outputChannel';

export async function scanProject(): Promise<ProjectContext> {
  const settings = getAnalyzeProjectSettings();
  const excludePattern = buildExcludePattern(settings.excludedGlobs);
  const uris = await vscode.workspace.findFiles('**/*', excludePattern, settings.maxScannedFiles);

  const relativePaths = uris
    .map((uri) => vscode.workspace.asRelativePath(uri))
    .sort();

  const fileTree = buildFileTree(relativePaths);

  const prioritized = prioritizeFiles(uris, settings.priorityPatterns);
  const keyFiles = await readFiles(prioritized, settings.contentBudgetBytes);

  const allFileInfos = keyFiles.map((kf) => ({ path: kf.path, content: kf.content }));
  const detectedStacks = detectStacks(allFileInfos);

  return { fileTree, keyFiles, detectedStacks };
}

function buildFileTree(paths: string[]): string {
  const lines: string[] = [];
  for (const p of paths) {
    const normalized = p.replace(/\\/g, '/');
    const depth = normalized.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const name = normalized.split('/').pop() ?? normalized;
    lines.push(`${indent}${name}`);
  }
  return lines.join('\n');
}

function prioritizeFiles(uris: vscode.Uri[], patterns: RegExp[]): vscode.Uri[] {
  const priority: vscode.Uri[] = [];
  const rest: vscode.Uri[] = [];

  for (const uri of uris) {
    const rel = vscode.workspace.asRelativePath(uri);
    if (patterns.some((p) => p.test(rel))) {
      priority.push(uri);
    } else {
      rest.push(uri);
    }
  }

  return [...priority, ...rest];
}

async function readFiles(uris: vscode.Uri[], contentBudgetBytes: number): Promise<KeyFile[]> {
  const results: KeyFile[] = [];
  let budget = contentBudgetBytes;
  let skippedFiles = 0;

  for (const uri of uris) {
    if (budget <= 0) break;

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(bytes);

      if (content.length > budget) {
        const safeBudget = findSafeBoundary(content, budget);
        results.push({
          path: vscode.workspace.asRelativePath(uri),
          content: content.slice(0, safeBudget) + '\n... [truncated]',
        });
        budget = 0;
      } else {
        results.push({ path: vscode.workspace.asRelativePath(uri), content });
        budget -= content.length;
      }
    } catch (error) {
      skippedFiles += 1;
      appendWarning(
        `Failed to read file ${uri.fsPath}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (skippedFiles > 0) {
    appendWarning(`Project scan skipped ${skippedFiles} unreadable file(s).`);
  }

  return results;
}

function buildExcludePattern(globs: string[]): string | undefined {
  if (globs.length === 0) return undefined;
  return `{${globs.join(',')}}`;
}

function findSafeBoundary(content: string, budget: number): number {
  const bounded = Math.max(0, Math.min(budget, content.length));
  if (bounded === 0) return 0;
  const lastNewline = content.lastIndexOf('\n', bounded);
  return lastNewline > 0 ? lastNewline : bounded;
}
