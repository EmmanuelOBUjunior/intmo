import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { handleVSCodeCallback } from "./extension";

export async function authenticateSpotify(
  context: vscode.ExtensionContext
): Promise<SpotifyWebApi> {
  const spotifyApi = await handleVSCodeCallback(context);
  console.log("Using Redirect URI:", spotifyApi.getRedirectURI());

  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ];

  const state = Math.random().toString(36).substring(7);
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state);

  const callbackPromise = new Promise<string>((resolve, reject) => {
    const disposable = vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        console.log("Raw callback URI:", uri.toString());

        try {
          // Decode the URI components properly
          const decodedQuery = decodeURIComponent(uri.query);
          console.log("Decoded query:", decodedQuery);

          // Fix the query string format if needed
          const fixedQuery = decodedQuery
            .replace(/%20/g, " ")
            .replace(/%3D/g, "=")
            .replace(/%26/g, "&");

          // Create params from fixed query
          const params = new URLSearchParams(fixedQuery);

          const code = params.get("code");
          const returnedState = params.get("state");

          console.log("Parsed parameters:", {
            code: code ? `${code.substring(0, 5)}...` : "none",
            state: returnedState,
            expectedState: state,
            matches: returnedState === state,
          });

          if (code && returnedState === state) {
            resolve(uri.with({ query: fixedQuery }).toString());
          } else {
            reject(new Error("Invalid callback parameters"));
          }
          disposable.dispose();
        } catch (error) {
          console.error("Error parsing callback URI:", error);
          reject(error);
        }
      },
    });

    // Cleanup after timeout
    setTimeout(() => {
      disposable.dispose();
      reject(new Error("Authentication timed out"));
    }, 300000); // 5 minute timeout
  });

  // Show instructions and open browser
  await vscode.window.showInformationMessage(
    "You will be redirected to Spotify. Please authorize the application.",
    "Continue"
  );

  await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

  try {
    const callbackUrl = await callbackPromise;
    console.log("Received callback URL:", callbackUrl);

    const url = new URL(callbackUrl);
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("No authorization code found in callback URL");
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
