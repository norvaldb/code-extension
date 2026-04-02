import { describe, it, expect } from 'vitest';
import { formatIssues } from './formatter';
import type { Issue } from '../types';

const CRITICAL_ISSUE: Issue = {
  title: 'SQL Injection vulnerability',
  severity: 'Critical',
  description: 'User input is concatenated directly into SQL query.',
  location: 'src/repo/UserRepository.java:42',
  codeExample: 'String query = "SELECT * FROM users WHERE id = " + userId;',
  mitigation: 'Use parameterized queries or prepared statements.',
  mitigationExample: 'String query = "SELECT * FROM users WHERE id = ?";',
};

const MAJOR_ISSUE: Issue = {
  title: 'God class detected',
  severity: 'Major',
  description: 'UserService has 1200 lines and handles 15 distinct responsibilities.',
  mitigation: 'Extract cohesive groups of methods into dedicated service classes.',
};

const MINOR_ISSUE: Issue = {
  title: 'Magic number in timeout config',
  severity: 'Minor',
  description: 'Timeout value 30000 is used inline without a named constant.',
  mitigation: 'Extract to a named constant: CONNECTION_TIMEOUT_MS = 30_000.',
};

describe('formatIssues', () => {
  const baseOptions = {
    prompt: 'analyze security vulnerabilities',
    provider: 'copilot' as const,
    summary: 'Several critical security and clean code issues were identified.',
  };

  it('includes the analysis title', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('# Project Analysis:');
    expect(output).toContain('analyze security vulnerabilities');
  });

  it('includes generated date and provider', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toMatch(/Generated: \d{4}-\d{2}-\d{2}/);
    expect(output).toContain('copilot');
  });

  it('includes the summary section', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('## Summary');
    expect(output).toContain('Several critical security');
  });

  it('includes the run-again note', () => {
    const output = formatIssues([MAJOR_ISSUE], baseOptions);
    expect(output).toContain('@analyze-project');
    expect(output).toContain('again to discover additional issues');
  });

  it('renders Critical section header', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('Critical Issues');
  });

  it('renders Major section header', () => {
    const output = formatIssues([MAJOR_ISSUE], baseOptions);
    expect(output).toContain('Major Issues');
  });

  it('renders Minor section header', () => {
    const output = formatIssues([MINOR_ISSUE], baseOptions);
    expect(output).toContain('Minor Issues');
  });

  it('skips section headers for empty severity groups', () => {
    const output = formatIssues([MINOR_ISSUE], baseOptions);
    expect(output).not.toContain('Critical Issues');
    expect(output).not.toContain('Major Issues');
  });

  it('renders issue title', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('SQL Injection vulnerability');
  });

  it('renders issue location', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('src/repo/UserRepository.java:42');
  });

  it('renders issue description', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('User input is concatenated directly into SQL query');
  });

  it('renders code example in fenced block', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('```');
    expect(output).toContain('SELECT * FROM users WHERE id = " + userId');
  });

  it('renders mitigation text', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('Use parameterized queries');
  });

  it('renders mitigation code example', () => {
    const output = formatIssues([CRITICAL_ISSUE], baseOptions);
    expect(output).toContain('SELECT * FROM users WHERE id = ?');
  });

  it('omits location when not provided', () => {
    const output = formatIssues([MAJOR_ISSUE], baseOptions);
    expect(output).not.toContain('**Location:**');
  });

  it('omits code example section when not provided', () => {
    const output = formatIssues([MAJOR_ISSUE], baseOptions);
    expect(output).not.toContain('Problematic Code');
  });

  it('renders all three severity sections when all present', () => {
    const output = formatIssues([CRITICAL_ISSUE, MAJOR_ISSUE, MINOR_ISSUE], baseOptions);
    expect(output).toContain('Critical Issues');
    expect(output).toContain('Major Issues');
    expect(output).toContain('Minor Issues');
  });

  it('includes part label when provided', () => {
    const output = formatIssues([CRITICAL_ISSUE], { ...baseOptions, partLabel: 'Part 1' });
    expect(output).toContain('Part 1');
  });

  it('uses claude provider label', () => {
    const output = formatIssues([MINOR_ISSUE], { ...baseOptions, provider: 'claude' });
    expect(output).toContain('claude');
  });

  it('numbers issues sequentially within a severity group', () => {
    const issue2: Issue = { ...CRITICAL_ISSUE, title: 'Second critical issue' };
    const output = formatIssues([CRITICAL_ISSUE, issue2], baseOptions);
    expect(output).toContain('### 1.');
    expect(output).toContain('### 2.');
  });

  it('truncates long prompt in title', () => {
    const longPrompt = 'analyze all security vulnerabilities and clean code issues across the entire application';
    const output = formatIssues([MINOR_ISSUE], { ...baseOptions, prompt: longPrompt });
    const titleLine = output.split('\n').find((l) => l.startsWith('# Project Analysis:'));
    expect(titleLine).toBeDefined();
    // Title should not contain the full long prompt verbatim
    expect((titleLine as string).length).toBeLessThan(120);
  });
});
