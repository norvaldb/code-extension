# Project Analysis: Check that this follows clean code principles
*Generated: 2026-04-02 | Provider: copilot*

> **Note:** After mitigating the Critical and Major issues found in this report,
> run `@analyze-project` again to discover additional issues in your project.

## Summary
The codebase demonstrates solid TypeScript practices with strict mode enabled and good test coverage. However, several architectural and clean code issues exist: the LLM analyzer's system prompt construction is repetitive and difficult to maintain, error handling in file reading silently fails without logging, the project scanner's budget truncation approach could lose important context, and the stack detection logic could benefit from better abstraction. Additionally, some functions exceed recommended complexity thresholds, and there are missing validations on user inputs and LLM responses.

---
## 🟠 Major Issues

### 1. Silent exception swallowing in file reading

**Severity:** Major
**Location:** `src/analyzer/projectScanner.ts:57-59`

**Description:** In projectScanner.ts, the readFiles function catches all errors with an empty catch block and silently skips unreadable files. This makes debugging difficult and hides real issues like permission errors, disk failures, or file encoding problems. Users won't know why certain files weren't analyzed.

**Problematic Code:**
```
  } catch {
      // Skip unreadable files (binaries, permission errors)
    }
```

**Mitigation:** Log warnings for files that fail to read, or at minimum track skipped files so users can understand why analysis may be incomplete.

**Corrected Code:**
```
  } catch (error) {
      console.warn(`Failed to read file ${uri.fsPath}:`, error instanceof Error ? error.message : 'unknown error');
    }
```

---

### 2. Magic numbers and strings scattered throughout codebase

**Severity:** Major
**Location:** `src/analyzer/projectScanner.ts:5, src/output/nameGenerator.ts:1, src/analyzer/llmAnalyzer.ts:3`

**Description:** Multiple hardcoded magic values without explanation: CONTENT_BUDGET_BYTES (60_000 bytes), MAX_LENGTH (35 characters), PRIORITY_PATTERNS array, EXCLUDED_DIRS string, and severity order mappings. These values lack context and are difficult to tune or understand.

**Problematic Code:**
```typescript
const CONTENT_BUDGET_BYTES = 60_000;
const MAX_LENGTH = 35;
const SEVERITY_ORDER = { Critical: 0, Major: 1, Minor: 2 };
```

**Mitigation:** Document magic numbers with explanatory comments or move them to a configuration constants file with clear naming that explains their purpose.

**Corrected Code:**
```
// Maximum content size in bytes before truncation to optimize LLM token usage
const CONTENT_BUDGET_BYTES = 60_000;
// Maximum filename length for generated analysis reports
const MAX_FILENAME_LENGTH = 35;
```

---

