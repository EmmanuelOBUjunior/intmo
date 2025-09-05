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

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;
  let sandBox:sinon.SinonSandbox;

  setup(() => {
        sandBox = sinon.createSandbox();
        
        // Mock extension context
        context = {
            subscriptions: [],
            extensionUri: vscode.Uri.file(__dirname),
            secrets: {
                get: sandBox.stub().resolves('dummy-token'),
                store: sandBox.stub().resolves()
            }
        } as unknown as vscode.ExtensionContext;

        // Create Spotify API instance
        spotifyApi = new SpotifyWebApi();
        setSpotifyApi(spotifyApi);
        setExtensionContext(context);
    });

	teardown(()=>{
		sandBox.restore();
	});

  test("ensureActiveDevice - no device available", async () => {
    //Mock getMyDevices to return empty list
    const getDevicesStub = sinon
      .stub(spotifyApi, "getMyDevices")
      .resolves({ body: { devices: [] } });

    const showErrorStub = sinon.stub(vscode.window, "showErrorMessage");
    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, false);
    assert.strictEqual(showErrorStub.calledOnce, true);
    assert.strictEqual(
      showErrorStub.firstCall.args[0],
      "No Spotify devices found. Please open Spotify on any device"
    );
  });

  test("ensureActiveDevice - with active device", async () => {
    // Mock getMyDevices to return a device
    const getDevicesStub = sinon.stub(spotifyApi, "getMyDevices").resolves({
      body: {
        devices: [
          {
            id: "device1",
            is_active: true,
            name: "Test Device",
            type: "Computer",
          },
        ],
      },
    });

    const result = await ensureActiveDevice(context);

    assert.strictEqual(result, true);
    getDevicesStub.restore();
  });

  test("MiniplayerPanel creation", () => {
    const createWebviewPanelStub = sinon
      .stub(vscode.window, "createWebviewPanel")
      .returns({
        webview: {
          html: "",
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          postMessage: () => Promise.resolve(),
        },
        onDidDispose: () => ({ dispose: () => {} }),
        dispose: () => {},
        reveal: () => {},
      } as any);

    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));

    assert.strictEqual(createWebviewPanelStub.calledOnce, true);
    createWebviewPanelStub.restore();
  });

  test("Track info update with no active device", async () => {
    // Mock getMyDevices to return no active devices
    const getDevicesStub = sinon.stub(spotifyApi, "getMyDevices").resolves({
      body: {
        devices: [
          {
            id: "device1",
            is_active: false,
            name: "Test Device",
            type: "Computer",
          },
        ],
      },
    });

    // Create a mock panel
    const mockPanel = {
      updateTrack: sinon.spy(),
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
});
