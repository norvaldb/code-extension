import { vi } from 'vitest';

const workspace = {
  workspaceFolders: [
    {
      uri: { fsPath: '/workspace', toString: (): string => 'file:///workspace' },
      name: 'workspace',
      index: 0,
    },
  ],
  findFiles: vi.fn().mockResolvedValue([]),
  fs: {
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockImplementation((key: string) => {
      const defaults: Record<string, string> = {
        llmProvider: 'copilot',
        copilotModel: 'gpt-4o',
      };
      return defaults[key];
    }),
  }),
};

const Uri = {
  joinPath: vi.fn().mockImplementation(
    (base: { toString: () => string }, ...segments: string[]) => ({
      fsPath: [base.fsPath ?? '/workspace', ...segments].join('/'),
      toString: (): string => ['file:///workspace', ...segments].join('/'),
    })
  ),
  file: vi.fn().mockImplementation((path: string) => ({
    fsPath: path,
    toString: (): string => `file://${path}`,
  })),
};

const lm = {
  selectChatModels: vi.fn().mockResolvedValue([]),
};

const chat = {
  createChatParticipant: vi.fn().mockReturnValue({
    iconPath: undefined,
    dispose: vi.fn(),
  }),
};

const ThemeIcon = vi.fn().mockImplementation((id: string) => ({ id }));

const window = {
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
};

const LanguageModelChatMessage = {
  User: vi.fn().mockImplementation((content: string) => ({ role: 'user', content })),
  Assistant: vi.fn().mockImplementation((content: string) => ({ role: 'assistant', content })),
};

export {
  workspace,
  Uri,
  lm,
  chat,
  ThemeIcon,
  window,
  LanguageModelChatMessage,
};
