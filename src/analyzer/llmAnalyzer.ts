import * as vscode from 'vscode';
import type { AnalysisResult, ProjectContext, SupportedStack } from '../types';

const SEVERITY_ORDER = { Critical: 0, Major: 1, Minor: 2 } as const;

const STACK_ISSUE_PATTERNS: Record<SupportedStack, string[]> = {
  TypeScript: [
    'Overuse of `any` type — disables type safety',
    'Unsafe type assertions with `as` that bypass narrowing',
    'Missing strict null checks — potential runtime crashes',
    'Implicit `any` in generic parameters or function signatures',
    'Returning `any` from functions that have known return types',
  ],
  JavaScript: [
    'Missing `.catch()` or `try/catch` on Promise chains',
    'Use of `eval()` — code injection risk',
    'Loose equality (`==`) instead of strict (`===`)',
    'Prototype pollution via unvalidated object merges',
    'Global variable leaks from missing `const`/`let`/`var`',
  ],
  'Spring Boot': [
    'Missing `@Transactional` on service methods that perform multiple writes',
    'N+1 query problems from lazy-loaded collections without JOIN FETCH',
    'Actuator endpoints exposed without authentication',
    'Exception handlers that expose internal stack traces to clients',
    'Missing input validation on REST controller parameters',
  ],
  'Spring Security': [
    'CSRF protection disabled without documented justification',
    'Overly permissive CORS configuration (allowedOrigins = "*")',
    'Hardcoded credentials or secrets in configuration files',
    'Missing method-level security (`@PreAuthorize`) on sensitive operations',
    'Insecure JWT validation — missing signature verification or expiry checks',
    'HTTP sessions not properly invalidated on logout',
  ],
  JPA: [
    'N+1 query problem — missing `@EntityGraph` or `JOIN FETCH` on collections',
    'LazyInitializationException risk — accessing lazy collections outside transaction',
    'Missing database indexes on frequently queried foreign key columns',
    'Inappropriate `CascadeType.ALL` or `CascadeType.REMOVE` on relationships',
    'Cartesian product queries from multiple `JOIN FETCH` on different collections',
    'Mutable entity state shared across transactions',
  ],
  Vite: [
    'source map exposure: source maps enabled in production builds exposes original source code',
    'missing Content Security Policy configuration',
    'large dependencies not code-split — slow initial page load',
    'environment variables with sensitive data prefixed with VITE_ (exposed to browser)',
  ],
  SPA: [
    'XSS via `innerHTML` or `dangerouslySetInnerHTML` with unescaped user input',
    'API tokens or secrets stored in `localStorage` (accessible to XSS)',
    'Missing CSRF token on state-changing API calls',
    'Client-side route guards only — missing server-side authorization checks',
    'Insecure direct object references — user-controlled IDs without authorization check',
  ],
  Java: [
    'Swallowed exceptions — `catch (Exception e) {}` with no logging or rethrow',
    'Resource leaks — streams or connections not closed in `finally` or `try-with-resources`',
    'Mutable shared state accessed from multiple threads without synchronization',
    'String concatenation in loops — use `StringBuilder` instead',
    'Missing `@NonNull`/`@Nullable` annotations on public API boundaries',
  ],
  Kotlin: [
    'Unsafe non-null assertion `!!` without prior null check',
    'Blocking calls (`Thread.sleep`, blocking IO) on coroutine main dispatcher',
    'Missing `@NonNull`/`@Nullable` annotations on Java interop boundaries',
    'Coroutine scope leaks — launching coroutines without proper lifecycle binding',
  ],
};

const CLEAN_CODE_PATTERNS: string[] = [
  'Single Responsibility violations — classes or functions doing more than one thing',
  'long methods exceeding 20 lines of logic — candidate for extraction',
  'deep nesting exceeding 3 levels — consider early returns or extracted conditions',
  'god classes — large classes with too many responsibilities',
  'magic numbers or magic strings — should be named constants',
  'duplicated logic (DRY violations) — copy-paste code that should be extracted',
  'misleading or unclear naming — variables, methods, or classes that do not reveal intent',
  'functions with more than 3 parameters — consider a parameter object',
  'unexpected side effects in methods that appear to be pure queries',
  'missing abstraction — implementation details leaking across architectural layers',
  'dead code — unreachable branches or unused methods',
];

function buildSystemPrompt(stacks: SupportedStack[]): string {
  const stackPatterns = stacks.flatMap((s) => STACK_ISSUE_PATTERNS[s] ?? []);

  return `You are an expert code reviewer with deep knowledge of software quality, security, and clean code principles.

Analyze the provided project thoroughly and identify up to 20 issues.

## Issue categories to look for

### Stack-specific issues (based on detected technologies)
${stackPatterns.map((p) => `- ${p}`).join('\n')}

### Clean code principles (apply to all code)
${CLEAN_CODE_PATTERNS.map((p) => `- ${p}`).join('\n')}

## Output format

Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must match this schema exactly:
{
  "summary": "<one paragraph summarizing the main quality concerns found>",
  "issues": [
    {
      "title": "<short descriptive title>",
      "severity": "Critical" | "Major" | "Minor",
      "description": "<detailed explanation of the problem and why it matters>",
      "location": "<relative/file/path.ts:lineNumber or relative/file/path.ts> (optional)",
      "codeExample": "<snippet of the problematic code from the project> (optional)",
      "mitigation": "<clear actionable explanation of how to fix the issue>",
      "mitigationExample": "<corrected code snippet> (optional)"
    }
  ]
}

## Severity guidelines
- Critical: Security vulnerability, data loss risk, or crash-level bug
- Major: Significant performance problem, clean code violation affecting maintainability, or likely bug
- Minor: Style issue, minor inefficiency, or improvement opportunity

## Rules
- Return a maximum of 20 issues
- Sort issues by severity: Critical first, then Major, then Minor
- Use actual code from the project files in codeExample and mitigationExample where possible
- Be specific — reference file names and line numbers where identifiable
- Do not invent issues not evidenced by the provided code`;
}

function buildUserMessage(userPrompt: string, context: ProjectContext): string {
  const stackList =
    context.detectedStacks.length > 0
      ? context.detectedStacks.join(', ')
      : 'No specific framework detected';

  const fileContents = context.keyFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return `## Analysis request
${userPrompt}

## Detected technology stacks
${stackList}

## Project file tree
\`\`\`
${context.fileTree}
\`\`\`

## Key file contents
${fileContents}`;
}

function parseResponse(raw: string): AnalysisResult {
  // Strip code fences if the model wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('summary' in parsed) ||
    !('issues' in parsed) ||
    !Array.isArray((parsed as Record<string, unknown>).issues)
  ) {
    throw new Error('LLM response did not match expected schema');
  }

  const result = parsed as AnalysisResult;

  const sorted = [...result.issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return { summary: result.summary, issues: sorted.slice(0, 20) };
}

export async function analyzeProject(
  model: vscode.LanguageModelChat,
  userPrompt: string,
  context: ProjectContext,
  token: vscode.CancellationToken
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(context.detectedStacks);
  const userMessage = buildUserMessage(userPrompt, context);

  const messages = [
    vscode.LanguageModelChatMessage.User(systemPrompt),
    vscode.LanguageModelChatMessage.User(userMessage),
  ];

  const response = await model.sendRequest(messages, {}, token);

  const chunks: string[] = [];
  for await (const chunk of response.text) {
    chunks.push(chunk);
  }

  return parseResponse(chunks.join(''));
}

export { buildSystemPrompt, buildUserMessage, parseResponse };
