import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify } from "./auth";

let spotifyApi: SpotifyWebApi | null = null;

//Handling VS code's authentication callback
export async function handleVSCodeCallback(
  context: vscode.ExtensionContext
): Promise<SpotifyWebApi> {
  try {
    // Create a proper VS Code URI using the extension ID
    const extensionId = context.extension.id; // Gets your extension ID automatically
    const callbackUri = `${vscode.env.uriScheme}://${extensionId}/callback`;

    const api = new SpotifyWebApi({
      clientId: await context.secrets.get("clientId") as string,
      clientSecret: await context.secrets.get("clientSecret") as string,
      redirectUri: callbackUri,
    });

    // Log the configuration for debugging
    console.log("Authentication Configuration:", {
      callbackUri,
      extensionId: context.extension.id,
      uriScheme: vscode.env.uriScheme
    });

    return api;
  } catch (error:any) {
    console.error("Failed to configure Spotify API:", error);
    throw new Error(`Failed to configure Spotify API: ${error.message}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
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

  //Command: Show Now Playing
  const nowPlaying = vscode.commands.registerCommand(
    "intmo.nowPlaying",
    async () => {
      try {
        const track = await spotifyApi?.getMyCurrentPlayingTrack();
        if (track?.body && track.body.item) {
          vscode.window.showInformationMessage(
            `🎶 Now playing: ${track.body.item.name} - ${track.body.item.href}`
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

  const playPause = vscode.commands.registerCommand(
    "intmo.playPause",
    async () => {
      try {
        const playback = await spotifyApi?.getMyCurrentPlaybackState();
        if (playback?.body.is_playing) {
          await spotifyApi?.pause();
          vscode.window.showInformationMessage("⏸️ Playback paused");
        } else {
          await spotifyApi?.play();
          vscode.window.showInformationMessage("▶️ Playback started");
        }
      } catch (error) {
        vscode.window.showErrorMessage("⚠️ Failed to toggle playback.");
      }
    }
  );

  context.subscriptions.push(nowPlaying, playPause);
}

export function deactivate() {}
