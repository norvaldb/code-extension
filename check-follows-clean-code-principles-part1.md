# Project Analysis: Check that this follows clean code principles (Part 1)
*Generated: 2026-04-02 | Provider: copilot*

> **Note:** After mitigating the Critical and Major issues found in this report,
> run `@analyze-project` again to discover additional issues in your project.

## Summary
The project is generally structured and typed, but several maintainability and correctness concerns remain: budget handling in file scanning is inaccurate for UTF-8, stack detection can produce false positives due to broad cross-file content checks, LLM response parsing relies on unsafe casting with incomplete schema validation, and responsibilities/configuration are duplicated across sources. There are also smaller clean-code issues such as long multi-parameter functions, platform-sensitive path handling, and overly broad technology heuristics that may reduce analysis quality.

---
## 🟠 Major Issues

### 1. Content budget uses character count instead of byte count

**Severity:** Major
**Location:** `src/analyzer/projectScanner.ts`

**Description:** The scanner enforces `contentBudgetBytes` but decrements using `content.length` (UTF-16 code units), not actual bytes. For multibyte characters, this can exceed the configured byte budget and produce inconsistent truncation behavior.

**Problematic Code:**
```
if (content.length > budget) {
  const safeBudget = findSafeBoundary(content, budget);
  ...
} else {
  results.push({ path: vscode.workspace.asRelativePath(uri), content });
  budget -= content.length;
}
```

**Mitigation:** Track and compare byte length using the original `bytes.length` (or `Buffer.byteLength(content, 'utf8')`) so budget logic matches configuration semantics.

**Corrected Code:**
```typescript
const byteLength = bytes.length;
if (byteLength > budget) {
  const safeBoundary = findSafeBoundaryByBytes(content, budget);
  ...
  budget = 0;
} else {
  results.push({ path: vscode.workspace.asRelativePath(uri), content });
  budget -= byteLength;
}
```

---

### 2. Stack content matching is not scoped to matching files

**Severity:** Major
**Location:** `src/analyzer/stackDetector.ts`

**Description:** After any file matches `filePatterns`, content patterns are checked against all files. This can incorrectly detect a stack when unrelated files contain matching text.

**Problematic Code:**
```typescript
const matchesByContent = files.some(
  (f) =>
    f.content !== undefined &&
    contentPatterns.some((pattern) => pattern.test(f.content as string))
);
```

**Mitigation:** Apply content pattern checks only to files that also match that rule's `filePatterns` (or to explicitly intended files such as config files).

**Corrected Code:**
```typescript
const candidateFiles = files.filter((f) =>
  rule.filePatterns.some((pattern) => pattern.test(f.path))
);
const matchesByContent = candidateFiles.some(
  (f) => f.content !== undefined && contentPatterns.some((p) => p.test(f.content))
);
```

---

