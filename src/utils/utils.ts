import * as vscode from 'vscode';

export class MiniplayerPanel{

    public static currentPanel:MiniplayerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;

    public static createOrShow(extentionUri: vscode.Uri){

    }
}