import * as vscode from "vscode";
import SpotifyWebApi from "spotify-web-api-node";
import { handleVSCodeCallback } from "./extension";

export async function authenticateSpotify(context: vscode.ExtensionContext): Promise<SpotifyWebApi> {
    const spotifyApi = await handleVSCodeCallback(context);
    
    // Log the redirect URI for verification
    console.log('Using Redirect URI:', spotifyApi.getRedirectURI());

    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing'
    ];

    const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, 'state123');
    
    // Show the user what's happening
    vscode.window.showInformationMessage('Please sign in to Spotify in your browser');
    await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

    const result = await vscode.window.showInputBox({
        prompt: "Please paste the full callback URL from your browser",
        ignoreFocusOut: true
    });

    if (!result) {
        throw new Error('Authentication cancelled');
    }

    try {
        const code = new URL(result).searchParams.get('code');
        if (!code) {
            throw new Error('No authorization code found in callback URL');
        }

        const data = await spotifyApi.authorizationCodeGrant(code);

        await context.secrets.store('spotifyAccessToken', data.body.access_token);
        await context.secrets.store('spotifyRefreshToken', data.body.refresh_token);

        spotifyApi.setAccessToken(data.body.access_token);
        spotifyApi.setRefreshToken(data.body.refresh_token);

        vscode.window.showInformationMessage('Successfully authenticated with Spotify!');
        return spotifyApi;
    } catch (error) {
        console.error('Authentication error:', error);
        vscode.window.showErrorMessage('Failed to authenticate with Spotify');
        throw error;
    }
}