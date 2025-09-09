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
2. Login
4. Once authenticated:
   - Extension will request for an active device.
   - Control playback from the **MiniPlayer** or command palette.

---

## 🛠️ Commands

| Command                        | Description |
|--------------------------------|-------------|
| `Spotify: Show Now Playing`       | Show the current track playing |
| `Spotify: Search on Spotify`   | Search for a track, artist or playlist on Spotify |
| `Spotify: Open Mini Player`      | Opens the miniplayer in VS Code |
| `Spotify: Play/Pause`   | Control playback directly |

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
