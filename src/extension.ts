import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify } from "./auth";

let spotifyApi: SpotifyWebApi | null = null;

export async function activate(context: vscode.ExtensionContext) {
  //Authenticate on activation if no tokens are stored
  const token = await context.secrets.get("spotifyAccessToken");
  const refresh = await context.secrets.get("spotifyRefreshToken");

  //Initialize Spotify API with stored tokens
  spotifyApi = new SpotifyWebApi({
    clientId:
      await context.secrets.get("clientId") as string ||
      "beb08f57785a4e62822687a9913c6420",
    clientSecret:
      await context.globalState.get("clientSecret") as string ||
      "73af6bf1e6674c73b36c05a2a660f5f8",
    redirectUri:
      await context.globalState.get("redirectUri") as string ||
      "http://192.168.0.178:8888/callback",
  });

  if(token && refresh){
	spotifyApi.setAccessToken(token);
	spotifyApi.setRefreshToken(refresh);
  }else{
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
        vscode.window.showErrorMessage("⚠️ Failed to fetch Now Playing. Try logging in again.");
      }
    }
  );

  const playPause = vscode.commands.registerCommand(
    "intmo.playPause",
    async () => {
      try {
        const playback = await spotifyApi.getMyCurrentPlaybackState();
        if (playback.body.is_playing) {
          await spotifyApi.pause();
          vscode.window.showInformationMessage("⏸️ Playback paused");
        } else {
          await spotifyApi.play();
          vscode.window.showInformationMessage("▶️ Playback started");
        }
      } catch (error) {
        vscode.window.showErrorMessage("Error toggling playback");
      }
    }
  );

  context.subscriptions.push(nowPlaying, playPause);
}

export function deactivate() {}