### 3. Repetitive stack-specific issue patterns create maintenance burden

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts:12-77`

**Description:** In llmAnalyzer.ts, the STACK_ISSUE_PATTERNS object contains hardcoded strings for each stack type. This creates a large, repetitive structure that's difficult to maintain, extend with new stacks, or update when patterns change. Changes require modifying code in multiple places.

**Problematic Code:**
```typescript
const STACK_ISSUE_PATTERNS: Record<SupportedStack, string[]> = {
  TypeScript: [
    'Overuse of `any` type — disables type safety',
    // ... 4 more patterns
  ],
  JavaScript: [
    'Missing `.catch()` or `try/catch` on Promise chains',
    // ... 4 more patterns
  ],
  // ... 7 more stacks
};
```

**Mitigation:** Extract patterns to external configuration files (JSON or YAML) or load them from a structured database. This separates concerns and makes updating patterns easier without code changes.

**Corrected Code:**
```
// Load from external config or database
const STACK_ISSUE_PATTERNS = await loadStackPatterns('config/patterns.json');
```

---

### 4. Unclear file truncation behavior loses project context

**Severity:** Major
**Location:** `src/analyzer/projectScanner.ts:48-54`

**Description:** In projectScanner.ts readFiles(), when content exceeds remaining budget, the file is truncated at a potentially arbitrary byte boundary and '[truncated]' is appended. This truncation can break code syntax and lose critical context needed for accurate analysis. The LLM may misinterpret incomplete code.

**Problematic Code:**
```
if (content.length > budget) {
        results.push({
          path: vscode.workspace.asRelativePath(uri),
          content: content.slice(0, budget) + '\n... [truncated]',
        });
        budget = 0;
```

**Mitigation:** Implement smart truncation that respects code structure boundaries (e.g., truncate at end of line or before a closing brace) or prioritize reading smaller, more critical files first to preserve complete context.

**Corrected Code:**
```
// Truncate at last complete line boundary
const lastNewline = content.lastIndexOf('\n', budget);
const safeBudget = lastNewline > 0 ? lastNewline : budget;
results.push({
  path: vscode.workspace.asRelativePath(uri),
  content: content.slice(0, safeBudget) + '\n... [truncated]',
});
```

---

### 5. buildSystemPrompt and buildUserMessage functions not exported but used in tests

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts:170-171`

**Description:** In llmAnalyzer.ts, the functions buildSystemPrompt and buildUserMessage are declared as internal functions but are exported as named exports only at the end of the file for testing purposes. This creates confusion about their intended visibility and suggests the test architecture may be testing implementation details rather than public behavior.

**Problematic Code:**
```typescript
export { buildSystemPrompt, buildUserMessage, parseResponse };
```

**Mitigation:** Either make these functions truly internal (remove exports and refactor tests to test through public API) or document them as intentionally exported for testing. Prefer testing through the public analyzeProject function.

**Corrected Code:**
```
// If testing public behavior, remove these exports and test analyzeProject integration instead
// If they need to be tested directly, export them with documentation:
/** @internal exported for testing only */
export { buildSystemPrompt, buildUserMessage, parseResponse };
```

---

### 6. No validation of LLM response structure before parsing

**Severity:** Major
**Location:** `src/analyzer/llmAnalyzer.ts:160-167`

**Description:** In llmAnalyzer.ts, the analyzeProject function passes the LLM response directly to parseResponse without checking if it's valid JSON or has expected structure. While parseResponse does validate, there's no logging or user feedback about what the LLM actually returned before validation failed.

**Problematic Code:**
```typescript
const chunks: string[] = [];
  for await (const chunk of response.text) {
    chunks.push(chunk);
  }
  return parseResponse(chunks.join(''));
```

**Mitigation:** Log the raw response before parsing and provide better error context if parsing fails. Consider wrapping in try-catch at the call site.

**Corrected Code:**
```typescript
const rawResponse = chunks.join('');
  console.debug('LLM response:', rawResponse.substring(0, 500));
  try {
    return parseResponse(rawResponse);
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    throw new Error(`LLM response validation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
```

---

## 🟡 Minor Issues

### 1. Priority patterns in projectScanner are brittle regex array

**Severity:** Minor
**Location:** `src/analyzer/projectScanner.ts:8-27`

**Description:** In projectScanner.ts, PRIORITY_PATTERNS is a large array of regex patterns loaded into memory and matched against every file path. This approach is linear, not easily reorderable, and hard to understand the priority hierarchy without careful reading of the array order.

**Problematic Code:**
```typescript
const PRIORITY_PATTERNS: RegExp[] = [
  // Config and manifest files (highest priority)
  /package\.json$/,
  /pom\.xml$/,
  // ... 16 more patterns
```

**Mitigation:** Create a more structured priority system with explicit priority levels (e.g., tier 1, tier 2, tier 3) or use a map of pattern to priority value for clarity.

**Corrected Code:**
```typescript
interface PriorityPattern {
  pattern: RegExp;
  priority: number;
  category: string;
}

const PRIORITY_PATTERNS: PriorityPattern[] = [
  { pattern: /package\.json$/, priority: 100, category: 'config' },
  { pattern: /tsconfig\.json$/, priority: 100, category: 'config' },
  // ...
];
```

---

### 2. Unused variable in buildSlug function

**Severity:** Minor
**Location:** `src/output/nameGenerator.ts:20-29`

**Description:** In nameGenerator.ts, the buildSlug function's maxLength parameter is used in the loop condition but the loop doesn't track actual string length correctly when adding hyphens, potentially producing strings slightly longer than maxLength.

**Problematic Code:**
```typescript
function buildSlug(words: string[], maxLength: number): string {
  const parts: string[] = [];
  let length = 0;
  for (const word of words) {
    const needed = parts.length === 0 ? word.length : word.length + 1;
    if (length + needed > maxLength) break;
    parts.push(word);
    length += needed;
```

**Mitigation:** Ensure length calculation includes the hyphen separator correctly. The current logic adds 1 for hyphen but then assigns length += needed which may not track correctly.

**Corrected Code:**
```typescript
function buildSlug(words: string[], maxLength: number): string {
  const parts: string[] = [];
  let length = 0;
  for (const word of words) {
    const separator = parts.length === 0 ? '' : '-';
    const needed = word.length + separator.length;
    if (length + needed > maxLength) break;
    parts.push(word);
    length += needed;
```

---

### 3. STOP_WORDS set includes domain-specific words that may be needed

**Severity:** Minor
**Location:** `src/output/nameGenerator.ts:3-8`

**Description:** In nameGenerator.ts, the STOP_WORDS set includes 'analyze' and 'check' which are central to the user's prompt about code analysis. Filtering these out could make generated filenames less descriptive (e.g., 'security' instead of 'security-check').

**Problematic Code:**
```typescript
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those', 'please', 'analyze', 'check',
  'look', 'find', 'review', 'project',
]);
```

**Mitigation:** Remove domain-specific words like 'analyze', 'check', 'review', 'project' from stop words, or make stop words context-aware based on common analysis prompts.

**Corrected Code:**
```typescript
const STOP_WORDS = new Set([
  // Generic stop words only
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those', 'please',
]);
```

---

### 4. Missing input validation on userPrompt parameter

**Severity:** Minor
**Location:** `src/analyzer/llmAnalyzer.ts:151`

**Description:** In llmAnalyzer.ts, the analyzeProject function accepts a userPrompt string without validation. If empty or malicious strings are passed, they directly get interpolated into the system message sent to the LLM.

**Problematic Code:**
```typescript
export async function analyzeProject(
  model: vscode.LanguageModelChat,
  userPrompt: string,
  context: ProjectContext,
  token: vscode.CancellationToken
): Promise<AnalysisResult> {
```

**Mitigation:** Validate that userPrompt is non-empty and optionally sanitize it to prevent prompt injection attacks.

**Corrected Code:**
```typescript
export async function analyzeProject(
  model: vscode.LanguageModelChat,
  userPrompt: string,
  context: ProjectContext,
  token: vscode.CancellationToken
): Promise<AnalysisResult> {
  if (!userPrompt || userPrompt.trim().length === 0) {
    throw new Error('userPrompt cannot be empty');
  }
```

---
