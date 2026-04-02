import * as vscode from 'vscode';
import { createParticipantHandler } from './participant';

export function activate(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant(
    'analyze-project.analyzer',
    createParticipantHandler()
  );
  participant.iconPath = new vscode.ThemeIcon('search');
  context.subscriptions.push(participant);
}

export function deactivate(): void {}
