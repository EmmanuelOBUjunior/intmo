import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import SpotifyWebApi from "spotify-web-api-node";
import { setExtensionContext, setSpotifyApi } from "../utils/utils";

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;

  setup(() => {
    //Creating a mock extension context
    context = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
      secrets = {
        get: (key: string) => Promise.resolve("dummy-token"),
        store: (key: string, value: string) => Promise.resolve(),
      },
      extensionUri: vscode.Uri.file(__dirname),
      storageUri: vscode.Uri.file(__dirname),
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      extensionMode: vscode.ExtensionMode.Test,
    } as vscode.ExtensionContext;

    //Create a mock spotify api
    spotifyApi = new SpotifyWebApi();
    setSpotifyApi(spotifyApi);
    setExtensionContext(context);
  });
});
