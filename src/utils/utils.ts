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

        //Otherwise, we create one
        const panel = vscode.window.createWebviewPanel(
            "spotifyMiniPlayer",
            "Spotify Mini Player",
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extentionUri, 'media')]
            }
        );
        MiniplayerPanel.currentPanel = new MiniplayerPanel(panel, extentionUri);
    }

    private constructor(panel:vscode.WebviewPanel,extensionUri:vscode.Uri){
        this._panel = panel;
        this._extensionUri = extensionUri;

        //Initial HTML content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        //Handle disposal
        this._panel.onDidDispose(()=> this.dispose(), null, []);
    }

    public dispose(){
        MiniplayerPanel.currentPanel = undefined;
        this._panel.dispose();
    }

    private _getHtmlForWebview(webview:vscode.Webview):string{
        const style = `
            <style>
                body {
                    font-family: sans-serif;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                img {
                    border-radius: 8px;
                    max-width: 200px;
                }
                .controls {
                    margin-top: 10px;
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #1DB954;
                    color: white;
                }
            </style>
        `;
    }
}