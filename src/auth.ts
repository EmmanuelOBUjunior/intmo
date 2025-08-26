
import SpotifyWebApi from "spotify-web-api-node";
import * as vscode from "vscode";


export async function authenticateSpotify(context: vscode.ExtensionContext):Promise<SpotifyWebApi | null>{
    const spotifyApi = new SpotifyWebApi({
        clientId: context.globalState.get('clientId') as string || 'beb08f57785a4e62822687a9913c6420',
        clientSecret: context.globalState.get('clientSecret') as string || '73af6bf1e6674c73b36c05a2a660f5f8',
        redirectUri: context.globalState.get('redirectUri') as string || 'http://192.168.0.178:8888/callback'
    });
    return;
}