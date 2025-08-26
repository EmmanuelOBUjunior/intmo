import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { handleVSCodeCallback } from "./extension";

interface CallbackResult {
  code: string;
  state: string;
}

// Add this function to handle token refresh
export async function refreshTokens(
  spotifyApi: SpotifyWebApi,
  context: vscode.ExtensionContext
): Promise<boolean> {
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body.access_token);
    
    // Store the new access token
    await context.secrets.store("spotifyAccessToken", data.body.access_token);
    
    // If a new refresh token is provided, store it too
    if (data.body.refresh_token) {
      spotifyApi.setRefreshToken(data.body.refresh_token);
      await context.secrets.store("spotifyRefreshToken", data.body.refresh_token);
    }
    
    return true;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return false;
  }
}

export async function authenticateSpotify(
  context: vscode.ExtensionContext
): Promise<SpotifyWebApi> {
  const spotifyApi = await handleVSCodeCallback(context);

  //Check for existing tokens
  const accessToken = await context.secrets.get("spotifyAccessToken");
  const refreshToken = await context.secrets.get("spotifyRefreshToken");

  //If we have both tokens, try to use them
  if(accessToken && refreshToken){
    console.log("Found existing tokens, using them to authenticate...");
    spotifyApi.setAccessToken(accessToken);
    spotifyApi.setRefreshToken(refreshToken);
  }

  try {
    
  } catch (error:any) {
    if(error.statusCode === 401){
      console.log("Access token expired, refreshing....");
      const refreshed = await refreshTokens(spotifyApi, context);
    }
  }

  console.log("Starting authentication process....");
  console.log("Using Redirect URI:", spotifyApi.getRedirectURI());

  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ];

  const state = Math.random().toString(36).substring(7);
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state);

  // Create a promise that will resolve with the code and state
  const callbackPromise = new Promise<CallbackResult>((resolve, reject) => {
    const disposable = vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        console.log("Raw callback URI received:", uri.toString());

        try {
          const fullQuery = decodeURIComponent(uri.query);
          console.log("Decoded full query:", fullQuery);

          const params = new URLSearchParams(fullQuery);
          const code = params.get('code');
          const returnedState = params.get('state');

          console.log("Extracted parameters:", {
            hasCode: !!code,
            codePreview: code ? `${code.substring(0, 10)}...` : 'none',
            returnedState,
            expectedState: state,
            stateMatches: returnedState === state
          });

          if (!code) {
            reject(new Error("No authorization code found in callback URL"));
            return;
          }

          if (returnedState !== state) {
            reject(new Error("State mismatch. Please try again."));
            return;
          }

          // Resolve with both code and state
          resolve({ code, state: returnedState });
        } catch (error) {
          console.error("Error processing callback URI:", error);
          reject(error);
        } finally {
          disposable.dispose();
        }
      }
    });

    setTimeout(() => {
      disposable.dispose();
      reject(new Error("Authentication timed out"));
    }, 300000);
  });

  await vscode.window.showInformationMessage(
    "You will be redirected to Spotify. Please authorize the application.",
    "Continue"
  );

  await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

  try {
    // Wait for the callback result
    const { code } = await callbackPromise;

    const data = await spotifyApi.authorizationCodeGrant(code);

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