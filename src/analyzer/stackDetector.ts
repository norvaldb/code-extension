import type { SupportedStack } from '../types';

interface DetectionRule {
  stack: SupportedStack;
  filePatterns: RegExp[];
  contentPatterns?: RegExp[];
}

const DETECTION_RULES: DetectionRule[] = [
  {
    stack: 'TypeScript',
    filePatterns: [/tsconfig\.json$/, /\.tsx?$/],
  },
  {
    stack: 'JavaScript',
    filePatterns: [/package\.json$/, /\.jsx?$/, /\.mjs$/, /\.cjs$/],
  },
  {
    stack: 'Vite',
    filePatterns: [/vite\.config\.(ts|js|mts|mjs)$/],
  },
  {
    stack: 'SPA',
    filePatterns: [/^index\.html$/, /\/index\.html$/],
    contentPatterns: [/<div\s+id=["']app["']/, /<div\s+id=["']root["']/],
  },
  {
    stack: 'Java',
    filePatterns: [/\.java$/, /pom\.xml$/, /build\.gradle$/],
  },
  {
    stack: 'Kotlin',
    filePatterns: [/\.kt$/, /\.kts$/, /build\.gradle\.kts$/],
  },
  {
    stack: 'Spring Boot',
    filePatterns: [/application\.(yml|yaml|properties)$/, /bootstrap\.(yml|yaml|properties)$/],
    contentPatterns: [
      /@SpringBootApplication/,
      /spring\.application\.name/,
      /spring:\s*\n\s+application:/,
    ],
  },
  {
    stack: 'Spring Security',
    filePatterns: [/SecurityConfig\.(java|kt)$/, /WebSecurityConfig\.(java|kt)$/],
    contentPatterns: [
      /@EnableWebSecurity/,
      /SecurityFilterChain/,
      /WebSecurityConfigurerAdapter/,
      /HttpSecurity/,
    ],
  },
  {
    stack: 'JPA',
    filePatterns: [/persistence\.xml$/, /\.java$/, /\.kt$/],
    contentPatterns: [/@Entity\b/, /@Repository\b/, /@ManyToOne/, /@OneToMany/, /@ManyToMany/],
  },
];

export interface FileInfo {
  path: string;
  content?: string;
}

export function detectStacks(files: FileInfo[]): SupportedStack[] {
  const detected = new Set<SupportedStack>();

  for (const rule of DETECTION_RULES) {
    const matchesByFile = files.some((f) =>
      rule.filePatterns.some((pattern) => pattern.test(f.path))
    );

    if (matchesByFile) {
      if (!rule.contentPatterns) {
        detected.add(rule.stack);
        continue;
      }

      const contentPatterns = rule.contentPatterns;
      const matchesByContent = files.some((f) => {
        if (f.content === undefined) {
          return false;
        }
        return contentPatterns.some((pattern) => pattern.test(f.content!));
      });

      if (matchesByContent) {
        detected.add(rule.stack);
      }
    }
  }

  // SPA detection: index.html present + JS framework dependency
  if (!detected.has('SPA')) {
    const hasIndexHtml = files.some((f) => /index\.html$/.test(f.path));
    const hasJsFramework = files.some(
      (f) =>
        f.path.endsWith('package.json') &&
        f.content !== undefined &&
        /"(react|vue|svelte|angular|solid-js)"/.test(f.content)
    );
    if (hasIndexHtml && hasJsFramework) {
      detected.add('SPA');
    }
  }

  return Array.from(detected);
}
