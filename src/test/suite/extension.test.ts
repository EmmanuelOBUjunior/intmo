import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import SpotifyWebApi from "spotify-web-api-node";
import {
  ensureActiveDevice,
  MiniplayerPanel,
  setExtensionContext,
  setSpotifyApi,
} from "../../utils/utils";
import { handleVSCodeCallback } from "../../extension";

interface QuickPickDevice extends vscode.QuickPickItem {
  id: string;
}

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;
  let sandBox: sinon.SinonSandbox;

  setup(() => {
    sandBox = sinon.createSandbox();

    // Mock extension context
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      secrets: {
        get: sandBox.stub().resolves("dummy-token"),
        store: sandBox.stub().resolves(),
      },
    } as unknown as vscode.ExtensionContext;

    // Create Spotify API instance
    spotifyApi = new SpotifyWebApi();
    setSpotifyApi(spotifyApi);
    setExtensionContext(context);
  });

  teardown(() => {
    sandBox.restore();
  });

  test("handleVSCodeCallback creates SpotifyWebApi instance", async () => {
    sandBox.stub(spotifyApi, "authorizationCodeGrant").resolves({
      body: {
        access_token: "fake_access",
        refresh_token: "fake_refresh",
        expires_in: 3600,
      },
    } as any);

    sandBox.stub(spotifyApi, "getMe").resolves({
      body: { id: "user123" },
    } as any);

    const api = await handleVSCodeCallback(context);
    assert.ok(api instanceof SpotifyWebApi);
    assert.strictEqual(api.getRedirectURI(), "vscode://local-dev.intmo/callback");
  });

  test("ensureActiveDevice - no devices available", async () => {
    sandBox.stub(spotifyApi, "getMyDevices").resolves({ body: { devices: [] } } as any);
    const showErrorStub = sandBox.stub(vscode.window, "showErrorMessage");

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, false);
    assert.ok(showErrorStub.calledOnce);
    assert.strictEqual(
      showErrorStub.firstCall.args[0],
      "No Spotify devices found. Please open Spotify on any device"
    );
  });

  test("ensureActiveDevice - with active device", async () => {
    sandBox.stub(spotifyApi, "getMyDevices").resolves({
      body: {
        devices: [
          {
            id: "device1",
            is_active: true,
            name: "Test Device",
            type: "Computer",
            is_private_session: false,
            is_restricted: false,
            volume_percent: 50,
          },
        ],
      },
    } as any);

    const result = await ensureActiveDevice(context);
    assert.strictEqual(result, true);
  });

  test("MiniPlayer creation and disposal", () => {
    const createWebviewPanelStub = sandBox.stub(vscode.window, "createWebviewPanel").returns({
      webview: {
        html: "",
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: sandBox.stub().resolves(true),
        onDidReceiveMessage: () => ({ dispose: () => {} }),
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
    } as any);

    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    assert.ok(MiniplayerPanel.currentPanel);

    MiniplayerPanel.currentPanel?.dispose();
    assert.strictEqual(MiniplayerPanel.currentPanel, undefined);

    createWebviewPanelStub.restore();
  });

  test("Device selection flow", async () => {
    const devices: any = {
      body: {
        devices: [
          {
            id: "device1",
            name: "Device 1",
            type: "Computer",
            is_active: false,
            volume_percent: 50,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          },
          {
            id: "device2",
            name: "Device 2",
            type: "Smartphone",
            is_active: false,
            volume_percent: 30,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          },
        ],
      },
    };

    const selectedDevice: QuickPickDevice = {
      id: "device1",
      label: "Device 1",
      description: "Computer",
    };

    sandBox.stub(spotifyApi, "getMyDevices").resolves(devices);
    sandBox.stub(vscode.window, "showQuickPick").resolves(selectedDevice);
    const transferPlaybackStub = sandBox.stub(spotifyApi, "transferMyPlayback").resolves({} as any);

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, true);
    assert.ok(transferPlaybackStub.calledWith(["device1"]));
  });

  test("Track info update with no active device", async () => {
    sandBox.stub(spotifyApi, "getMyDevices").resolves({
      body: { devices: [{ id: "device1", is_active: false, name: "Device 1", type: "Computer" }] },
    } as any);

    sandBox.stub(spotifyApi, "getMyCurrentPlaybackState").resolves({ body: null } as any);

    const mockPanel = { updateTrack: sinon.spy() };
    MiniplayerPanel.currentPanel = mockPanel as any;

    await vscode.commands.executeCommand("intmo.nowPlaying");

    assert.ok(mockPanel.updateTrack.calledOnce);
    assert.deepStrictEqual(mockPanel.updateTrack.firstCall.args[0], {
      name: "No active device",
      artists: ["Please open Spotify on any device"],
      albumArt: "",
      album: "",
      durationMs: 0,
      progressMs: 0,
      isPlaying: false,
    });
  });

  test("Error handling in device activation", async () => {
    sandBox.stub(spotifyApi, "getMyDevices").rejects(new Error("API Error"));
    const consoleErrorStub = sandBox.stub(console, "error");

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, false);
    assert.ok(consoleErrorStub.calledWithMatch("Device activation error"));
  });

  test("MiniPlayer play/pause button messaging", async () => {
    const postMessageStub = sandBox.stub().resolves(true);

    sandBox.stub(vscode.window, "createWebviewPanel").returns({
      webview: {
        html: "",
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: postMessageStub,
        onDidReceiveMessage: () => ({ dispose: () => {} }),
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
    } as any);

    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    await MiniplayerPanel.currentPanel?.panel.webview.postMessage({ command: "playPause" });

    assert.ok(
      postMessageStub.calledWithMatch({ command: "playPause" }),
      "Expected playPause command to be sent"
    );
  });

  test("MiniPlayer updateTrack with valid data", () => {
    const postMessageStub = sandBox.stub().resolves(true);

    sandBox.stub(vscode.window, "createWebviewPanel").returns({
      webview: {
        html: "",
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: postMessageStub,
        onDidReceiveMessage: () => ({ dispose: () => {} }),
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
    } as any);

    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));

    const track = {
      name: "Focus Track",
      artists: ["Artist A", "Artist B"],
      album: "Test Album",
      durationMs: 200000,
      progressMs: 50000,
      isPlaying: true,
      albumArt: "https://test.img",
    };

    MiniplayerPanel.currentPanel?.updateTrack(track);

    assert.ok(
      postMessageStub.calledWithMatch({ command: "updateTrack", track }),
      "Expected updateTrack message with correct track data"
    );
  });
});
