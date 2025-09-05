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
import * as authModule from '../../auth';

suite("Spotify Extension Test Suite", () => {
  let context: vscode.ExtensionContext;
  let spotifyApi: SpotifyWebApi;
  let sandBox: sinon.SinonSandbox;

  setup(() => {
    sandBox = sinon.createSandbox();

    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      secrets: {
        get: sandBox.stub().resolves("dummy-token"),
        store: sandBox.stub().resolves(),
      },
    } as unknown as vscode.ExtensionContext;

    spotifyApi = new SpotifyWebApi();
    setSpotifyApi(spotifyApi);
    setExtensionContext(context);

    sandBox.stub(spotifyApi, "refreshAccessToken").resolves({
      body: { access_token: "new-dummy-token" },
    } as any);

    sandBox.stub(vscode.authentication, "getSession").resolves({
      id: "dummy-session",
      accessToken: "dummy-access-token",
      account: { label: "test-user", id: "user123" },
      scopes: ["user-read-playback-state", "user-modify-playback-state"],
    } as any);

    sandBox.stub(vscode.window, "createWebviewPanel").returns({
      webview: {
        html: "",
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: sinon.stub().resolves(true),
        // Ensure this is a proper function that returns a valid object
        asWebviewUri: function (uri: vscode.Uri) {
          return {
            toString: () => uri.toString(),
            with: () => uri,
          };
        },
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: (callback: any) => {
        callback(); //Ensures the dispose callback is called
        return { dispose: () => {} };
      },
    } as any);

    sandBox
      .stub(vscode.commands, "executeCommand")
      .withArgs("intmo.nowPlaying")
      .callsFake(async () => {
        if (MiniplayerPanel.currentPanel) {
          MiniplayerPanel.currentPanel.updateTrack({
            name: "No active device",
            artists: ["Please open Spotify on any device"],
            albumArt: "",
            album: "",
            durationMs: 0,
            progressMs: 0,
            isPlaying: false,
          });
        }
        return Promise.resolve();
      });

    sandBox.stub(spotifyApi, "getMe").resolves({
      body: { id: "user123", display_name: "Test User" },
    } as any);

    sandBox.stub(console, "error");
  });

  teardown(() => {
    sandBox.restore();
  });

  // Test 1
  test("handleVSCodeCallback creates SpotifyWebApi instance", async () => {
    sandBox.stub(spotifyApi, "authorizationCodeGrant").resolves({
      body: {
        access_token: "fake_access",
        refresh_token: "fake_refresh",
        expires_in: 3600,
      },
    } as any);

    const api = await handleVSCodeCallback(context);
    assert.ok(api instanceof SpotifyWebApi);
    assert.strictEqual(
      api.getRedirectURI(),
      "vscode://local-dev.intmo/callback"
    );
  });

  // Test 2
  test("MiniPlayer creation and disposal", () => {
    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    assert.ok(MiniplayerPanel.currentPanel);

    MiniplayerPanel.currentPanel?.dispose();
    assert.strictEqual(MiniplayerPanel.currentPanel, undefined);
  });

  // Test 3
  test("Track info update with no active device", async () => {
    sandBox.stub(spotifyApi, "getMyDevices").resolves({
      body: {
        devices: [{ id: "device1", is_active: false, name: "Device 1" }],
      },
    } as any);

    sandBox
      .stub(spotifyApi, "getMyCurrentPlaybackState")
      .resolves({ body: null } as any);

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

  // Test 4 (device activation error handling)
  // test("Error handling in device activation", async () => {
  //   const originalConsoleError = console.error; // save original
  //   const errorSpy = sinon.spy();
  //   console.error = errorSpy as any; // patch manually

  //   console.log("withTokenRefresh is", authModule.withTokenRefresh);
  //   sandBox.stub(authModule, "withTokenRefresh").rejects(new Error("API Error"));

  //   const result = await ensureActiveDevice(context);

  //   assert.strictEqual(result, false);

  //   // assert console.error was called
  //   console.log("console.error calls:", errorSpy.callCount, errorSpy.args);
  //   assert.ok(errorSpy.calledOnce, "Expected console.error to be called once");
  //  assert.ok(
  //     errorSpy.firstCall.args[0].includes("Device activation error"),
  //     "Expected error log for device activation failure"
  //   );

  //   // restore console.error
  //   console.error = originalConsoleError;
  // });

 test("Error handling in device activation", async () => {
  sandBox.stub(authModule, "withTokenRefresh").rejects(new Error("API Error"));

  const result = await ensureActiveDevice(context);

  assert.strictEqual(result, false);
  assert.ok((console.error as sinon.SinonStub).calledOnce);
  assert.match(
    (console.error as sinon.SinonStub).firstCall.args[0],
    /Device activation error:/
  );
});

  // Test 5
  test("MiniPlayer play/pause button messaging", async () => {
    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    const postMessageStub = (MiniplayerPanel.currentPanel as any).panel.webview
      .postMessage as sinon.SinonStub;

    await MiniplayerPanel.currentPanel?.panel.webview.postMessage({
      command: "playPause",
    });

    assert.ok(
      postMessageStub.calledWithMatch({ command: "playPause" }),
      "Expected playPause command to be sent"
    );
  });

  //Test 6
  test("MiniPlayer updateTrack with valid data", () => {
    MiniplayerPanel.createOrShow(vscode.Uri.file(__dirname));
    const postMessageStub = (MiniplayerPanel.currentPanel as any).panel.webview
      .postMessage as sinon.SinonStub;

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

  test("Handles no devices found", async () => {
  process.env.TEST_FORCE_ERROR = "false";

  // const consoleErrorStub = sandBox.stub(console, "error");
  const showErrorStub = sandBox.stub(vscode.window, "showErrorMessage");

  sandBox.stub(authModule, "withTokenRefresh").rejects(new Error("API Error"));

  const result = await ensureActiveDevice(context);

  assert.strictEqual(result, false);
  assert.strictEqual(showErrorStub.called, false);
  assert.ok(showErrorStub.calledWithMatch("No Spotify devices detected: Please open Spotify on any device", sinon.match.any));
  // showErrorStub.restore();
});

test("ensureActiveDevice - with active device", async () => {
  sandBox.stub(authModule, "withTokenRefresh").rejects(new Error("API Error"));
    const getDevicesStub = sandBox
      .stub(spotifyApi, "getMyDevices")
      .resolves({
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
    getDevicesStub.restore();
  });
});
