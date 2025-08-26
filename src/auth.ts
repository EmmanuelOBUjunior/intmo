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

  // Generate a random state parameter
  const state = Math.random().toString(36).substring(7);
  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state);

  // Create a promise that will resolve when we get the callback
  const callbackPromise = new Promise<string>((resolve, reject) => {
    // const disposable = vscode.window.registerUriHandler({
    //   handleUri(uri: vscode.Uri) {
    //     disposable.dispose(); // Clean up the handler
    //     resolve(uri.toString());
    //   },
    // });

    const disposable = vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        console.log("Raw callback URI received:", uri.toString());

        try {
          

          console.log("URI Components: ", {
            scheme: uri.scheme,
            authority: uri.authority,
            path: uri.path,
            query: uri.query,
          });

          // First try to get code directly from the query
          const directParams = new URLSearchParams(uri.query);
          const directCode = directParams.get("code");

          // Fix the query string format if needed
          // const fixedQuery = decodedQuery
          //     .replace(/%20/g, ' ')
          //     .replace(/%3D/g, '=')
          //     .replace(/%26/g, '&');

          if (directCode) {
            console.log("Found code directly in query");
            resolve(uri.toString());
            disposable.dispose();
            return;
          }

          // Decode the URI components properly
            const decodedQuery = decodeURIComponent(uri.query);
            console.log("Decoded query:", decodedQuery);

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
          console.error("Error processing callback URI:", error);
          reject(error);
        } finally {
          disposable.dispose();
        }
      },
    });

    // Clean up if authentication is cancelled
    setTimeout(() => {
      disposable.dispose();
    }, 300000); // 5 minute timeout
  });

  // Show instructions and open browser
  await vscode.window.showInformationMessage(
    "You will be redirected to Spotify. Please authorize the application.",
    "Continue"
  );

  await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

  try {
    // Wait for the callback URL
    const callbackUrl = await callbackPromise;
    const url = new URL(callbackUrl);

    // Extract code from URL
    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("No authorization code found in callback URL");
    }

    // Validate state parameter
    const returnedState = url.searchParams.get("state");
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
