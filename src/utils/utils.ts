import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { withTokenRefresh } from "../auth";

let spotifyApi: SpotifyWebApi | null = null;
let extensionContext: vscode.ExtensionContext;

// Helper function to store the extension context
export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

async function ensureActiveDevice(context: vscode.ExtensionContext):Promise<Boolean>{
try {
  const devices = await withTokenRefresh(context, spotifyApi!, ()=> spotifyApi!.getMyDevices());

  if(!devices.body.devices.length){
    vscode.window.showErrorMessage("No Spotify devices found. Please open Spotify on any device");
    return false;
  }
  //Check for active devices
  let activeDevice = devices.body.devices.find(d=> d.is_active);

  //If no active device, let user pick one
  if(!activeDevice && devices.body.devices.length > 0){
    const deviceChoice = await vscode.window.showQuickPick(
        devices.body.devices.map(d => ({
          label: d.name,
          description: d.type,
          id: d.id
        })),
        { placeHolder: 'Select a Spotify device to use' }
      );
  }


} catch (error) {
  
}
}

export class MiniplayerPanel {
  public static currentPanel: MiniplayerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _updateInterval: NodeJS.Timeout | undefined;

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

    // Set up webview content using the stored extensionUri
    const mediaPath = vscode.Uri.joinPath(this._extensionUri, "media");
    const webviewOptions = {
      enableScripts: true,
      localResourceRoots: [mediaPath],
    };

    //Initial HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    //Start auto-updating when panel is created
    this.startAutoUpdate();
    //Handle disposal
    this._panel.onDidDispose(
      () => {
        this.dispose();
        this.stopAutoUpdate();
      },
      null,
      []
    );

    //Listen for control actinos
    this._panel.webview.onDidReceiveMessage(async (message) => {
      try {
        if (!spotifyApi) {
          throw new Error("Spotify API not initialiazed");
        }

        switch (message.command) {
          case "playPause":
            const state = await withTokenRefresh(
              extensionContext,
              spotifyApi,
              () => spotifyApi!.getMyCurrentPlaybackState()
            );
            if (state?.body.is_playing) {
              await withTokenRefresh(extensionContext, spotifyApi, () =>
                spotifyApi!.pause()
              );
            } else {
              spotifyApi?.play();
            }
            break;
          case "nextTrack":
            await withTokenRefresh(extensionContext, spotifyApi, () =>
              spotifyApi!.skipToNext()
            );
            break;
          case "previousTrack":
            await withTokenRefresh(extensionContext, spotifyApi, () =>
              spotifyApi!.skipToNext()
            );
            break;
        }
        //Update track info after each action.
        await updateTrackInfo();
      } catch (error: any) {
        console.error("Mini player command error: ", error);
        vscode.window.showErrorMessage(
          "Failed to execute command: ",
          error.message
        );
      }
    });

