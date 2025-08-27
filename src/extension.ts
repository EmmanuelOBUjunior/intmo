import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify, withTokenRefresh } from "./auth";

let spotifyApi: SpotifyWebApi | null = null;
let statusBarItem: vscode.StatusBarItem;
let statusBarPlayPause: vscode.StatusBarItem;
let statusBarNext: vscode.StatusBarItem;
let statusBarPrevious: vscode.StatusBarItem;

//Handling VS code's authentication callback
export async function handleVSCodeCallback(
  context: vscode.ExtensionContext
): Promise<SpotifyWebApi> {
  try {
    // Create a proper VS Code URI using the extension ID
    // const extensionId = context.extension.id; // Gets your extension ID automatically
    const callbackUri = `${vscode.env.uriScheme}://local-dev.intmo/callback`;

    const api = new SpotifyWebApi({
      clientId:
        ((await context.secrets.get("clientId")) as string) ||
        "beb08f57785a4e62822687a9913c6420",
      clientSecret:
        ((await context.secrets.get("clientSecret")) as string) ||
        "73af6bf1e6674c73b36c05a2a660f5f8",
      redirectUri: callbackUri,
    });

    // Log the configuration for debugging
    console.log("Authentication Configuration:", {
      callbackUri,
      extensionId: context.extension.id,
      uriScheme: vscode.env.uriScheme,
    });

    return api;
  } catch (error: any) {
    console.error("Failed to configure Spotify API:", error);
    throw new Error(`Failed to configure Spotify API: ${error.message}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  try {
    //Authenticate on activation if no tokens are stored
    const token = await context.secrets.get("spotifyAccessToken");
    const refresh = await context.secrets.get("spotifyRefreshToken");

    spotifyApi = await handleVSCodeCallback(context);

    // Add detailed logging
    console.log("Auth Configuration:", {
      redirectUri: spotifyApi.getRedirectURI(),
      hasClientId: !!spotifyApi.getClientId(),
      hasClientSecret: !!spotifyApi.getClientSecret(),
    });

    //Initialize Spotify API with stored tokens
    //   spotifyApi = new SpotifyWebApi({
    //     clientId:
    //       await context.secrets.get("clientId") as string ||
    //       "beb08f57785a4e62822687a9913c6420",
    //     clientSecret:
    //       await context.secrets.get("clientSecret") as string ||
    //       "73af6bf1e6674c73b36c05a2a660f5f8",
    //     redirectUri:
    //       await context.secrets.get("redirectUri") as string ||
    //       "http://192.168.0.178:8888/callback",
    //   });

    if (token && refresh) {
      spotifyApi.setAccessToken(token);
      spotifyApi.setRefreshToken(refresh);
    } else {
      spotifyApi = await authenticateSpotify(context);
    }

    console.log("Spotify API initialized", spotifyApi);

    // Status bar items
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    // statusBarItem.command = "intmo.playPause";
    // Add an initial loading state
    statusBarItem.text = "$(loading~spin) Connecting to Spotify...";
    // Make sure to show the status bar item immediately
    statusBarItem.show();
    statusBarPrevious = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      102
    );
    statusBarPrevious.text = "$(chevron-left)";
    statusBarPrevious.tooltip = "Previous Track";
    statusBarPrevious.command = "intmo.previousTrack";
    statusBarPrevious.show();

    statusBarPlayPause = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      102
    );
    statusBarPlayPause.text = "$(play)";
    statusBarPlayPause.tooltip = "Play/Pause";
    statusBarPlayPause.command = "intmo.playPause";
    statusBarPlayPause.show();

    statusBarNext = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      102
    );
    statusBarNext.text = "$(chevron-right)";
    statusBarNext.tooltip = "Next Track";
    statusBarNext.command = "intmo.nextTrack";
    statusBarNext.show();
    context.subscriptions.push(
      statusBarNext,
      statusBarPlayPause,
      statusBarPrevious
    );

    async function updateStatusBar() {
      try {
        if(statusBarItem){
          statusBarItem.dispose();
        }
        const track = await withTokenRefresh(context, spotifyApi!, () => {
          return spotifyApi!.getMyCurrentPlayingTrack();
        });
        if (track?.body?.item) {
          const song = track.body.item.name;
          const isPlaying = track.body.is_playing;

          statusBarPlayPause.text = isPlaying
            ? `$(play) ${song}`
            : `$(debug-pause) ${song}`;
        } else {
          statusBarPlayPause.text = "$(circle-slash)";
          statusBarPrevious.show();
          statusBarPlayPause.show();
          statusBarNext.show();
        }
      } catch (error) {
        statusBarPlayPause.text = "$(alert)";
        statusBarPlayPause.tooltip = "Spotify: Error fetching playback";
        statusBarPrevious.show();
        statusBarPlayPause.show();
        statusBarNext.show();
      }
    }

    updateStatusBar();
    setInterval(updateStatusBar, 15000); //Update every 15 seconds

    //Command: Show Now Playing
    const nowPlaying = vscode.commands.registerCommand(
      "intmo.nowPlaying",
      async () => {
        try {
          if (!spotifyApi) {
            throw new Error("Spotify API not initialized");
          }
          console.log("Fetching current playing track...");
          // await updateStatusBar();
          // vscode.window.showInformationMessage(statusBarItem.text);
              const track = await withTokenRefresh(context, spotifyApi, () =>
            spotifyApi!.getMyCurrentPlayingTrack()
          );
          // const track = await spotifyApi?.getMyCurrentPlayingTrack();
          if (track?.body && track.body.item) {
            vscode.window.showInformationMessage(
              `🎶 Now playing: ${track.body.item.name} - ${track.body.currently_playing_type}`
            );
          } else {
            vscode.window.showInformationMessage(
              "No track is currently playing."
            );
          }
        } catch (error) {
          console.error("Failed to initialize Spotify API", error);
          vscode.window.showErrorMessage(
            "⚠️ Failed to fetch Now Playing. Try logging in again."
          );
        }
      }
    );

    //Command: Play/Pause Toggle
    const playPause = vscode.commands.registerCommand(
      "intmo.playPause",
      async () => {
        try {
          const playback = await withTokenRefresh(context, spotifyApi!, () =>
            spotifyApi!.getMyCurrentPlaybackState()
          );
          // const playback = await spotifyApi?.getMyCurrentPlaybackState();
          if (playback?.body.is_playing) {
            await spotifyApi?.pause();
            vscode.window.showInformationMessage("⏸️ Playback paused");
          } else {
            await spotifyApi?.play();
            vscode.window.showInformationMessage("▶️ Playback resumed");
          }
        } catch (error) {
          vscode.window.showErrorMessage("⚠️ Failed to toggle playback.");
        }
      }
    );

    //Command: Skip to Next Track
    const nextTrack = vscode.commands.registerCommand('intmo.nextTrack', async()=>{
      try {
        await spotifyApi?.skipToNext();
        vscode.window.showInformationMessage("⏭️ Skipped to next track");
        updateStatusBar();
      } catch (error) {
        vscode.window.showErrorMessage("⚠️ Failed to skip track.");
      }
    });

    const previousTrack = vscode.commands.registerCommand('intmo.previousTrack', async()=>{
      try {
        await spotifyApi?.skipToPrevious();
        vscode.window.showInformationMessage("⏮️ Went back to previous track");
        updateStatusBar();
      } catch (error) {
        vscode.window.showErrorMessage("⚠️ Failed to go to previous track");
      }
    });


    context.subscriptions.push(nowPlaying, playPause, nextTrack, previousTrack);
  } catch (error: any) {
    console.error("Extension activation error:", error);
    vscode.window.showErrorMessage(
      `Failed to initialize Spotify extension: ${error.message}`
    );
  }
}

export function deactivate() {
  statusBarNext?.dispose();
  statusBarPrevious?.dispose();
  statusBarPlayPause?.dispose();
}
