export type Severity = 'Critical' | 'Major' | 'Minor';

export type LLMProvider = 'copilot' | 'claude';

export type SupportedStack =
  | 'TypeScript'
  | 'JavaScript'
  | 'Java'
  | 'Kotlin'
  | 'Spring Boot'
  | 'Spring Security'
  | 'JPA'
  | 'Vite'
  | 'SPA';

export interface Issue {
  title: string;
  severity: Severity;
  description: string;
  location?: string;
  codeExample?: string;
  mitigation: string;
  mitigationExample?: string;
}

export interface KeyFile {
  path: string;
  content: string;
}

export interface ProjectContext {
  fileTree: string;
  keyFiles: KeyFile[];
  detectedStacks: SupportedStack[];
}

export interface AnalysisResult {
  summary: string;
  issues: Issue[];
}
