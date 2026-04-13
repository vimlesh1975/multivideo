# Multivideo CasparCG Controller

A compact Next.js control surface for playing, positioning, and resizing three MP4 videos on a CasparCG channel.

The app talks to CasparCG over AMCP using a server-side TCP route, so browser actions such as Play, Stop, drag, resize, Save File, and Open File become CasparCG commands.

## Features

- Three independent MP4 slots.
- Default files:
  - `go1080p25.mp4`
  - `amb.mp4`
  - `CG1080i50.mp4`
- Play and Stop controls for each video layer.
- Play All Loop and Stop All controls.
- 1920 x 1080 visual surface.
- Drag video blocks to move them in CasparCG.
- Resize video blocks with corner and edge handles.
- Live position updates using `MIXER FILL`.
- Auto-connect check using CasparCG `VERSION`.
- Save the current layout to a JSON file.
- Open a saved JSON layout file and apply saved positions.
- Supports CasparCG media names and full MP4 paths.

## CasparCG Commands Used

Single video loop playback:

```text
PLAY 1-2 "c://casparcg/_media/kabhi_kabhi.mp4" LOOP
```

Position and scale:

```text
MIXER 1-2 FILL 0.1 0.1 0.4 0.4
```

Stop a layer:

```text
STOP 1-2
```

## Requirements

- Node.js installed.
- CasparCG Server running.
- CasparCG AMCP port reachable, normally `5250`.
- MP4 files accessible to the CasparCG machine.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:15000
```

## Build

```bash
npm run build
npm run start
```

## How To Use

1. Start CasparCG Server.
2. Open the app in your browser.
3. Confirm the Host and Port at the bottom left.
4. Enter an MP4 media name or full path for each video.
5. Click Play for one video, or Play All Loop for all three.
6. Drag and resize blocks on the 1920 x 1080 surface.
7. Click Stop for one video, or Stop All for all three.

## Full Path Playback

You can type a full CasparCG-readable path directly in the video field:

```text
c://casparcg/_media/kabhi_kabhi.mp4
```

The app sends that path directly to CasparCG inside the `PLAY` command.

Important: the browser file picker cannot provide the full local path for security reasons. The Choose button can fill the file name only. For files outside the CasparCG media folder, type or paste the full path manually.

## Save And Open Layouts

Use Save File to download a JSON layout file containing:

- Host and port.
- Selected MP4 names or paths.
- Video block positions and sizes.
- Selected video block.

Use Open File to load that JSON layout again. The app restores the UI state and applies saved positions to CasparCG.

## Default Layer Mapping

The app uses CasparCG channel `1` and these layers:

- Video 1: layer `1`
- Video 2: layer `2`
- Video 3: layer `3`

For example, Video 2 plays on:

```text
1-2
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- This app is intended to run locally on the control machine or on the same network as CasparCG.
- CasparCG must be able to access the MP4 path you enter.
- Dragging and resizing updates CasparCG live, throttled to avoid sending too many AMCP commands.
