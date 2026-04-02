import { describe, it, expect } from 'vitest';
import { detectStacks } from './stackDetector';
import type { FileInfo } from './stackDetector';

describe('detectStacks', () => {
  it('detects TypeScript from tsconfig.json', () => {
    const files: FileInfo[] = [{ path: 'tsconfig.json' }];
    expect(detectStacks(files)).toContain('TypeScript');
  });

  it('detects TypeScript from .ts files', () => {
    const files: FileInfo[] = [{ path: 'src/main.ts' }];
    expect(detectStacks(files)).toContain('TypeScript');
  });

  it('detects JavaScript from package.json', () => {
    const files: FileInfo[] = [{ path: 'package.json' }];
    expect(detectStacks(files)).toContain('JavaScript');
  });

  it('detects Vite from vite.config.ts', () => {
    const files: FileInfo[] = [{ path: 'vite.config.ts' }];
    expect(detectStacks(files)).toContain('Vite');
  });

  it('detects Vite from vite.config.js', () => {
    const files: FileInfo[] = [{ path: 'vite.config.js' }];
    expect(detectStacks(files)).toContain('Vite');
  });

  it('detects SPA from index.html with app div', () => {
    const files: FileInfo[] = [
      { path: 'index.html', content: '<div id="app"></div>' },
    ];
    expect(detectStacks(files)).toContain('SPA');
  });

  it('detects SPA from index.html with root div', () => {
    const files: FileInfo[] = [
      { path: 'index.html', content: '<div id="root"></div>' },
    ];
    expect(detectStacks(files)).toContain('SPA');
  });

  it('detects SPA from package.json with React dependency', () => {
    const files: FileInfo[] = [
      { path: 'index.html', content: '<html></html>' },
      { path: 'package.json', content: '{"dependencies":{"react":"^18.0.0"}}' },
    ];
    expect(detectStacks(files)).toContain('SPA');
  });

  it('does not detect SPA from index.html without framework or app marker', () => {
    const files: FileInfo[] = [
      { path: 'index.html', content: '<html><body>static</body></html>' },
    ];
    expect(detectStacks(files)).not.toContain('SPA');
  });

  it('detects Java from .java files', () => {
    const files: FileInfo[] = [{ path: 'src/main/java/App.java' }];
    expect(detectStacks(files)).toContain('Java');
  });

  it('detects Java from pom.xml', () => {
    const files: FileInfo[] = [{ path: 'pom.xml' }];
    expect(detectStacks(files)).toContain('Java');
  });

  it('detects Kotlin from .kt files', () => {
    const files: FileInfo[] = [{ path: 'src/main/kotlin/App.kt' }];
    expect(detectStacks(files)).toContain('Kotlin');
  });

  it('detects Kotlin from build.gradle.kts', () => {
    const files: FileInfo[] = [{ path: 'build.gradle.kts' }];
    expect(detectStacks(files)).toContain('Kotlin');
  });

  it('detects Spring Boot from application.yml with spring config', () => {
    const files: FileInfo[] = [
      {
        path: 'src/main/resources/application.yml',
        content: 'spring:\n  application:\n    name: my-app',
      },
    ];
    expect(detectStacks(files)).toContain('Spring Boot');
  });

  it('detects Spring Boot from @SpringBootApplication annotation', () => {
    const files: FileInfo[] = [
      {
        path: 'src/main/resources/application.properties',
        content: '@SpringBootApplication public class App {}',
      },
    ];
    expect(detectStacks(files)).toContain('Spring Boot');
  });

  it('does not detect Spring Boot when only file pattern matches but no content', () => {
    // application.yml exists but has no spring content
    const files: FileInfo[] = [
      { path: 'src/main/resources/application.yml', content: 'server:\n  port: 8080' },
    ];
    expect(detectStacks(files)).not.toContain('Spring Boot');
  });

  it('detects Spring Security from SecurityConfig file with HttpSecurity', () => {
    const files: FileInfo[] = [
      {
        path: 'src/main/java/SecurityConfig.java',
        content: 'public class SecurityConfig { HttpSecurity http; }',
      },
    ];
    expect(detectStacks(files)).toContain('Spring Security');
  });

  it('detects JPA from @Entity annotation', () => {
    const files: FileInfo[] = [
      {
        path: 'src/main/java/User.java',
        content: '@Entity\npublic class User {}',
      },
    ];
    expect(detectStacks(files)).toContain('JPA');
  });

  it('detects JPA from @ManyToOne annotation', () => {
    const files: FileInfo[] = [
      {
        path: 'src/main/java/Order.java',
        content: '@ManyToOne\nprivate User user;',
      },
    ];
    expect(detectStacks(files)).toContain('JPA');
  });

  it('returns empty array for empty file list', () => {
    expect(detectStacks([])).toEqual([]);
  });

  it('detects multiple stacks simultaneously', () => {
    const files: FileInfo[] = [
      { path: 'tsconfig.json' },
      { path: 'vite.config.ts' },
      { path: 'package.json' },
      { path: 'index.html', content: '<div id="root"></div>' },
    ];
    const stacks = detectStacks(files);
    expect(stacks).toContain('TypeScript');
    expect(stacks).toContain('Vite');
    expect(stacks).toContain('SPA');
  });
});
