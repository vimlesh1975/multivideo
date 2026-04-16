# LED Player (Multivideo CasparCG Controller)

A powerful Next.js control surface for playing, positioning, and resizing dynamic video blocks on a CasparCG channel. Integrated with a customizable grid system and Windows Service installer.

## Features

- **Any Media Support**: Support for any media format supported by CasparCG (MKV, MP4, MOV, PNG, JPG, etc.).
- **Intelligent AMCP Commands**:
  - Full filename and extension support.
  - Smart `LOOP` logic: Automatically omits the loop parameter for static images (`.png`, `.jpg`, etc.) while keeping it for videos.
- **Windows Service Integration**: Runs in the background and starts automatically on boot.
- **Bundled Node.js Runtime**: Includes Node.js v23.11.1—no separate installation required on target machines.
- **Live Output Control**: Drag and resize video blocks on a 1920x1080 surface with real-time `MIXER FILL` updates.
- **Customizable Grid**: Numeric inputs for horizontal and vertical surface blocks (Cols/Rows) with optional **Snap to Grid** functionality.
- **Smart Layout Management**: 
  - **Save**: Overwrite the currently active layout file directly.
  - **Save As**: Export your configuration to a new JSON file.
  - **Open**: Restore positions and media paths using the File System Access API.
- **Build Tracking**: Automated build timestamping displayed in the browser tab for version tracking.

## Installation & Deployment

### 1. Developer Run (Local)
```bash
npm install
npm run dev
```
Open: `http://127.0.0.1:15000`

### 2. Creating the Windows Service Installer
To generate a standalone `.exe` installer for distribution:

1. **Prepare Build**: Rebuilds the app and downloads the required WinSW/Node.js binaries.
   ```bash
   npm run service:prepare
   ```
2. **Compile Installer**: 
   - Ensure [Inno Setup 6](https://jrsoftware.org/isdl.php) is installed.
   - Open `installer/setup.iss` and press `Ctrl+F9`.
   - Result: `installer/Output/MultivideoControllerSetup-YYYY-MM-DD_HHMM.exe`.

### 3. Portable Manual Install
If you don't want to use the `.exe` installer:
1. Navigate to the `winsw/` directory.
2. Run `multivideo-service.exe install` as Administrator.
3. Run `multivideo-service.exe start`.

## Requirements

- **CasparCG Server**: Running and reachable (default: `127.0.0.1:5250`).
- **Operating System**: Windows (for the service and installer).
- **Files**: Media files must be accessible to the CasparCG machine.

## How To Use

1. **Start CasparCG Server**.
2. **Install/Run the app** and open it in your browser.
3. **Enter Media Path**: Type a file name or full path (e.g., `c:/media/video.mkv` or `overlay.png`).
4. **Play/Stop**: Control individual layers or use **Play All Loop**.
5. **Surface Control**: 
   - Set your destination grid size (e.g., 14x7).
   - Enable **Snap to Grid** for precise alignment.
   - Drag and resize blocks on the "Output Surface" to update CasparCG live.

## Automation Scripts

- `npm run service:prepare`: Full build and binary download for the installer.
- `npm run winsw:download`: Fetches the WinSW wrapper and Node.js v23.11.1 runtime.
- `npm run build`: Standard Next.js production build in standalone mode.

## Project Structure

- `src/app/`: Next.js frontend and CasparCG AMCP API route.
- `installer/`: Inno Setup script for the Windows installer.
- `winsw/`: Service wrapper configuration and bundled binaries (`node.exe`, `multivideo-service.exe`).

## License
MIT
