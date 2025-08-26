import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {


	console.log('Congratulations, your extension "intmo" is now active!');

	
	const disposable = vscode.commands.registerCommand('intmo.helloWorld', () => {
		
		vscode.window.showInformationMessage('Hello World from intmo!');
	});

	context.subscriptions.push(disposable);
}


export function deactivate() {}
