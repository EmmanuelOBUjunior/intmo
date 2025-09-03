import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify, withTokenRefresh } from "./auth";
import { MiniplayerPanel, setSpotifyApi, setExtensionContext, updateTrackInfo, ensureActiveDevice } from "./utils/utils";

let spotifyApi: SpotifyWebApi | null = null;
let statusBarItem: vscode.StatusBarItem;
let statusBarPlayPause: vscode.StatusBarItem;
let statusBarNext: vscode.StatusBarItem;
let statusBarPrevious: vscode.StatusBarItem;
let statusBarTrack: vscode.StatusBarItem;

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

//Helper function to truncate song to 30 characters
export function truncate(text: string, maxLength: 30): string {
  return text.length > maxLength
    ? text.substring(0, maxLength - 1) + "..."
    : text;
}

//Search songs, artsists, playlists
async function searchSpotify(context: vscode.ExtensionContext) {
  try {
    //Check for active devices
    const devices = await withTokenRefresh(context, spotifyApi!, () =>
      spotifyApi!.getMyDevices()
    );

    if (!devices.body.devices.length) {
      vscode.window.showErrorMessage(
        "No Spotify devices found. Please open Spotify on any device."
      );
      return;
    }

    //If no active device, let user pick one
    let activeDevice = devices.body.devices.find((d) => d.is_active);
    if (!activeDevice && devices.body.devices.length > 0) {
      const deviceChoice: any = await vscode.window.showQuickPick(
        devices.body.devices.map((d) => ({
          label: d.name,
          description: d.type,
          id: d.id,
        })),
        { placeHolder: "Select a Sporify device to use" }
      );
      if (!deviceChoice) {
        return;
      }

      //Transfer playpack to selected device
      await withTokenRefresh(context, spotifyApi!, () =>
        spotifyApi!.transferMyPlayback([deviceChoice.id])
      );
    }

    const query = await vscode.window.showInputBox({
      prompt: "Search Spotify (song, artist, playlist)",
    });
    if (!query) {
      return;
    }

    const data = await spotifyApi?.search(
      query,
      ["track", "artist", "playlist"],
      { limit: 5 }
    );
    console.log("Data from search: ", data);
    const items: {
      label: string;
      description: string;
      uri: string;
      type: string;
    }[] = [];

    if (data?.body.tracks?.items) {
      data.body.tracks.items.forEach((t) => {
        items.push({
          label: `🎵 ${t.name}`,
          description: t.artists.map((a) => a.name).join(","),
          uri: t.uri,
          type: t?.type,
        });
      });
    }

    if (data?.body.artists?.items) {
      data.body.artists.items.forEach((a) => {
        items.push({
          label: `👤 ${a.name}`,
          description: `Artist`,
          uri: a.uri,
          type: a?.type,
        });
      });
    }

    if (data?.body.playlists?.items) {
      data.body.playlists.items.forEach((p) => {
        items.push({
          label: `📂 ${p?.name}`,
          description: "Playlist",
          uri: p?.uri,
          type: p?.type,
        });
      });
    }

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: "Select to play",
    });
    if (pick) {
      //Handle different types of playbacks
      try {
        switch (pick.type) {
          case "track":
            await withTokenRefresh(context, spotifyApi!, () =>
              spotifyApi!.play({ uris: [pick.uri] })
            );
            break;
          case "artist":
          case "playlist":
            await withTokenRefresh(context, spotifyApi!, () =>
              spotifyApi!.play({ context_uri: pick.uri })
            );
            break;
        }
        updateTrackInfo();
        vscode.window.showInformationMessage(`Now playing: ${pick.label}`);
      } catch (error) {
        console.error("Playback error: ", error);
        vscode.window.showErrorMessage(`Failed to play ${pick.label}`);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage("⚠️ Search failed");
    console.error(error);
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

    //Store both the APO instance and context
    setSpotifyApi(spotifyApi!);
    setExtensionContext(context);

    //Helper function to make context available
    // vscode.extensions.getExtension('local-dev.intomo')!.exports.getExtensionContext = ()=> context;

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

    statusBarTrack = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBarTrack.text = "🎵 Not Playing";
    statusBarTrack.tooltip = "Current Song";
    statusBarTrack.show();

    context.subscriptions.push(
      statusBarNext,
      statusBarPlayPause,
      statusBarPrevious,
      statusBarItem,
      statusBarTrack
    );

    async function updateStatusBar() {
      try {
        if (statusBarItem) {
          statusBarItem.dispose();
        }
        const track = await withTokenRefresh(context, spotifyApi!, () => {
          return spotifyApi!.getMyCurrentPlayingTrack();
        });
        if (track?.body?.item) {
          const item = track.body.item;
          let song = truncate(item.name, 30);
          let artist = "";
          if ("artists" in item && Array.isArray((item as any).artists)) {
            artist = truncate(
              (item as any).artists
                .map((a: { name: string }) => a.name)
                .join(", "),
              30
            );
          } else if ("show" in item && item.show && item.show.name) {
            artist = truncate(item.show.name, 30);
          }
          const isPlaying = track.body.is_playing;

          statusBarPlayPause.text = isPlaying ? `$(debug-pause)` : `$(play)`;
          statusBarPlayPause.tooltip = `${
            isPlaying ? "Pause" : "Play"
          }: ${song}${artist ? " - " + artist : ""}`;

          statusBarTrack.text = `🎵 ${song} - ${artist}`;
          statusBarTrack.tooltip = `🎵 ${song} by ${artist}`;
        } else {
          statusBarPlayPause.text = "$(circle-slash)";
          statusBarPlayPause.text = "Nothing Playing";

          statusBarPlayPause.text = "🎵 Not Playing";
          statusBarPlayPause.text = "Spotify idle";
        }
        statusBarPrevious.show();
        statusBarPlayPause.show();
        statusBarNext.show();
        statusBarTrack.show();
      } catch (error) {
        statusBarPlayPause.text = "$(alert)";
        statusBarPlayPause.tooltip = "Spotify: Error fetching playback";

        statusBarTrack.text = "⚠️ Error";
        statusBarTrack.tooltip = "Could not fetch current track";
      }
    }

    updateStatusBar();
    setInterval(updateStatusBar, 1000); //Update every 1.5 seconds

    //Command: Show Now Playing
    const nowPlaying = vscode.commands.registerCommand(
      "intmo.nowPlaying",
      async () => {
        try {
          if (!spotifyApi) {
            throw new Error("Spotify API not initialized");
          }

          //Check for active devices first
          const hasDevice = await ensureActiveDevice(context);
          if(!hasDevice){
            return;
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
            updateTrackInfo();
            updateStatusBar();
          } else {
            const hasActiveDevice = await ensureActiveDevice(context);
            if(hasActiveDevice){
              vscode.window.showInformationMessage(
                "No track is currently playing."
              );
            }
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
          //Check for active devices first
          const hasDevice = await ensureActiveDevice(context);
          if(!hasDevice){
            return;
          }
          

          const playback = await withTokenRefresh(context, spotifyApi!, () =>
            spotifyApi!.getMyCurrentPlaybackState()
          );
          // const playback = await spotifyApi?.getMyCurrentPlaybackState();
          if (playback?.body.is_playing) {
            await spotifyApi?.pause();
            vscode.window.showInformationMessage("⏸️ Playback paused");
            updateStatusBar();
            updateTrackInfo();
          } else {
            await spotifyApi?.play();
            vscode.window.showInformationMessage("▶️ Playback resumed");
            updateStatusBar();
            updateTrackInfo();
          }
        } catch (error) {
          vscode.window.showErrorMessage("⚠️ Failed to toggle playback.");
        }
      }
    );

    //Command: Skip to Next Track
    const nextTrack = vscode.commands.registerCommand(
      "intmo.nextTrack",
      async () => {
        try {
          await spotifyApi?.skipToNext();
          vscode.window.showInformationMessage("⏭️ Skipped to next track");
          updateStatusBar();
          updateTrackInfo();
        } catch (error) {
          vscode.window.showErrorMessage("⚠️ Failed to skip track.");
        }
      }
    );

    const previousTrack = vscode.commands.registerCommand(
      "intmo.previousTrack",
      async () => {
        try {
          await spotifyApi?.skipToPrevious();
          vscode.window.showInformationMessage(
            "⏮️ Went back to previous track"
          );
          updateStatusBar();
          updateTrackInfo();
        } catch (error) {
          vscode.window.showErrorMessage("⚠️ Failed to go to previous track");
        }
      }
    );

    const searchOnSpotify = vscode.commands.registerCommand(
      "intmo.searchSpotify",
      searchSpotify
    );

    const openMiniPlayer = vscode.commands.registerCommand(
      "intmo.openMiniPlayer",
      () => {
        MiniplayerPanel.createOrShow(context.extensionUri);
      }
    );
    context.subscriptions.push(
      nowPlaying,
      playPause,
      nextTrack,
      previousTrack,
      searchOnSpotify,
      openMiniPlayer
    );
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
  statusBarTrack?.dispose();
}
