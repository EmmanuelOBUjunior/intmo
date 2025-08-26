import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { authenticateSpotify } from "./auth";

let spotifyApi: SpotifyWebApi | null = null;

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

// ...existing code...