import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import SpotifyWebApi from "spotify-web-api-node";
import {
  ensureActiveDevice,
  setExtensionContext,
  setSpotifyApi,
} from "../utils/utils";

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;

  setup(() => {
    // Create a mock extension context
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
      secrets: {
        get: (key: string) => Promise.resolve("dummy-token"),
        store: (key: string, value: string) => Promise.resolve(),
        delete: (key: string) => Promise.resolve(),
      },
      extensionUri: vscode.Uri.file(__dirname),
      storageUri: vscode.Uri.file(__dirname),
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      extensionMode: vscode.ExtensionMode.Test,
      extensionPath: __dirname,
      environmentVariableCollection: {
        persistent: true,
        replace: () => {},
        append: () => {},
        prepend: () => {},
        get: () => undefined,
        forEach: () => {},
        clear: () => {},
        delete: () => {},
        [Symbol.iterator]: function* () {},
      } as unknown as vscode.EnvironmentVariableCollection,
      asAbsolutePath: (relativePath: string) =>
        require("path").join(__dirname, relativePath),
      storagePath: __dirname,
      globalStoragePath: __dirname,
      logPath: __dirname,
    } as unknown as vscode.ExtensionContext;

    // Create a mock Spotify API
    spotifyApi = new SpotifyWebApi();
    setSpotifyApi(spotifyApi);
    setExtensionContext(context);
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

  test('ensureActiveDevice - with active device', async () => {
        // Mock getMyDevices to return a device
        const getDevicesStub = sinon.stub(spotifyApi, 'getMyDevices')
            .resolves({
                body: {
                    devices: [{
                        id: 'device1',
                        is_active: true,
                        name: 'Test Device',
                        type: 'Computer',
                    }]
                }
            });

        const result = await ensureActiveDevice(context);

        assert.strictEqual(result, true);
        getDevicesStub.restore();
    });
});
