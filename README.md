# Intmo – Spotify for VS Code 🎶

A VS Code extension that lets you **control Spotify without leaving your editor**.  
Stay in the flow of coding while keeping your music just a command away.

---

## ✨ Features

- 🔐 **Spotify Authentication**  
  Securely connect your Spotify account via VS Code’s `UriHandler`.

- 🎧 **Device Management**  
  - Detect active devices linked to your Spotify account.  
  - Transfer playback seamlessly between devices.  
  - Refresh device list on demand.

- 🎵 **MiniPlayer**  
  - Play / pause directly in VS Code.  
  - See current track info and album art (with default fallback).  
  - Updates live as tracks change.

- ⚠️ **Robust Error Handling**  
  - Clear error messages when no devices are found.  
  - Graceful handling of device activation failures.

- 🧪 **Testing Support**  
  - Authentication callback flow tested.  
  - Device activation / error scenarios covered.  
  - MiniPlayer lifecycle tested.

---

## 🚀 Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/).
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`Spotify: Connect`** to log in.
4. Once authenticated:
   - Run **`Spotify: Select Active Device`** to choose where to play music.
   - Control playback from the **MiniPlayer** or command palette.

---

## 🛠️ Commands

| Command                        | Description |
|--------------------------------|-------------|
| `Spotify: Connect`             | Authenticate with Spotify |
| `Spotify: Select Active Device`| Switch playback to a chosen device |
| `Spotify: Refresh Devices`     | Reload the device list |
| `Spotify: Toggle Play/Pause`   | Control playback directly |

---

## 📸 Screenshots

*(Add screenshots or GIF demos here before publishing for marketplace visibility.)*  

---

## 🧑‍💻 Development

Clone and run locally:

```bash
git clone https://github.com/your-username/intmo.git
cd intmo
npm install
npm run compile
npm run test
code .
