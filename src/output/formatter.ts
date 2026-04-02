import type { Issue, LLMProvider, Severity } from '../types';

const SEVERITY_EMOJI: Record<Severity, string> = {
  Critical: '🔴',
  Major: '🟠',
  Minor: '🟡',
};

const RUN_AGAIN_NOTE =
  '> **Note:** After mitigating the Critical and Major issues found in this report,\n' +
  '> run `@analyze-project` again to discover additional issues in your project.';

export interface FormatOptions {
  prompt: string;
  provider: LLMProvider;
  summary: string;
  partLabel?: string;
}

export function formatIssues(issues: Issue[], options: FormatOptions): string {
  const { prompt, provider, summary, partLabel } = options;
  const date = new Date().toISOString().slice(0, 10);
  const title = partLabel
    ? `# Project Analysis: ${truncate(prompt, 60)} (${partLabel})`
    : `# Project Analysis: ${truncate(prompt, 60)}`;

  const sections: string[] = [
    title,
    `*Generated: ${date} | Provider: ${provider}*`,
    '',
    RUN_AGAIN_NOTE,
    '',
    `## Summary`,
    summary,
    '',
    '---',
  ];

  const bySeverity: Record<Severity, Issue[]> = {
    Critical: [],
    Major: [],
    Minor: [],
  };

  for (const issue of issues) {
    bySeverity[issue.severity].push(issue);
  }

  const severities: Severity[] = ['Critical', 'Major', 'Minor'];
  for (const severity of severities) {
    const group = bySeverity[severity];
    if (group.length === 0) continue;

    sections.push(`## ${SEVERITY_EMOJI[severity]} ${severity} Issues`);
    sections.push('');

    group.forEach((issue, idx) => {
      sections.push(formatIssue(issue, idx + 1));
    });
  }

  return sections.join('\n');
}

function formatIssue(issue: Issue, index: number): string {
  const parts: string[] = [
    `### ${index}. ${issue.title}`,
    '',
    `**Severity:** ${issue.severity}`,
  ];

  if (issue.location) {
    parts.push(`**Location:** \`${issue.location}\``);
  }

  parts.push('', `**Description:** ${issue.description}`);

  if (issue.codeExample) {
    parts.push('', '**Problematic Code:**', formatCodeBlock(issue.codeExample));
  }

  parts.push('', `**Mitigation:** ${issue.mitigation}`);

  if (issue.mitigationExample) {
    parts.push('', '**Corrected Code:**', formatCodeBlock(issue.mitigationExample));
  }

  parts.push('', '---', '');

  return parts.join('\n');
}

function formatCodeBlock(code: string): string {
  const lang = detectLanguage(code);
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function detectLanguage(code: string): string {
  if (/^\s*(import|export|const|let|var|function|class|interface|type)\b/.test(code)) {
    return 'typescript';
  }
  if (/^\s*(public|private|protected|class|interface|@)\b/.test(code)) {
    return 'java';
  }
  if (/^\s*(fun |val |var |data class|object |companion)/.test(code)) {
    return 'kotlin';
  }
  return '';
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
