import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Analyze Project');
  }
  return channel;
}

export function appendWarning(message: string): void {
  getChannel().appendLine(`[warn] ${message}`);
}
