import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { withTokenRefresh } from "../auth";

let spotifyApi: SpotifyWebApi | null = null;
let extensionContext:vscode.ExtensionContext;

// Hlper function to store the extension context
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
}

export class MiniplayerPanel {
  public static currentPanel: MiniplayerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  public static createOrShow(extentionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Two;

    //If we already have a pane;, reveal it
    if (MiniplayerPanel.currentPanel) {
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
        localResourceRoots: [vscode.Uri.joinPath(extentionUri, "media")],
      }
    );
    MiniplayerPanel.currentPanel = new MiniplayerPanel(panel, extentionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    //Initial HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    //Handle disposal
    this._panel.onDidDispose(() => this.dispose(), null, []);

    //Listen for control actinos
    this._panel.webview.onDidReceiveMessage(async (message) => {
      try {
        if (!spotifyApi) {
          throw new Error("Spotify API not initialiazed");
        }

        switch (message.command) {
          case "playPause":
            const state = await withTokenRefresh(
              vscode.getExtenstionContext(),
              spotifyApi,
              () => spotifyApi!.getMyCurrentPlaybackState()
            );
            if (state?.body.is_playing) {
              await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi!.pause());
            } else {
              spotifyApi?.play();
            }
            break;
          case "nextTrack":
            await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi!.skipToNext());
            break;
          case "previousTrack":
            await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi!.skipToNext());
            break;
        }
        //Update track info after each action.
        await updateTrackInfo();
      } catch (error:any) {
        console.error("Mini player command error: ", error);
        vscode.window.showErrorMessage("Failed to execute command: ", error.message);
      }
    });
  }

  public dispose() {
    MiniplayerPanel.currentPanel = undefined;
    this._panel.dispose();
  }

  public updateTrack(track: any) {
    this._panel.webview.postMessage({
      command: "updateTrack",
      track,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const style = `
        // ...existing styles...
        .loading {
            color: #666;
            font-style: italic;
        }
        .error {
            color: #ff0033;
        }
    `;

    const script = `
        <script>
            const vscode = acquireVsCodeApi();
            let isPlaying = false;

            document.getElementById("playPause").addEventListener("click", () => {
                vscode.postMessage({ command: "playPause" });
            });
            document.getElementById("next").addEventListener("click", () => {
                vscode.postMessage({ command: "nextTrack" });
            });
            document.getElementById("prev").addEventListener("click", () => {
                vscode.postMessage({ command: "previousTrack" });
            });

            window.addEventListener("message", event => {
                const { command, track } = event.data;
                if (command === "updateTrack") {
                    document.getElementById("title").textContent = track.name;
                    document.getElementById("info").textContent = 
                        track.artists.length ? track.artists.join(", ") : "No artist info";
                    document.getElementById("cover").src = 
                        track.albumArt || "default-album-art.png";
                    document.getElementById("cover").style.display = 
                        track.albumArt ? "block" : "none";
                }
            });
        </script>
    `;

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            ${style}
        </head>
        <body>
            <h2 id="title" class="loading">Loading...</h2>
            <img id="cover" src="" alt="Album Art" style="display: none"/>
            <div id="info" class="loading">Connecting to Spotify...</div>
            <div class="controls">
                <button id="prev">⏮️</button>
                <button id="playPause">⏯️</button>
                <button id="next">⏭️</button>
            </div>
            ${script}
        </body>
        </html>
    `;
}
}

export async function updateTrackInfo() {
    try {
        if (!spotifyApi) {
            throw new Error('Spotify API not initialized');
        }

        const state:any = await withTokenRefresh(
            vscode.getExtensionContext(),
            spotifyApi,
            () => spotifyApi!.getMyCurrentPlayingTrack()
        );

        if (!state?.body || !state?.body.item) {
            if (MiniplayerPanel.currentPanel) {
                MiniplayerPanel.currentPanel.updateTrack({
                    name: 'No track playing',
                    artists: [''],
                    albumArt: ''
                });
            }
            return;
        }

        const track = {
            name: state.body.item.name,
            artists: state.body.item.artists.map((a: any) => a.name),
            albumArt: state.body.item.album.images[0]?.url || ""
        };

        if (MiniplayerPanel.currentPanel) {
            MiniplayerPanel.currentPanel.updateTrack(track);
        }
    } catch (error:any) {
        console.error('Update track info error:', error);
        vscode.window.showErrorMessage(`Failed to update track info: ${error.message}`);
    }
}

//A helper function to store the Spotify API
export function setSpotifyApi(api: SpotifyWebApi){
    spotifyApi = api;
}
