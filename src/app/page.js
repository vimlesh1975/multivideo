"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const DEFAULT_CHANNEL = "1";

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

function snapBox(box) {
  const columns = 14;
  const rows = 7;
  
  const snapX = Math.round(box.x * columns) / columns;
  const snapY = Math.round(box.y * rows) / rows;
  const snapW = Math.max(1 / columns, Math.round(box.width * columns) / columns);
  const snapH = Math.max(1 / rows, Math.round(box.height * rows) / rows);

  return normalizeBox({
    x: snapX,
    y: snapY,
    width: snapW,
    height: snapH
  });
}

function normalizeSavedVideos(savedVideos) {
  if (!Array.isArray(savedVideos)) {
    return defaultVideos;
  }

  return savedVideos
    .filter((video) => video && typeof video.id === "string")
    .map((savedVideo, index) => {
      const defaultVideo = defaultVideos.find(
        (video) => video.id === savedVideo.id,
      );
      const fallbackLabel = defaultVideo?.label || `Video ${index + 1}`;
      const fallbackLayer = defaultVideo?.layer || String(index + 1);
      const fallbackBox =
        defaultVideo?.box || { x: 0.05 * index, y: 0.05 * index, width: 0.35, height: 0.35 };

      return {
        id: savedVideo.id,
        label:
          typeof savedVideo.label === "string" ? savedVideo.label : fallbackLabel,
        layer:
          typeof savedVideo.layer === "string" ? savedVideo.layer : fallbackLayer,
        clip:
          typeof savedVideo.clip === "string"
            ? savedVideo.clip
            : defaultVideo?.clip || "",
        box: normalizeBox(savedVideo.box || fallbackBox),
      };
    });
}

function getClipName(clip) {
  const normalizedClip = String(clip || "").trim();

  if (normalizedClip === "") {
    return "No file";
  }

  return normalizedClip.split(/[\\/]/).filter(Boolean).pop() || normalizedClip;
}