    //Initial track info update
    updateTrackInfo();
  }

  private startAutoUpdate() {
    //Update every 3 seconds
    this._updateInterval = setInterval(async () => {
      await updateTrackInfo();
    }, 3000);
  }

  private stopAutoUpdate() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
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
    // Get path to media folder
    const mediaPath = vscode.Uri.joinPath(this._extensionUri, "media");
    console.log("Media Path:", mediaPath);

    // Create URIs for resources
    const defaultAlbumArt = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaPath, "default-album-art.png")
    );
    console.log("default Album art:", defaultAlbumArt);

    const style = `
            <style>
                * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .audio-player {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 30px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 25px 45px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            transition: all 0.3s ease;
        }

        .audio-player:hover {
            transform: translateY(-5px);
            box-shadow: 0 35px 55px rgba(0, 0, 0, 0.15);
        }

        .album-cover {
            width: 100%;
            height: 250px;
            border-radius: 15px;
            object-fit: cover;
            margin-bottom: 25px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease;
        }

        .album-cover:hover {
            transform: scale(1.02);
        }

        .song-info {
            text-align: center;
            margin-bottom: 25px;
        }

        .song-title {
            font-size: 1.4em;
            font-weight: bold;
            margin-bottom: 8px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .artist-name {
            font-size: 1.1em;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .album-name {
            font-size: 0.9em;
            opacity: 0.6;
        }

        .progress-container {
            margin-bottom: 20px;
        }

        .progress-bar {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            margin-bottom: 10px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .progress {
            height: 100%;
            background: linear-gradient(90deg, #4827c0ff, #1f9cbbff);
            border-radius: 3px;
            width: 0%;
            transition: width 0.1s ease;
            position: relative;
        }

        .progress::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .time-info {
            display: flex;
            justify-content: space-between;
            font-size: 0.9em;
            opacity: 0.7;
        }

        .controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
        }

        .control-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            font-size: 1.2em;
        }

        .play-pause-btn {
            width: 60px;
            height: 60px;
            font-size: 1.5em;
            background: #1724d8ff;
        }

        .control-btn:hover {
            transform: scale(1.1);
            background: rgba(255, 255, 255, 0.3);
        }

        .play-pause-btn:hover {
            background: #0a088aff;
        }
                .loading {
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
                .error {
                    color: var(--vscode-errorForeground);
                }
                #cover {
                    max-width: 200px;
                    margin: 10px 0;
                }
                .controls {
                    margin-top: 20px;
                }
            </style>
        `;

    const script = `
<script>
    const vscode = acquireVsCodeApi();
    let isPlaying = false;
    let duration = 0;
    let progress = 0;
    let timer;

    function formatTime(ms){
        const totalSec = Math.floor(ms/1000);
        const min = Math.floor(totalSec/60);
        const sec = totalSec%60;
        return min + ":" + (sec < 10 ? "0" + sec : sec);
    }

    function startTimer(){
        if(timer) clearInterval(timer);
        if(!isPlaying) return;

        timer = setInterval(()=>{
            if(progress < duration){
                progress += 1000;
                updateProgressBar();
            }
        },1000);
    } 

    function updateProgressBar() {
        const percent = (progress / duration) * 100;
        document.getElementById("progress").style.width = percent + "%";
        document.getElementById("currentTime").textContent = formatTime(progress);
    }

    // Button events
    document.getElementById("playPauseBtn").addEventListener("click", () => {
        vscode.postMessage({ command: "playPause" });
    });
    document.getElementById("nextBtn").addEventListener("click", () => {
        vscode.postMessage({ command: "nextTrack" });
    });
    document.getElementById("prevBtn").addEventListener("click", () => {
        vscode.postMessage({ command: "previousTrack" });
    });

    // Handle incoming track updates

    window.addEventListener("message", event => {
        const { command, track } = event.data;
        if (command === "updateTrack") {
            document.getElementById("songTitle").textContent = track.name;
            document.getElementById("artistName").textContent = 
                track.artists.length ? track.artists.join(", ") : "Unknown Artist";
            document.getElementById("albumName").textContent = 
                track.albumName || "Unknown Album";
            document.getElementById("albumCover").src = 
                track.albumArt || defaultAlbumArt.path;

            duration = track.durationMs;
            progress = track.progressMs;
            isPlaying = track.isPlaying;

            document.getElementById("duration").textContent = formatTime(duration);
            updateProgressBar();
            startTimer();
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
            <div>
            <img src="" 
             alt="Album Cover" class="album-cover" id="albumCover"/>

              <div class="song-info">
            <div class="song-title" id="songTitle">Loading...</div>
            <div class="artist-name" id="artistName">Connecting to Spotify...</div>
            <div class="album-name" id="albumName">Connecting...</div>
        </div>

        <div class="progress-container">
            <div class="progress-bar" id="progressBar">
                <div class="progress" id="progress"></div>
            </div>
            <div class="time-info">
                <span id="currentTime">0:00</span>
                <span id="duration">3:45</span>
            </div>
        </div>

        <div class="controls">
            <button class="control-btn" id="prevBtn">⏮</button>
            <button class="control-btn play-pause-btn" id="playPauseBtn">▶</button>
            <button class="control-btn" id="nextBtn">⏭</button>
        </div>
            </div>
            ${script}
        </body>
        </html>
    `;
  }
}

let lastTrackId: string | null = null;

export async function updateTrackInfo() {
  try {
    if (!spotifyApi) {
      throw new Error("Spotify API not initialized");
    }

    const state: any = await withTokenRefresh(
      extensionContext,
      spotifyApi,
      () => spotifyApi!.getMyCurrentPlayingTrack()
    );

    if (!state?.body || !state?.body.item) {
      if (MiniplayerPanel.currentPanel) {
        MiniplayerPanel.currentPanel.updateTrack({
          name: "No track playing",
          artists: [""],
          albumArt: "",
          album: "",
          durationMS: 0,
          progressMs: 0,
          isPlaying: false,
        });
      }
      lastTrackId = null;
      return;
    }

    //Check if the track has changed
    const currentTrackId = state.body.item.id;
    if (currentTrackId !== lastTrackId) {
      lastTrackId = currentTrackId;

      const track = {
        name: state.body.item.name,
        artists: state.body.item.artists.map((a: any) => a.name),
        albumArt: state.body.item.album.images[0]?.url || "",
        durationMs: state.body.item.duration_ms,
        albumName: state.body.item.album.name,
        progressMs: state.body.progress_ms,
        isPlaying: state.body.is_playing,
      };

      if (MiniplayerPanel.currentPanel) {
        MiniplayerPanel.currentPanel.updateTrack(track);
      }
    }
  } catch (error: any) {
    console.error("Update track info error:", error);
    vscode.window.showErrorMessage(
      `Failed to update track info: ${error.message}`
    );
  }
}

//A helper function to store the Spotify API
export function setSpotifyApi(api: SpotifyWebApi) {
  spotifyApi = api;
}
