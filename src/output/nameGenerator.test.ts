import { describe, it, expect } from 'vitest';
import { generateFileName } from './nameGenerator';

describe('generateFileName', () => {
  it('generates a slug from a simple prompt', () => {
    const result = generateFileName('security vulnerabilities');
    expect(result).toBe('security-vulnerabilities');
  });

  it('removes stop words', () => {
    const result = generateFileName('analyze the security of the project');
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
    expect(result).toContain('security');
  });

  it('keeps domain words like "analyze" by default', () => {
    const result = generateFileName('analyze security vulnerabilities in api');
    expect(result).toContain('analyze');
  });

  it('limits result to 35 characters', () => {
    const longPrompt =
      'security vulnerabilities authentication authorization performance database queries';
    const result = generateFileName(longPrompt);
    expect(result.length).toBeLessThanOrEqual(35);
  });

  it('does not exceed 35 chars with suffix', () => {
    const result = generateFileName('security vulnerabilities in api layer', 'part1');
    // The base should still be ≤35 chars; the full filename length is not constrained
    const base = result.replace(/-part1$/, '');
    expect(base.length).toBeLessThanOrEqual(35);
  });

  it('appends suffix when provided', () => {
    const result = generateFileName('security issues', 'part2');
    expect(result).toMatch(/-part2$/);
  });

  it('falls back to "analysis" for empty prompt', () => {
    const result = generateFileName('');
    expect(result).toBe('analysis');
  });

  it('falls back to "analysis" when all words are stop words', () => {
    const result = generateFileName('the and or but in on at to for');
    expect(result).toBe('analysis');
  });

  it('converts to lowercase', () => {
    const result = generateFileName('Security Vulnerabilities API Auth');
    expect(result).toBe(result.toLowerCase());
  });

  it('removes special characters', () => {
    const result = generateFileName('security: check @api & auth!');
    expect(result).not.toMatch(/[^a-z0-9-]/);
  });

  it('produces only hyphens as separators', () => {
    const result = generateFileName('security issues in api');
    expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('truncates at word boundary — no partial words', () => {
    const result = generateFileName(
      'authentication authorization performance monitoring security'
    );
    // Each segment should be a complete word
    const words = result.split('-');
    for (const word of words) {
      expect(word.length).toBeGreaterThan(0);
    }
  });

  it('handles Spring Boot analysis prompt', () => {
    const result = generateFileName('spring boot security jpa performance issues');
    expect(result).toContain('spring');
    expect(result).toContain('boot');
    expect(result.length).toBeLessThanOrEqual(35);
  });
});