### 3. LLM response schema validation is incomplete

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts`

**Description:** Parsing only checks for object shape with `summary` and `issues` array, then force-casts to `AnalysisResult`. Invalid issue entries or unknown severities can pass through and break sorting/formatting behavior.

**Problematic Code:**
```typescript
const result = parsed as AnalysisResult;
const sorted = [...result.issues].sort(
  (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
);
```

**Mitigation:** Perform strict runtime validation for `summary` type, each issue field, and severity enum before casting/using values.

**Corrected Code:**
```
if (typeof obj.summary !== 'string') throw new Error('Invalid summary');
for (const issue of obj.issues) {
  if (!['Critical', 'Major', 'Minor'].includes(issue.severity)) {
    throw new Error('Invalid severity');
  }
}
```

---

### 4. Default analysis rules are duplicated across code and extension configuration

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts`

**Description:** Stack and clean-code patterns exist both in `package.json` contribution defaults and in `llmAnalyzer.ts` fallback constants. This creates a drift risk where behavior diverges depending on source of truth.

**Problematic Code:**
```typescript
const STACK_ISSUE_PATTERNS: Record<SupportedStack, string[]> = { ... };
const CLEAN_CODE_PATTERNS: string[] = [ ... ];
```

**Mitigation:** Keep one authoritative definition for defaults (e.g., in `settings.ts`) and reuse it in both runtime settings resolution and prompt generation.

**Corrected Code:**
```typescript
import { DEFAULT_STACK_ISSUE_PATTERNS, DEFAULT_CLEAN_CODE_PATTERNS } from '../config/settingsDefaults';
```

---

### 5. Report writing assumes first workspace folder in multi-root setups

**Severity:** Major
**Location:** `src/output/fileWriter.ts`

**Description:** In multi-root workspaces, reports are always written to `folders[0]`, which may not be the active project and can confuse users or place output in the wrong repository.

**Problematic Code:**
```typescript
function getWorkspaceUri(): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders;
  ...
  return folders[0].uri;
}
```

**Mitigation:** Use the active editor's workspace folder, or pass a target workspace URI from the command/participant context.

**Corrected Code:**
```typescript
const active = vscode.window.activeTextEditor?.document.uri;
const folder = active ? vscode.workspace.getWorkspaceFolder(active) : vscode.workspace.workspaceFolders?.[0];
```

---

### 6. Raw file contents are interpolated into prompt without escaping fence collisions

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts`

**Description:** File content is embedded inside markdown code fences. If a source file contains triple backticks, prompt structure can be broken, reducing reliability and enabling instruction injection into analysis context.

**Problematic Code:**
```typescript
const fileContents = context.keyFiles
  .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
  .join('\n\n');
```

**Mitigation:** Escape or transform fence sequences in content (or use a robust serialization format like JSON blocks for file payloads).

**Corrected Code:**
```typescript
const safeContent = f.content.replace(/```/g, '``\u200b`');
```

---

### 7. Scanner may process binary artifacts not excluded by defaults

**Severity:** Major
**Location:** `package.json`

**Description:** The repository includes `.vsix` binaries, but default `excludedGlobs` do not exclude `*.vsix`. Scanner attempts to decode all files as text, wasting budget and degrading analysis quality.

**Problematic Code:**
```
"analyzeProject.excludedGlobs": {
  "default": [
    "**/node_modules/**",
    "**/.git/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/target/**",
    "**/.gradle/**",
    "**/.idea/**",
    "**/*.min.js",
    "**/*.map"
  ]
}
```

**Mitigation:** Exclude packaged/binary artifacts by default and/or detect binary content before decoding.

**Corrected Code:**
```
"**/*.vsix",
"**/*.zip",
"**/*.jar"
```

---

## 🟡 Minor Issues

### 1. Unsafe type assertion bypasses narrowing

**Severity:** Minor
**Location:** `src/analyzer/stackDetector.ts`

**Description:** A cast to `string` is used where narrowing already exists. This weakens type-safety discipline and can hide future regressions.

**Problematic Code:**
```
pattern.test(f.content as string)
```

**Mitigation:** Remove the cast and rely on narrowed type in the guarded branch.

**Corrected Code:**
```
f.content !== undefined && contentPatterns.some((pattern) => pattern.test(f.content))
```

---

### 2. Function has too many parameters

**Severity:** Minor
**Location:** `src/output/fileWriter.ts`

**Description:** `writeReports` accepts five parameters, making call sites harder to read and increasing coupling.

**Problematic Code:**
```typescript
export async function writeReports(
  baseName: string,
  issues: Issue[],
  prompt: string,
  provider: LLMProvider,
  summary: string
): Promise<WriteResult> {
```

**Mitigation:** Use a parameter object to improve readability and extensibility.

**Corrected Code:**
```typescript
export async function writeReports(args: {
  baseName: string;
  issues: Issue[];
  prompt: string;
  provider: LLMProvider;
  summary: string;
}): Promise<WriteResult> { ... }
```

---

### 3. Path splitting in tree builder is delimiter-sensitive

**Severity:** Minor
**Location:** `src/analyzer/projectScanner.ts`

**Description:** Tree indentation relies on splitting with `'/'`. If relative paths contain backslashes in some environments/mocks, depth and names become incorrect.

**Problematic Code:**
```typescript
const depth = p.split('/').length - 1;
const name = p.split('/').pop() ?? p;
```

**Mitigation:** Normalize separators before splitting or use path utilities.

**Corrected Code:**
```typescript
const normalized = p.replace(/\\/g, '/');
const depth = normalized.split('/').length - 1;
```

---
