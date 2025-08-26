
import SpotifyWebApi from "spotify-web-api-node";
import * as vscode from "vscode";
import * as http from "http";
import { handleVSCodeCallback } from "./extension";


export async function authenticateSpotify(context: vscode.ExtensionContext):Promise<SpotifyWebApi | null>{
    const spotifyApi = await handleVSCodeCallback(context);

    
    // const spotifyApi = new SpotifyWebApi({
    //     clientId: context.globalState.get('clientId') as string || 'beb08f57785a4e62822687a9913c6420',
    //     clientSecret: context.globalState.get('clientSecret') as string || '73af6bf1e6674c73b36c05a2a660f5f8',
    //     redirectUri: context.globalState.get('redirectUri') as string || 'http://192.168.0.178:8888/callback'
    // });

    
    const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];
    const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, 'state123');

    //Handle the callback through VS code's authentication API
    const result = await vscode.window.showInputBox({
        prompt: "Please paste the callback URL from your browser after logging in to Spotify"
    });

    if(!result){
        throw new Error("Authentication cancelled");
    }

    const code = new URL(result).searchParams.get("code");
    if(!code){
        throw new Error()
    }

    //Spin up a small local server to catch the callback
    // const server = http.createServer(async(req,res)=>{
    //     if(req.url?.startsWith('/callback')){
    //         const code = new URL(req.url, 'http://192.168.0.178:8888').searchParams.get("code");
        
    //         if(code){
    //             const data = await spotifyApi.authorizationCodeGrant(code);
    //             spotifyApi.setAccessToken(data.body.access_token);
    //             spotifyApi.setRefreshToken(data.body.access_token);

    //             //Persist in secrets storage
    //             await context.secrets.store('spotifyAccessToken', data.body.access_token);
    //             await context.secrets.store('spotifyRefreshToken', data.body.refresh_token);

    //             res.end("✅ Authentication successful! You can close this tab.");
    //             server.close();
    //         }
    //     }
    // });

    // server.listen(8888);
    vscode.window.showInformationMessage("🗝️ Logging into Spotify...");

    await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

    return spotifyApi;
}