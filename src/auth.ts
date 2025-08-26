import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { handleVSCodeCallback } from "./extension";

export async function authenticateSpotify(
  context: vscode.ExtensionContext
): Promise<SpotifyWebApi> {
  const spotifyApi = await handleVSCodeCallback(context);

  // Log the redirect URI for verification
  console.log("Using Redirect URI:", spotifyApi.getRedirectURI());

  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ];

  // Generate a random state parameter
  const state = Math.random().toString(36).substring(7);
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state);

  // Show clearer instructions to the user
  await vscode.window.showInformationMessage(
    "You will be redirected to Spotify. After authorizing, copy the entire URL from your browser's address bar.",
    "Continue"
  );

  // Open in external browser instead of VS Code's built-in browser
  const browser = await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

  if (!browser) {
    throw new Error("Failed to open browser for authentication");
  }

  // Improved input box with clearer instructions
  const result = await vscode.window.showInputBox({
    prompt:
      "After authorizing in your browser, paste the complete URL from your browser's address bar",
    placeHolder: "https://vscode://local-dev.intmo/callback?code=...",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Please paste the callback URL";
      }
      if (!value.includes("code=")) {
        return "Invalid URL. Make sure to copy the complete URL after authorization";
      }
      return null;
    },
  });

  if (!result) {
    throw new Error("Authentication cancelled");
  }

  try {
    // Extract code from URL
    const code = new URL(result).searchParams.get("code");
    if (!code) {
      throw new Error("No authorization code found in callback URL");
    }

    // Validate state parameter if needed
    const returnedState = new URL(result).searchParams.get("state");
    if (returnedState !== state) {
      throw new Error("State mismatch. Please try again.");
    }

    const data = await spotifyApi.authorizationCodeGrant(code);

    // Store tokens
    await context.secrets.store("spotifyAccessToken", data.body.access_token);
    await context.secrets.store("spotifyRefreshToken", data.body.refresh_token);

    spotifyApi.setAccessToken(data.body.access_token);
    spotifyApi.setRefreshToken(data.body.refresh_token);

    await vscode.window.showInformationMessage(
      "Successfully authenticated with Spotify!"
    );
    return spotifyApi;
  } catch (error: any) {
    console.error("Authentication error:", error);
    await vscode.window.showErrorMessage(
      `Failed to authenticate with Spotify: ${error.message}. Please try again.`
    );
    throw error;
  }
}
