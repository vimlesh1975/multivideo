"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const defaultConnection = {
  host: "127.0.0.1",
  port: "5250",
  channel: "1",
};

const defaultVideos = [
  {
    id: "video-1",
    label: "Video 1",
    layer: "1",
    clip: "go1080p25.mp4",
    box: { x: 0, y: 0, width: 6 / 14, height: 1 },
  },
  {
    id: "video-2",
    label: "Video 2",
    layer: "2",
    clip: "amb.mp4",
    box: { x: 6 / 14, y: 0, width: 2 / 14, height: 1 },
  },
  {
    id: "video-3",
    label: "Video 3",
    layer: "3",
    clip: "CG1080i50.mp4",
    box: { x: 8 / 14, y: 0, width: 6 / 14, height: 1 },
  },
];

const minBoxSize = 0.03;

const resizeHandles = [
  { name: "nw", label: "Resize top left" },
  { name: "n", label: "Resize top" },
  { name: "ne", label: "Resize top right" },
  { name: "e", label: "Resize right" },
  { name: "se", label: "Resize bottom right" },
  { name: "s", label: "Resize bottom" },
  { name: "sw", label: "Resize bottom left" },
  { name: "w", label: "Resize left" },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundBoxValue(value) {
  return Number(value.toFixed(4));
}

function normalizeBox(box) {
  const width = clamp(Number(box?.width) || 1, minBoxSize, 1);
  const height = clamp(Number(box?.height) || 1, minBoxSize, 1);

  return {
    x: roundBoxValue(clamp(Number(box?.x) || 0, 0, 1 - width)),
    y: roundBoxValue(clamp(Number(box?.y) || 0, 0, 1 - height)),
    width: roundBoxValue(width),
    height: roundBoxValue(height),
  };
}

function normalizeSavedVideos(savedVideos) {
  if (!Array.isArray(savedVideos)) {
    return defaultVideos;
  }

  return defaultVideos.map((defaultVideo) => {
    const savedVideo =
      savedVideos.find((video) => video?.id === defaultVideo.id) || {};

    return {
      ...defaultVideo,
      layer:
        typeof savedVideo.layer === "string"
          ? savedVideo.layer
          : defaultVideo.layer,
      clip:
        typeof savedVideo.clip === "string"
          ? savedVideo.clip
          : defaultVideo.clip,
      box: normalizeBox(savedVideo.box || defaultVideo.box),
    };
  });
}

export default function Home() {
  const [connection, setConnection] = useState(defaultConnection);
  const [videos, setVideos] = useState(defaultVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(defaultVideos[0].id);
  const [status, setStatus] = useState("Ready to connect.");
  const [isBusy, setIsBusy] = useState(false);
  const stageRef = useRef(null);
  const interactionRef = useRef(null);
  const lastLiveSendRef = useRef(0);
  const { host, port, channel } = connection;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("Auto connecting to CasparCG...");

      try {
        const response = await fetch("/api/casparcg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            action: "test",
            host,
            port,
            channel,
          }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Auto connect failed.");
        }

        setStatus(`Auto connected.\n\n${result.message}`);
      } catch (error) {
        if (error.name !== "AbortError") {
          setStatus(`Auto connect failed: ${error.message}`);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [host, port, channel]);

  function updateConnection(event) {
    setConnection((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateVideo(videoId, changes) {
    setVideos((current) =>
      current.map((video) =>
        video.id === videoId ? { ...video, ...changes } : video,
      ),
    );
  }

  function updateVideoBox(videoId, nextBox) {
    setVideos((current) =>
      current.map((video) =>
        video.id === videoId
          ? { ...video, box: normalizeBox(nextBox) }
          : video,
      ),
    );
  }

  function pickFile(event, videoId) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    updateVideo(videoId, { clip: file.name });
  }

  function getStagePointer(event) {
    const stage = stageRef.current;

    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function nextBoxFromPointer(event) {
    const pointer = getStagePointer(event);
    const interaction = interactionRef.current;

    if (!pointer || !interaction) {
      return null;
    }

    if (interaction.type === "move") {
      return normalizeBox({
        ...interaction.startBox,
        x:
          interaction.startBox.x +
          pointer.x -
          interaction.startPointer.x,
        y:
          interaction.startBox.y +
          pointer.y -
          interaction.startPointer.y,
      });
    }

    const handle = interaction.handle;
    let left = interaction.startBox.x;
    let top = interaction.startBox.y;
    let right = interaction.startBox.x + interaction.startBox.width;
    let bottom = interaction.startBox.y + interaction.startBox.height;

    if (handle.includes("e")) {
      right = clamp(pointer.x, left + minBoxSize, 1);
    }

    if (handle.includes("w")) {
      left = clamp(pointer.x, 0, right - minBoxSize);
    }

    if (handle.includes("s")) {
      bottom = clamp(pointer.y, top + minBoxSize, 1);
    }

    if (handle.includes("n")) {
      top = clamp(pointer.y, 0, bottom - minBoxSize);
    }

    return normalizeBox({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  async function sendAction(action, video, extra = {}, options = {}) {
    if (!options.quiet) {
      setIsBusy(true);
      setStatus("Sending command...");
    }

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...connection,
          layer: video?.layer || "1",
          clip: video?.clip || "",
          ...extra,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "CasparCG command failed.");
      }

      if (!options.quiet) {
        setStatus(result.message);
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (!options.quiet) {
        setIsBusy(false);
      }
    }
  }

  function sendFill(video, nextBox = video.box, options = {}) {
    return sendAction("fill", video, { box: nextBox }, options);
  }

  async function playAllLoop() {
    setIsBusy(true);
    setStatus("Sending all videos in loop...");

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "playAllLoop",
          ...connection,
          videos,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not play all videos.");
      }

      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function stopAll() {
    setIsBusy(true);
    setStatus("Stopping all videos...");

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stopAll",
          ...connection,
          videos,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not stop all videos.");
      }

      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function saveStateFile() {
    const suggestedName = `multivideo-layout-${new Date()
      .toISOString()
      .slice(0, 19)
      .replaceAll(":", "-")}.json`;
    const stateFile = JSON.stringify(
      {
        app: "multivideo-casparcg",
        savedAt: new Date().toISOString(),
        version: 1,
        connection,
        videos,
        selectedVideoId,
      },
      null,
      2,
    );

    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Multivideo layout",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(stateFile);
        await writable.close();
        setStatus("Saved layout file.");
        return;
      } catch (error) {
        if (error.name === "AbortError") {
          setStatus("Save cancelled.");
          return;
        }

        setStatus(`Could not save layout file: ${error.message}`);
        return;
      }
    }

    const stateBlob = new Blob([stateFile], { type: "application/json" });
    const url = URL.createObjectURL(stateBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Saved layout file to browser downloads.");
  }

  async function applyStateFile(parsedState) {
    const nextConnection = {
      ...defaultConnection,
      ...(parsedState.connection || {}),
    };
    const nextVideos = normalizeSavedVideos(parsedState.videos);
    const nextSelectedVideoId =
      nextVideos.find((video) => video.id === parsedState.selectedVideoId)
        ?.id || nextVideos[0].id;

    setConnection(nextConnection);
    setVideos(nextVideos);
    setSelectedVideoId(nextSelectedVideoId);
    setStatus("Opened layout file. Sending saved videos and positions...");

    const response = await fetch("/api/casparcg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "playAllLoop",
        ...nextConnection,
        videos: nextVideos,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Could not play saved layout.");
    }

    const result = await response.json();
    setStatus(`Opened layout file.\n\n${result.message}`);
  }

  async function openStateFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsBusy(true);

    try {
      const parsedState = JSON.parse(await file.text());
      await applyStateFile(parsedState);
    } catch (error) {
      setStatus(`Could not open layout file: ${error.message}`);
    } finally {
      event.target.value = "";
      setIsBusy(false);
    }
  }

  function startDrag(event, video) {
    const startPointer = getStagePointer(event);

    if (!startPointer) {
      return;
    }

    setSelectedVideoId(video.id);
    interactionRef.current = {
      type: "move",
      videoId: video.id,
      startPointer,
      startBox: video.box,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startResize(event, video, handle) {
    const startPointer = getStagePointer(event);

    if (!startPointer) {
      return;
    }

    event.stopPropagation();
    setSelectedVideoId(video.id);
    interactionRef.current = {
      type: "resize",
      videoId: video.id,
      handle,
      startPointer,
      startBox: video.box,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragBox(event) {
    const interaction = interactionRef.current;
    const nextBox = nextBoxFromPointer(event);

    if (!interaction || !nextBox) {
      return;
    }

    updateVideoBox(interaction.videoId, nextBox);

    const now = Date.now();

    if (now - lastLiveSendRef.current > 120) {
      const video = videos.find((item) => item.id === interaction.videoId);
      lastLiveSendRef.current = now;

      if (video) {
        sendFill(video, nextBox, { quiet: true });
      }
    }
  }

  function endDrag(event) {
    const interaction = interactionRef.current;
    const nextBox = nextBoxFromPointer(event);

    if (interaction && nextBox) {
      const video = videos.find((item) => item.id === interaction.videoId);
      updateVideoBox(interaction.videoId, nextBox);

      if (video) {
        sendFill(video, nextBox);
      }
    }

    interactionRef.current = null;
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <aside className={styles.sidebar}>
          <div className={styles.header}>
            <p>CasparCG MP4 Player</p>
            <h1>Play three looping videos.</h1>
          </div>

          <section className={styles.videoControls}>
            {videos.map((video) => (
              <article className={styles.videoCard} key={video.id}>
                <div className={styles.videoNumber}>
                  {video.label.replace("Video ", "")}
                </div>

                <div className={styles.mediaRow}>
                  <label className={styles.mediaName}>
                    <span className={styles.visuallyHidden}>
                      {video.label} CasparCG MP4 path or media name
                    </span>
                    <input
                      value={video.clip}
                      onChange={(event) =>
                        updateVideo(video.id, { clip: event.target.value })
                      }
                      placeholder="kabhi_kabhi.mp4 or c://casparcg/_media/video.mkv"
                    />
                  </label>

                  <label className={styles.chooseButton}>
                    Choose
                    <input
                      className={styles.hiddenFileInput}
                      type="file"
                      accept="*/*"
                      onChange={(event) => pickFile(event, video.id)}
                    />
                  </label>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    onClick={() => sendAction("playLoop", video)}
                    disabled={isBusy}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => sendAction("stop", video)}
                    disabled={isBusy}
                  >
                    Stop
                  </button>
                </div>
              </article>
            ))}
          </section>

          <pre className={styles.status}>{status}</pre>

          <div className={styles.grid}>
            <label>
              Host
              <input
                name="host"
                value={connection.host}
                onChange={updateConnection}
              />
            </label>

            <label>
              Port
              <input
                name="port"
                value={connection.port}
                onChange={updateConnection}
              />
            </label>
          </div>
        </aside>

        <section className={styles.surfaceSection}>
          <div className={styles.surfaceHeader}>
            <div>
              <p>Output Surface</p>
              <h2>Move and resize each video block.</h2>
            </div>
            <div className={styles.surfaceActions}>
              <button
                type="button"
                className={styles.loopButton}
                onClick={playAllLoop}
                disabled={isBusy}
              >
                Play All Loop
              </button>
              <button
                type="button"
                className={styles.stopAllButton}
                onClick={stopAll}
                disabled={isBusy}
              >
                Stop All
              </button>
              <button type="button" onClick={saveStateFile}>
                Save File
              </button>
              <label className={styles.fileActionButton}>
                Open File
                <input
                  className={styles.hiddenFileInput}
                  type="file"
                  accept="application/json,.json"
                  onChange={openStateFile}
                />
              </label>
            </div>
          </div>

          <div className={styles.stage} ref={stageRef}>
            {videos.map((video, index) => (
              <div
                className={`${styles.videoBox} ${
                  selectedVideoId === video.id ? styles.selectedVideoBox : ""
                }`}
                key={video.id}
                onPointerDown={(event) => startDrag(event, video)}
                onPointerMove={dragBox}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  left: `${video.box.x * 100}%`,
                  top: `${video.box.y * 100}%`,
                  width: `${video.box.width * 100}%`,
                  height: `${video.box.height * 100}%`,
                  zIndex: selectedVideoId === video.id ? 5 : index + 1,
                }}
              >
                <span>{video.label}</span>
                {resizeHandles.map((handle) => (
                  <button
                    aria-label={`${video.label} ${handle.label}`}
                    className={`${styles.resizeHandle} ${styles[handle.name]}`}
                    key={handle.name}
                    onPointerDown={(event) =>
                      startResize(event, video, handle.name)
                    }
                    type="button"
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
