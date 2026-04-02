import * as vscode from 'vscode';
import type { LLMProvider } from './types';
import { scanProject } from './analyzer/projectScanner';
import { analyzeProject } from './analyzer/llmAnalyzer';
import { generateFileName } from './output/nameGenerator';
import { writeReports } from './output/fileWriter';

async function resolveModel(
  request: vscode.ChatRequest,
  provider: LLMProvider
): Promise<vscode.LanguageModelChat | undefined> {
  if (provider === 'copilot') {
    // Use whatever model the user has selected in the chat window
    return request.model;
  }
  // For Claude, select by vendor since there's no user-selected model in the Copilot chat UI
  const models = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
  return models[0];
}

export function createParticipantHandler(): vscode.ChatRequestHandler {
  return async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    if (!vscode.workspace.workspaceFolders?.length) {
      stream.markdown('**Error:** No workspace folder is open. Please open a project first.');
      return {};
    }

    const userPrompt = request.prompt.trim();
    if (!userPrompt) {
      stream.markdown(
        'Please provide a context for the analysis.\n\n**Example:** `@analyze-project analyze security vulnerabilities in the API layer`'
      );
      return {};
    }

    try {
      stream.markdown('**Scanning project files...**\n\n');
      const projectContext = await scanProject();

      const stackList =
        projectContext.detectedStacks.length > 0
          ? projectContext.detectedStacks.join(', ')
          : 'none detected';
      stream.markdown(`Detected stacks: \`${stackList}\`\n\n`);

      const config = vscode.workspace.getConfiguration('analyzeProject');
      const provider = (config.get<string>('llmProvider') ?? 'copilot') as LLMProvider;

      const model = await resolveModel(request, provider);
      if (!model) {
        stream.markdown(
          `**Error:** No language model available for provider \`${provider}\`.\n\n` +
            'For Claude: ensure the Claude VS Code extension is installed (`analyzeProject.llmProvider: "claude"`).'
        );
        return {};
      }

      stream.markdown(`**Analyzing with** \`${model.name}\`...\n\n`);

      const result = await analyzeProject(model, userPrompt, projectContext, token);

      const criticalCount = result.issues.filter((i) => i.severity === 'Critical').length;
      const majorCount = result.issues.filter((i) => i.severity === 'Major').length;
      const minorCount = result.issues.filter((i) => i.severity === 'Minor').length;

      stream.markdown(
        `Found **${result.issues.length} issues**: ` +
          `🔴 ${criticalCount} Critical, 🟠 ${majorCount} Major, 🟡 ${minorCount} Minor\n\n`
      );

      const baseName = generateFileName(userPrompt);
      const writeResult = await writeReports(
        baseName,
        result.issues,
        userPrompt,
        provider,
        result.summary
      );

      stream.markdown('**Reports written:**\n');
      for (const uri of writeResult.uris) {
        stream.markdown(`- \`${uri.fsPath}\`\n`);
        stream.button({
          command: 'vscode.open',
          arguments: [uri],
          title: `Open ${uri.fsPath.split('/').pop()}`,
        });
      }

      stream.markdown(
        '\n\n---\n' +
          '> ⚠️ **Next step:** After mitigating the Critical and Major issues, ' +
          'run `@analyze-project` again to discover additional issues in your project.'
      );

      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stream.markdown(`**Analysis failed:** ${message}`);
      return {};
    }
  };
}
