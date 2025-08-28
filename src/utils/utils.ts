import * as vscode from 'vscode';

export class MiniplayerPanel{

    public static currentPanel:MiniplayerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;

    public static createOrShow(extentionUri: vscode.Uri){
        const column = vscode.ViewColumn.Two;

        //If we already have a pane;, reveal it
        if(MiniplayerPanel.currentPanel){
            MiniplayerPanel.currentPanel._panel.reveal(column);
            return;
        }
    }
}