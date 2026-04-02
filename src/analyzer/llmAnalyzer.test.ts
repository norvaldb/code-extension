import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage, parseResponse } from './llmAnalyzer';
import type { ProjectContext } from '../types';

const SPRING_CONTEXT: ProjectContext = {
  fileTree: 'src/\n  main/\n    java/\n      App.java',
  keyFiles: [{ path: 'src/main/java/App.java', content: '@SpringBootApplication\npublic class App {}' }],
  detectedStacks: ['Java', 'Spring Boot', 'Spring Security', 'JPA'],
};

const TS_CONTEXT: ProjectContext = {
  fileTree: 'src/\n  main.ts\nvite.config.ts',
  keyFiles: [{ path: 'src/main.ts', content: 'const x: any = {};' }],
  detectedStacks: ['TypeScript', 'Vite', 'SPA'],
};

const VALID_RESPONSE = JSON.stringify({
  summary: 'Several issues detected.',
  issues: [
    {
      title: 'SQL Injection',
      severity: 'Critical',
      description: 'Raw SQL concatenation.',
      location: 'src/Repo.java:10',
      codeExample: 'query + userId',
      mitigation: 'Use prepared statements.',
      mitigationExample: 'query = ?',
    },
    {
      title: 'Magic number',
      severity: 'Minor',
      description: 'Inline number 30000.',
      mitigation: 'Extract to constant.',
    },
  ],
});

describe('buildSystemPrompt', () => {
  it('includes Spring Boot issue patterns for Spring Boot stack', () => {
    const prompt = buildSystemPrompt(['Spring Boot']);
    expect(prompt).toContain('@Transactional');
    expect(prompt).toContain('Actuator');
  });

  it('includes Spring Security issue patterns', () => {
    const prompt = buildSystemPrompt(['Spring Security']);
    expect(prompt).toContain('CSRF');
    expect(prompt).toContain('CORS');
  });

  it('includes JPA issue patterns', () => {
    const prompt = buildSystemPrompt(['JPA']);
    expect(prompt).toContain('N+1');
    expect(prompt).toContain('EntityGraph');
  });

  it('includes TypeScript issue patterns', () => {
    const prompt = buildSystemPrompt(['TypeScript']);
    expect(prompt).toContain('any');
    expect(prompt).toContain('strict null');
  });

  it('includes Vite issue patterns', () => {
    const prompt = buildSystemPrompt(['Vite']);
    expect(prompt).toContain('source map');
  });

  it('includes SPA issue patterns', () => {
    const prompt = buildSystemPrompt(['SPA']);
    expect(prompt).toContain('XSS');
    expect(prompt).toContain('localStorage');
  });

  it('includes clean code patterns regardless of stack', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('Single Responsibility');
    expect(prompt).toContain('magic number');
    expect(prompt).toContain('dead code');
  });

  it('includes JSON schema instructions', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"issues"');
    expect(prompt).toContain('"severity"');
  });

  it('instructs to return only JSON', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt.toLowerCase()).toContain('only a valid json');
  });
});

describe('buildUserMessage', () => {
  it('includes the user prompt', () => {
    const msg = buildUserMessage('check for sql injection', SPRING_CONTEXT);
    expect(msg).toContain('check for sql injection');
  });

  it('includes detected stacks', () => {
    const msg = buildUserMessage('analyze security', SPRING_CONTEXT);
    expect(msg).toContain('Java');
    expect(msg).toContain('Spring Boot');
    expect(msg).toContain('JPA');
  });

  it('includes the file tree', () => {
    const msg = buildUserMessage('analyze', SPRING_CONTEXT);
    expect(msg).toContain('App.java');
  });

  it('includes key file contents', () => {
    const msg = buildUserMessage('analyze', SPRING_CONTEXT);
    expect(msg).toContain('@SpringBootApplication');
  });

  it('includes TypeScript-related stacks', () => {
    const msg = buildUserMessage('analyze', TS_CONTEXT);
    expect(msg).toContain('TypeScript');
    expect(msg).toContain('Vite');
  });

  it('shows "No specific framework detected" when stacks is empty', () => {
    const emptyContext: ProjectContext = { ...SPRING_CONTEXT, detectedStacks: [] };
    const msg = buildUserMessage('analyze', emptyContext);
    expect(msg).toContain('No specific framework detected');
  });
});

describe('parseResponse', () => {
  it('parses a valid JSON response', () => {
    const result = parseResponse(VALID_RESPONSE);
    expect(result.summary).toBe('Several issues detected.');
    expect(result.issues).toHaveLength(2);
  });

  it('sorts issues: Critical before Minor', () => {
    const response = JSON.stringify({
      summary: 'test',
      issues: [
        { title: 'Minor one', severity: 'Minor', description: 'd', mitigation: 'm' },
        { title: 'Critical one', severity: 'Critical', description: 'd', mitigation: 'm' },
      ],
    });
    const result = parseResponse(response);
    expect(result.issues[0].severity).toBe('Critical');
    expect(result.issues[1].severity).toBe('Minor');
  });

  it('sorts: Critical > Major > Minor', () => {
    const response = JSON.stringify({
      summary: 'test',
      issues: [
        { title: 'Minor', severity: 'Minor', description: 'd', mitigation: 'm' },
        { title: 'Major', severity: 'Major', description: 'd', mitigation: 'm' },
        { title: 'Critical', severity: 'Critical', description: 'd', mitigation: 'm' },
      ],
    });
    const result = parseResponse(response);
    expect(result.issues.map((i) => i.severity)).toEqual(['Critical', 'Major', 'Minor']);
  });

  it('strips leading code fence before parsing', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const result = parseResponse(wrapped);
    expect(result.issues).toHaveLength(2);
  });

  it('strips code fence without language tag', () => {
    const wrapped = '```\n' + VALID_RESPONSE + '\n```';
    const result = parseResponse(wrapped);
    expect(result.issues).toHaveLength(2);
  });

  it('caps issues at 20', () => {
    const manyIssues = Array.from({ length: 25 }, (_, i) => ({
      title: `Issue ${i}`,
      severity: 'Minor',
      description: 'd',
      mitigation: 'm',
    }));
    const response = JSON.stringify({ summary: 'many', issues: manyIssues });
    const result = parseResponse(response);
    expect(result.issues).toHaveLength(20);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseResponse('not json at all')).toThrow();
  });

  it('throws when issues field is missing', () => {
    expect(() => parseResponse(JSON.stringify({ summary: 'x' }))).toThrow();
  });

  it('throws when summary field is missing', () => {
    expect(() => parseResponse(JSON.stringify({ issues: [] }))).toThrow();
  });
});