export default function Home() {
  const [videos, setVideos] = useState(defaultVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(defaultVideos[0].id);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set(["Media"]));
  const [openedFileName, setOpenedFileName] = useState("");
  const [status, setStatus] = useState("Ready to connect.");
  const [mediaSearchTerm, setMediaSearchTerm] = useState("");
  const [isGlobalBusy, setIsGlobalBusy] = useState(false);
  const [mediaTree, setMediaTree] = useState(null);
  const [mediaRoot, setMediaRoot] = useState(null);
  const [mediaWarning, setMediaWarning] = useState("");
  const stageRef = useRef(null);
  const interactionRef = useRef(null);
  const lastLiveSendRef = useRef(0);
  const channel = DEFAULT_CHANNEL;

  const fetchMediaList = useCallback(async (rootOverride) => {
    try {
      const mediaTreeUrl =
        typeof rootOverride === "string" && rootOverride.trim() !== ""
          ? `/api/media-tree?root=${encodeURIComponent(rootOverride.trim())}`
          : "/api/media-tree";
      const response = await fetch(mediaTreeUrl);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not fetch media list.");
      }

      setMediaTree(result.tree);
      setMediaRoot(result.root || null);
      setMediaWarning(result.warning || "");
      setIsMediaReady(true);
    } catch (error) {
      console.error("Failed to fetch media list:", error);
      setMediaTree(null);
      setIsMediaReady(false);
      setMediaWarning(error.message || "Could not load media tree.");
    }
  }, []);

  const connectAndRefreshMedia = useCallback(async (options = {}) => {
    const quiet = options.quiet === true;

    try {
      if (!quiet) {
        setStatus("Connecting to CasparCG...");
      }

      setMediaTree(null);
      setMediaRoot(null);
      setIsMediaReady(false);
      setMediaWarning("");

      const testResponse = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          channel,
        }),
      });
      const testResult = await testResponse.json();

      if (!testResponse.ok) {
        throw new Error(testResult.error || "Could not connect to CasparCG.");
      }

      if (!quiet) {
        setStatus(`Connected to CasparCG.\n\n${testResult.message}`);
      }

      const pathsResponse = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "paths",
          channel,
        }),
      });
      const pathsResult = await pathsResponse.json();

      if (!pathsResponse.ok) {
        throw new Error(pathsResult.error || "Could not query CasparCG paths.");
      }

      if (pathsResult.root) {
        setMediaRoot(pathsResult.root);
      }

      await fetchMediaList(pathsResult.root);

      if (!quiet) {
        setStatus(
          `Connected to CasparCG.\n\n${testResult.message}\n\n${pathsResult.message}`,
        );
      }
    } catch (error) {
      console.error("Failed to refresh CasparCG paths:", error);
      setMediaTree(null);
      setMediaRoot(null);
      setIsMediaReady(false);
      setMediaWarning(error.message || "Could not refresh media paths.");
      if (!quiet) {
        setStatus(`Connection failed: ${error.message}`);
      }
    }
  }, [channel, fetchMediaList]);

  const filteredMediaTree = useCallback(() => {
    if (!mediaTree) return null;
    const term = mediaSearchTerm.trim().toLowerCase();
    if (term === "") return mediaTree;

    function filterNode(node) {
      if (node.type === "file") {
        return node.name.toLowerCase().includes(term) ? node : null;
      }

      if (node.type === "folder") {
        const filteredChildren = {};
        let hasMatch = node.name.toLowerCase().includes(term);

        if (node.children) {
          for (const [name, child] of Object.entries(node.children)) {
            const result = filterNode(child);
            if (result) {
              filteredChildren[name] = result;
              hasMatch = true;
            }
          }
        }

        if (hasMatch) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
      }

      return null;
    }

    return filterNode(mediaTree);
  }, [mediaTree, mediaSearchTerm]);

  useEffect(() => {
    if (mediaSearchTerm.trim() !== "" && mediaTree) {
      const term = mediaSearchTerm.trim().toLowerCase();
      const newExpanded = new Set(expandedFolders);
      
      function findAndExpand(node, path) {
        if (node.type === "folder" && node.children) {
          let childMatched = false;
          for (const [name, child] of Object.entries(node.children)) {
            const childPath = `${path}/${name}`;
            if (child.name.toLowerCase().includes(term) || findAndExpand(child, childPath)) {
              childMatched = true;
            }
          }
          if (childMatched) {
            newExpanded.add(path);
            return true;
          }
        }
        return node.name.toLowerCase().includes(term);
      }
      
      findAndExpand(mediaTree, "Media");
      setExpandedFolders(newExpanded);
    }
  }, [mediaSearchTerm, mediaTree]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setStatus("Auto connecting to CasparCG...");
        await connectAndRefreshMedia({ quiet: true });
        if (!controller.signal.aborted) {
          setStatus("Auto connected and media tree loaded.");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setMediaTree(null);
          setMediaRoot(null);
          setIsMediaReady(false);
          setStatus(`Auto connect failed: ${error.message}`);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [connectAndRefreshMedia]);

  function toggleFolder(folderPath) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }

  function handleMediaDragStart(event, mediaPath) {
    event.dataTransfer.setData("text/plain", mediaPath);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleVideoDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleVideoDrop(event, videoId) {
    event.preventDefault();
    const mediaPath =
      event.dataTransfer.getData("text/plain") ||
      event.dataTransfer.getData("text/uri-list");

    if (!mediaPath) {
      return;
    }

    updateVideo(videoId, { clip: mediaPath });
    setSelectedVideoId(videoId);
  }

  function updateVideo(videoId, changes) {
    setVideos((current) =>
      current.map((video) =>
        video.id === videoId ? { ...video, ...changes } : video,
      ),
    );
  }

  function getNextVideoLayer() {
    return String(
      videos.reduce(
        (maxLayer, video) => Math.max(maxLayer, Number(video.layer) || 0),
        0,
      ) + 1,
    );
  }

  function addVideoBlock() {
    const offset = (videos.length * 0.05) % 0.5;
    const nextVideo = {
      id: `video-${Date.now()}`,
      label: `Video ${videos.length + 1}`,
      layer: getNextVideoLayer(),
      clip: "",
      box: normalizeBox({
        x: offset,
        y: offset,
        width: 0.35,
        height: 0.35,
      }),
    };

    setVideos((current) => [...current, nextVideo]);
    setSelectedVideoId(nextVideo.id);
  }

  function deleteSelectedVideoBlock() {
    if (!selectedVideoId) {
      return;
    }

    deleteVideoBlock(selectedVideoId);
  }

  function deleteVideoBlock(videoId) {
    const nextVideos = videos.filter((video) => video.id !== videoId);

    if (nextVideos.length === videos.length) {
      return;
    }

    setVideos(nextVideos);
    setSelectedVideoId((current) =>
      current === videoId ? nextVideos[0]?.id || "" : current,
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

  function nextBoxFromPointerSnapped(event) {
    const box = nextBoxFromPointer(event);
    return box ? snapBox(box) : null;
  }

  async function sendAction(action, video, extra = {}, options = {}) {
    if (!options.quiet) {
      setStatus("Sending command...");
    }

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          layer: video?.layer || "1",
          clip: video?.clip || "",
          channel,
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

      if (action === "play" || action === "playLoop") {
        updateVideo(video.id, { playing: true });
      } else if (action === "stop") {
        updateVideo(video.id, { playing: false });
      }
    } catch (error) {
      setStatus(error.message);
    }
  }

  function sendFill(video, nextBox = video.box, options = {}) {
    return sendAction("fill", video, { box: nextBox }, options);
  }

  async function playAllLoop() {
    setIsGlobalBusy(true);
    setStatus("Sending all videos in loop...");

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "playAllLoop",
          channel,
          videos,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not play all videos.");
      }

      setVideos((current) =>
        current.map((v) => ({ ...v, playing: true }))
      );
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsGlobalBusy(false);
    }
  }

  async function stopAll() {
    setIsGlobalBusy(true);
    setStatus("Stopping all videos...");

    try {
      const response = await fetch("/api/casparcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stopAll",
          channel,
          videos,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not stop all videos.");
      }

      setVideos((current) =>
        current.map((v) => ({ ...v, playing: false }))
      );
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsGlobalBusy(false);
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
        setOpenedFileName(fileHandle.name);
        setStatus(`Saved layout file: ${fileHandle.name}`);
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
    setOpenedFileName(suggestedName);
    setStatus(`Saved layout file: ${suggestedName} (Browser downloads)`);
  }

  async function applyStateFile(parsedState) {
    const nextVideos = normalizeSavedVideos(parsedState.videos);
    const nextSelectedVideoId =
      nextVideos.find((video) => video.id === parsedState.selectedVideoId)
        ?.id || nextVideos[0].id;

    setVideos(nextVideos);
    setSelectedVideoId(nextSelectedVideoId);
    setStatus("Opened layout file. Sending saved videos and positions...");

    const response = await fetch("/api/casparcg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "playAllLoop",
        channel,
        videos: nextVideos,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Could not play saved layout.");
    }

    const result = await response.json();
    setVideos((current) =>
      current.map((v) => ({ ...v, playing: true }))
    );
    setStatus(`Opened layout file.\n\n${result.message}`);
  }

  async function openStateFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsGlobalBusy(true);

    try {
      const text = await file.text();
      const parsedState = JSON.parse(text);
      await applyStateFile(parsedState);
      setOpenedFileName(file.name);
    } catch (error) {
      setStatus(`Could not open layout file: ${error.message}`);
    } finally {
      event.target.value = "";
      setIsGlobalBusy(false);
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

  function handleStageAction(event, action, video) {
    event.stopPropagation();
    sendAction(action, video);
  }

  function dragBox(event) {
    const interaction = interactionRef.current;
    const nextBox = nextBoxFromPointerSnapped(event);

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
    const nextBox = nextBoxFromPointerSnapped(event);

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
        <aside className={styles.mediaSidebar}>
          <div className={styles.mediaExplorerHeader}>
            <div>
              <p>Media Explorer</p>
              {mediaRoot ? (
                <p className={styles.mediaRootPath}>Root: {mediaRoot}</p>
              ) : (
                <p className={styles.mediaRootPath}>Waiting for CasparCG media root</p>
              )}
              {mediaWarning ? (
                <p className={styles.mediaRootPath}>{mediaWarning}</p>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => connectAndRefreshMedia()}
              title="Refresh Media Paths and Tree"
            >
              🔄
            </button>
          </div>
          <div className={styles.mediaSearchContainer}>
            <input
              type="text"
              placeholder="Search media..."
              className={styles.mediaSearchInput}
              value={mediaSearchTerm}
              onChange={(e) => setMediaSearchTerm(e.target.value)}
            />
            {mediaSearchTerm && (
              <button 
                className={styles.clearSearch} 
                onClick={() => setMediaSearchTerm("")}
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>
          <div className={styles.mediaTreeContainer}>
            {mediaTree ? (
              <TreeItem
                item={filteredMediaTree() || { name: "Media", type: "folder", children: {} }}
                level={0}
                path="Media"
                expandedFolders={expandedFolders}
                onToggle={toggleFolder}
                onDragStart={handleMediaDragStart}
              />
            ) : isMediaReady ? (
              <p className={styles.noMedia}>No media found in CasparCG media folder.</p>
            ) : (
              <p className={styles.noMedia}>Connect to CasparCG to load the media tree.</p>
            )}
          </div>
        </aside>

        <section className={styles.surfaceSection}>
          <div className={styles.surfaceHeader}>
            <div className={styles.surfaceActions}>
              <button
                type="button"
                className={styles.loopButton}
                onClick={playAllLoop}
                disabled={isGlobalBusy}
              >
                Play All Loop
              </button>
              <button
                type="button"
                className={styles.stopAllButton}
                onClick={stopAll}
                disabled={isGlobalBusy}
              >
                Stop All
              </button>
              <button type="button" onClick={addVideoBlock} disabled={isGlobalBusy}>
                Add Video Block
              </button>
              <button
                type="button"
                onClick={deleteSelectedVideoBlock}
                disabled={isGlobalBusy || !selectedVideoId}
              >
                Delete Video Block
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
              {openedFileName && (
                <div className={styles.headerFilename}>
                  <span>File:</span>
                  <strong>{openedFileName}</strong>
                </div>
              )}
            </div>
          </div>

          <div className={styles.stageWrapper}>
            <div className={styles.topStrip}>
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className={styles.stripLabel}>{i + 1}</div>
              ))}
            </div>
            <div className={styles.leftStrip}>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className={styles.stripLabel}>{i + 1}</div>
              ))}
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
                  onDragOver={handleVideoDragOver}
                  onDrop={(event) => handleVideoDrop(event, video.id)}
                  style={{
                    left: `${video.box.x * 100}%`,
                    top: `${video.box.y * 100}%`,
                    width: `${video.box.width * 100}%`,
                    height: `${video.box.height * 100}%`,
                    zIndex: selectedVideoId === video.id ? 5 : index + 1,
                  }}
                >
                  <span className={styles.videoBoxLabel}>
                    <strong>{video.label}</strong>
                    <small>{getClipName(video.clip)}</small>
                    {video.playing && <span className={styles.playingIndicator}>● Playing</span>}
                  </span>
                  <div className={styles.videoBoxActions}>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => handleStageAction(event, "playLoop", video)}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => handleStageAction(event, "stop", video)}
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteVideoBlock(video.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
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
          </div>
        </section>

      </section>
    </main>
  );
}

function TreeItem({ item, level, path, expandedFolders, onToggle, onDragStart }) {
  const isExpanded = expandedFolders.has(path);
  const hasChildren = item.children && Object.keys(item.children).length > 0;

  return (
    <div className={styles.treeItemWrapper}>
      <div
        className={`${styles.treeItem} ${
          item.type === "folder" ? styles.folderItem : styles.fileItem
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        draggable={item.type === "file"}
        onDragStart={
          item.type === "file"
            ? (event) => onDragStart?.(event, item.path)
            : undefined
        }
        onClick={item.type === "folder" ? () => onToggle(path) : undefined}
      >
        <span className={styles.expander}>
          {item.type === "folder" ? (isExpanded ? "−" : "+") : ""}
        </span>
        <span className={styles.itemIcon}>
          {item.type === "folder" ? (isExpanded ? "📂" : "📁") : "🎬"}
        </span>
        <span className={styles.itemName}>{item.name}</span>
      </div>
      {item.type === "folder" && isExpanded && hasChildren && (
        <div className={styles.treeSubItems}>
          {Object.entries(item.children).map(([name, child]) => (
            <TreeItem
              key={name}
              item={child}
              level={level + 1}
              path={`${path}/${name}`}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}
