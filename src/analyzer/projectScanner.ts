import * as vscode from 'vscode';
import type { KeyFile, ProjectContext } from '../types';
import { detectStacks } from './stackDetector';

const CONTENT_BUDGET_BYTES = 60_000;

const PRIORITY_PATTERNS: RegExp[] = [
  // Config and manifest files (highest priority)
  /package\.json$/,
  /pom\.xml$/,
  /build\.gradle(\.kts)?$/,
  /tsconfig(\..*)?\.json$/,
  /vite\.config\.(ts|js|mts|mjs)$/,
  /application\.(yml|yaml|properties)$/,
  /bootstrap\.(yml|yaml|properties)$/,
  /persistence\.xml$/,
  // Security and architecture
  /SecurityConfig\.(java|kt)$/,
  /WebSecurityConfig\.(java|kt)$/,
  /.*Config\.(java|kt)$/,
  // Source entry points and key structural files
  /src\/main\.(ts|js|tsx|jsx)$/,
  /src\/index\.(ts|js|tsx|jsx)$/,
  /index\.html$/,
  /.*Controller\.(java|kt)$/,
  /.*Service\.(java|kt)$/,
  /.*Repository\.(java|kt)$/,
  /.*Entity\.(java|kt)$/,
];

const EXCLUDED_DIRS =
  '**/node_modules/**,' +
  '**/.git/**,' +
  '**/out/**,' +
  '**/dist/**,' +
  '**/build/**,' +
  '**/target/**,' +
  '**/.gradle/**,' +
  '**/.idea/**,' +
  '**/*.min.js,' +
  '**/*.map';

export async function scanProject(): Promise<ProjectContext> {
  const uris = await vscode.workspace.findFiles('**/*', `{${EXCLUDED_DIRS}}`, 500);

  const relativePaths = uris
    .map((uri) => vscode.workspace.asRelativePath(uri))
    .sort();

  const fileTree = buildFileTree(relativePaths);

  const prioritized = prioritizeFiles(uris);
  const keyFiles = await readFiles(prioritized);

  const allFileInfos = keyFiles.map((kf) => ({ path: kf.path, content: kf.content }));
  const detectedStacks = detectStacks(allFileInfos);

  return { fileTree, keyFiles, detectedStacks };
}

function buildFileTree(paths: string[]): string {
  const lines: string[] = [];
  for (const p of paths) {
    const depth = p.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const name = p.split('/').pop() ?? p;
    lines.push(`${indent}${name}`);
  }
  return lines.join('\n');
}

function prioritizeFiles(uris: vscode.Uri[]): vscode.Uri[] {
  const priority: vscode.Uri[] = [];
  const rest: vscode.Uri[] = [];

  for (const uri of uris) {
    const rel = vscode.workspace.asRelativePath(uri);
    if (PRIORITY_PATTERNS.some((p) => p.test(rel))) {
      priority.push(uri);
    } else {
      rest.push(uri);
    }
  }

  return [...priority, ...rest];
}

async function readFiles(uris: vscode.Uri[]): Promise<KeyFile[]> {
  const results: KeyFile[] = [];
  let budget = CONTENT_BUDGET_BYTES;

  for (const uri of uris) {
    if (budget <= 0) break;

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(bytes);

      if (content.length > budget) {
        results.push({
          path: vscode.workspace.asRelativePath(uri),
          content: content.slice(0, budget) + '\n... [truncated]',
        });
        budget = 0;
      } else {
        results.push({ path: vscode.workspace.asRelativePath(uri), content });
        budget -= content.length;
      }
    } catch {
      // Skip unreadable files (binaries, permission errors)
    }
  }

  return results;
}
