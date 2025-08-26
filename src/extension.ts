import * as vscode from 'vscode';
import SpotifyWebApi from 'spotify-web-api-node';


let spotifyApi: SpotifyWebApi;

export function activate(context: vscode.ExtensionContext) {
	//Initialize Spotify API with stored tokens
	spotifyApi = new SpotifyWebApi({
		clientId: context.globalState.get('clientId') as string || '',
		clientSecret: context.globalState.get('clientSecret') as string || '',
		redirectUri: context.globalState.get('redirectUri') as string || ''
	});

	console.log("Spotify API initialized", spotifyApi);
	const getApi = vscode.commands.registerCommand('intmo.getApi', () => {
		vscode.window.showInformationMessage('Getting Spotify API instance...');
		return spotifyApi;
	});
	
	const disposable = vscode.commands.registerCommand('intmo.helloWorld', () => {
		
		vscode.window.showInformationMessage('Hello World from intmo!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(getApi);
}


export function deactivate() {}
