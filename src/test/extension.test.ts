import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import SpotifyWebApi from "spotify-web-api-node";
import {
  ensureActiveDevice,
  MiniplayerPanel,
  setExtensionContext,
  setSpotifyApi,
} from "../utils/utils";
import { handleVSCodeCallback } from "../extension";

// Define proper types for Spotify API responses
interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
  volume_percent?: number;
  is_private_session?: boolean;
  is_restricted?: boolean;
  supports_volume?: boolean;
}

interface DevicesResponse {
  body: {
    devices: SpotifyDevice[];
  };
}

interface QuickPickDevice extends vscode.QuickPickItem {
  id: string;
}

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;
  let sandBox: sinon.SinonSandbox;

  setup(() => {
    sandBox = sinon.createSandbox();

    // Mock extension context with proper typing
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      secrets: {
        get: sandBox.stub().resolves("dummy-token"),
        store: sandBox.stub().resolves(),
        delete: sandBox.stub().resolves(),
        onDidChange: sandBox.stub(),
      },
      globalState: {
        get: sandBox.stub(),
        update: sandBox.stub(),
        keys: sandBox.stub().returns([]),
        setKeysForSync: sandBox.stub(),
      },
      workspaceState: {
        get: sandBox.stub(),
        update: sandBox.stub(),
        keys: sandBox.stub().returns([]),
      },
      extensionPath: __dirname,
      storagePath: __dirname,
      globalStoragePath: __dirname,
      logPath: __dirname,
      extensionMode: vscode.ExtensionMode.Test,
      logUri: vscode.Uri.file(__dirname),
      storageUri: vscode.Uri.file(__dirname),
      globalStorageUri: vscode.Uri.file(__dirname),
      environmentVariableCollection: {} as any,
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
    const api = await handleVSCodeCallback(context);
    assert.ok(api instanceof SpotifyWebApi);
    assert.strictEqual(
      api.getRedirectURI(),
      "vscode://local-dev.intmo/callback"
    );
  });

  test("ensureActiveDevice - no devices available", async () => {
    const mockResponse: any = {
      body: {
        devices: []
      }
    };

    const getDevicesStub = sandBox
      .stub(spotifyApi, "getMyDevices")
      .resolves(mockResponse);

    const showErrorStub = sandBox.stub(vscode.window, "showErrorMessage");

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, false);
    assert.strictEqual(showErrorStub.calledOnce, true);
    assert.strictEqual(
      showErrorStub.firstCall.args[0],
      "No Spotify devices found. Please open Spotify on any device"
    );
    
    getDevicesStub.restore();
    showErrorStub.restore();
  });

  test("ensureActiveDevice - with active device", async () => {
    const mockResponse: any = {
      body: {
        devices: [
          {
            id: "device1",
            is_active: true,
            name: "Test Device",
            type: "Computer",
            volume_percent: 50,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          },
        ],
      },
    };

    const getDevicesStub = sandBox
      .stub(spotifyApi, "getMyDevices")
      .resolves(mockResponse);

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, true);
    getDevicesStub.restore();
  });

  test('MiniPlayer creation and disposal', () => {
    const mockWebviewPanel = {
      webview: {
        html: '',
        onDidReceiveMessage: sandBox.stub().returns({ dispose: sandBox.stub() }),
        postMessage: sandBox.stub().resolves(true),
        options: {},
        cspSource: 'vscode-webview:',
        asWebviewUri: sandBox.stub(),
      },
      onDidDispose: sandBox.stub().returns({ dispose: sandBox.stub() }),
      dispose: sandBox.stub(),
      reveal: sandBox.stub(),
      viewType: 'miniPlayer',
      title: 'Mini Player',
      iconPath: undefined,
      options: {},
      viewColumn: vscode.ViewColumn.One,
      active: true,
      visible: true,
    };

    const createWebviewPanelStub = sandBox.stub(vscode.window, 'createWebviewPanel')
      .returns(mockWebviewPanel as any);

    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    assert.ok(MiniplayerPanel.currentPanel);
    
    MiniplayerPanel.currentPanel?.dispose();
    assert.strictEqual(MiniplayerPanel.currentPanel, undefined);
    
    createWebviewPanelStub.restore();
  });

  test('Device selection flow', async () => {
    const mockDevicesResponse: any = {
      body: {
        devices: [
          { 
            id: 'device1', 
            name: 'Device 1', 
            type: 'Computer', 
            is_active: false,
            volume_percent: 50,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          },
          { 
            id: 'device2', 
            name: 'Device 2', 
            type: 'Smartphone', 
            is_active: false,
            volume_percent: 30,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          }
        ]
      }
    };

    const selectedDevice: QuickPickDevice = {
      id: 'device1',
      label: 'Device 1',
      description: 'Computer'
    };

    const getDevicesStub = sandBox.stub(spotifyApi, 'getMyDevices')
      .resolves(mockDevicesResponse);
    const quickPickStub = sandBox.stub(vscode.window, 'showQuickPick')
      .resolves(selectedDevice);
    const transferPlaybackStub = sandBox.stub(spotifyApi, 'transferMyPlayback')
      .resolves({} as any);

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, true);
    assert.ok(quickPickStub.calledOnce);
    assert.ok(transferPlaybackStub.calledWith(['device1']));

    getDevicesStub.restore();
    quickPickStub.restore();
    transferPlaybackStub.restore();
  });

  test("Track info update with no active device", async () => {
    const mockResponse: any = {
      body: {
        devices: [
          {
            id: "device1",
            is_active: false,
            name: "Test Device",
            type: "Computer",
            volume_percent: 50,
            is_private_session: false,
            is_restricted: false,
            supports_volume: true,
          },
        ],
      },
      headers: {},
      statusCode: 200
    };

    const getDevicesStub = sandBox.stub(spotifyApi, "getMyDevices")
      .resolves(mockResponse);

    // Create a mock panel with proper typing
    const mockPanel = {
      updateTrack: sandBox.spy(),
      dispose: sandBox.stub(),
      reveal: sandBox.stub(),
    };
    MiniplayerPanel.currentPanel = mockPanel as any;

    await vscode.commands.executeCommand("intmo.nowPlaying");

    assert.strictEqual(mockPanel.updateTrack.calledOnce, true);
    assert.deepStrictEqual(mockPanel.updateTrack.firstCall.args[0], {
      name: "No active device",
      artists: ["Please open Spotify on any device"],
      albumArt: "",
      album: "",
      durationMS: 0,
      progressMs: 0,
      isPlaying: false,
    });

    getDevicesStub.restore();
  });

  test('Error handling in device activation', async () => {
    const apiError = new Error('API Error');
    const getDevicesStub = sandBox.stub(spotifyApi, 'getMyDevices')
      .rejects(apiError);
    
    const consoleErrorStub = sandBox.stub(console, 'error');
    
    const result = await ensureActiveDevice(context);
    
    assert.strictEqual(result, false);
    assert.ok(consoleErrorStub.calledWith('Device activation error: ', sinon.match.any));

    getDevicesStub.restore();
    consoleErrorStub.restore();
  });
});