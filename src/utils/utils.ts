import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { withTokenRefresh } from "../auth";

let spotifyApi: SpotifyWebApi | null = null;

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
              () => spotifyApi.getMyCurrentPlaybackState()
            );
            if (state?.body.is_playing) {
              await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi.pause());
            } else {
              spotifyApi?.play();
            }
            break;
          case "nextTrack":
            await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi.skipToNext());
            break;
          case "previousTrack":
            await withTokenRefresh(vscode.getExtensionContext(), spotifyApi, ()=>spotifyApi.skipToNext());
            break;
        }
        //Update track info after each action.
        await updateTrackInfo();
      } catch (error) {}
    });
  }

  public dispose() {
    MiniplayerPanel.currentPanel = undefined;
    this._panel.dispose();
  }

  public updateTrack(track: any) {
    try {
        if(!spotifyApi){
            throw new Error("Spotify API is not initialized");
        }
    } catch (error:any) {
        console.error("Mini player command error: ", error);
        vscode.window.showErrorMessage("Failed to execute command: ", error.message);
    }
    this._panel.webview.postMessage({
      command: "updateTrack",
      track,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
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

    const script = `
            <script>
                const vscode = acquireVsCodeApi();

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
                            document.getElementById("info").textContent = track.artists.join(", ");
                            document.getElementById("cover").src = track.albumArt;
                        }
                    });
            </script>
        `;

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8">${style}</head>
            <body>
                <h2 id="title">🎵 Spotify Mini Player</h2>
                <img id="cover" src="" alt="Album Art"/>
                <div id="info"></div>
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
  const state: any = await spotifyApi?.getMyCurrentPlayingTrack();
  if (!state?.body || !state?.body.item) {
    return;
  }
  // const item = state.body.item;
  // let artist = "";
  //       if ("artists" in item && Array.isArray((item as any).artists)) {
  //         artist = truncate(
  //           (item as any).artists
  //             .map((a: { name: string }) => a.name)
  //             .join(", "),
  //           30
  //         );
  //     }
  const track = {
    name: state.body.item.name,
    artists: state.body.item.artists.map((a: any) => a.name),
    albumArt: state.body.item.album.images[0]?.url || "",
  };

  if (MiniplayerPanel.currentPanel) {
    MiniplayerPanel.currentPanel.updateTrack(track);
  }
}
