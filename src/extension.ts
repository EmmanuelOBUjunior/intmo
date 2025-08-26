import * as vscode from 'vscode';
import SpotifyWebApi from 'spotify-web-api-node';


let spotifyApi: SpotifyWebApi;

export function activate(context: vscode.ExtensionContext) {
	//Initialize Spotify API with stored tokens
	spotifyApi = new SpotifyWebApi({
		clientId: context.globalState.get('clientId') as string || 'beb08f57785a4e62822687a9913c6420',
		clientSecret: context.globalState.get('clientSecret') as string || '73af6bf1e6674c73b36c05a2a660f5f8',
		redirectUri: context.globalState.get('redirectUri') as string || 'http://127.0.0.1:8888/callback'
	});

	console.log("Spotify API initialized", spotifyApi);
	
	//Command: Show Now Playing
	const nowPlaying = vscode.commands.registerCommand("intmo.nowPlaying",async()=>{
		try {
			const track = await spotifyApi.getMyCurrentPlayingTrack();
			if(track.body && track.body.item){
				vscode.window.showInformationMessage(`🎶 Now playing: ${track.body.item.name} - ${track.body.item.href}`);
			}else{
				vscode.window.showInformationMessage("No track is currently playing.");
			}
		} catch (error) {
			vscode.window.showErrorMessage("Error fetching now playing track");
		}
	});

	const playPause = vscode.commands.registerCommand("intmo.playPause",async()=>{

	});
	
}


export function deactivate() {}
