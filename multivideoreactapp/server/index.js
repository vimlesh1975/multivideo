import express from "express";
import cors from "cors";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import fsSync from "node:fs";

let casparCgMediaRoot = null;

function normalizeRootPath(rootPath) {
  if (typeof rootPath !== "string") return null;
  let normalized = rootPath.trim();
  if (normalized === "") return null;
  normalized = normalized.replace(/<[^>]+>/g, "").replace(/\//g, path.sep).replace(/["']/g, "").replace(/[ \t]+$/g, "").replace(/[\\\/]+$/g, "");
  if (normalized === "") return null;
  try {
    normalized = path.resolve(normalized);
  } catch {
    return null;
  }
  return normalized;
}

function getMediaRoot() {
  if (casparCgMediaRoot) return casparCgMediaRoot;
  if (typeof process.env.MEDIA_ROOT === "string" && process.env.MEDIA_ROOT.trim() !== "") {
    return normalizeRootPath(process.env.MEDIA_ROOT.trim());
  }
  return null;
}

function setMediaRoot(rootPath) {
  const normalized = normalizeRootPath(rootPath);
  if (!normalized) return false;
  try {
    const stats = fsSync.statSync(normalized);
    if (!stats.isDirectory()) return false;
  } catch {
    return false;
  }
  casparCgMediaRoot = normalized;
  return true;
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_TIMEOUT_MS = 5000;
const CASPARCG_HOST = process.env.CASPARCG_HOST || "127.0.0.1";
const CASPARCG_PORT = process.env.CASPARCG_PORT || 5250;

app.use(cors());
app.use(express.json());

// --- AMCP Helpers ---

function escapeAmcpValue(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMixerNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMixerNumber(value) {
  return Number(value).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function isImage(filename) {
  if (typeof filename !== "string") return false;
  const imageExtensions = [".png", ".jpg", ".jpeg", ".tga", ".bmp", ".tiff"];
  return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}

function sendAmcpCommand({ host, port, command }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;

    function finish(error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) { reject(error); return; }
      resolve(response.trim() || "No response from CasparCG.");
    }

    socket.setTimeout(DEFAULT_TIMEOUT_MS);
    socket.on("connect", () => {
      socket.write(`${command}\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.endsWith("\r\n")) finish();
    });
    socket.on("timeout", () => finish(new Error("Timed out while waiting for CasparCG.")));
    socket.on("error", (error) => finish(error));
    socket.on("end", () => finish());
  });
}

function sendAmcpCommands({ host, port, commands }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;

    function finish(error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) { reject(error); return; }
      resolve(response.trim() || "No response from CasparCG.");
    }

    socket.setTimeout(DEFAULT_TIMEOUT_MS);
    socket.on("connect", () => {
      socket.write(`${commands.join("\r\n")}\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      const responseCount = response.split(/\r?\n/).filter((line) => /^\d{3}/.test(line)).length;
      if (responseCount >= commands.length) finish();
    });
    socket.on("timeout", () => finish(new Error("Timed out while waiting for CasparCG.")));
    socket.on("error", (error) => finish(error));
    socket.on("end", () => finish());
  });
}

function getFillCommand(channel, layer, box = {}) {
  const x = parseMixerNumber(box.x, 0);
  const y = parseMixerNumber(box.y, 0);
  const width = parseMixerNumber(box.width, 1);
  const height = parseMixerNumber(box.height, 1);
  if (width <= 0 || height <= 0) throw new Error("Width and height must be greater than 0.");

  return [
    `MIXER ${channel}-${layer} FILL`,
    formatMixerNumber(x),
    formatMixerNumber(y),
    formatMixerNumber(width),
    formatMixerNumber(height),
  ].join(" ");
}

// --- Path Parsing Helpers ---

function isAbsolutePath(p) {
  return /^[a-zA-Z]:/.test(p) || p.startsWith("/") || p.startsWith("\\");
}

function resolveRelativePath(initialPath, relativePath) {
  let base = String(initialPath || "").replace(/[\\/]+$/, "");
  let rel = String(relativePath || "").replace(/[\\/]+$/, "");
  if (!base) return rel;
  return `${base}/${rel}`;
}

function parseXmlTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function parseInfoPaths(output) {
  const text = String(output || "");
  if (text.includes("<paths>") || text.includes("<?xml")) {
    const paths = {};
    const initialPath = parseXmlTag(text, "initial-path");
    const tagNames = ["media-path", "log-path", "data-path", "template-path", "initial-path"];
    for (const tag of tagNames) {
      const value = parseXmlTag(text, tag);
      if (!value) continue;
      const key = tag.replace(/-path$/, "");
      if (key === "media" && !isAbsolutePath(value) && initialPath) {
        paths[key] = resolveRelativePath(initialPath, value);
      } else {
        paths[key] = value;
      }
    }
    return paths;
  }
  return {}; // Simplified for now
}

function findPreferredMediaRoot(paths) {
  const candidates = ["root", "media", "root folder", "media folder", "paths root", "media root"];
  for (const candidate of candidates) {
    if (paths[candidate]) return paths[candidate];
  }
  return Object.values(paths).find((v) => typeof v === "string" && v.length > 0) || null;
}

// --- Media Tree Logic ---

const EXCLUDED_DIRS = new Set(["node_modules", ".git", ".next", "output", "dist", "installer", "winsw", "Output"]);

async function buildTree(dirPath, relativePath = "") {
  const item = {
    name: relativePath ? path.basename(relativePath) : "Media",
    type: "folder",
    children: {},
  };

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  for (const entry of sortedEntries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;

    const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const childFullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      item.children[entry.name] = await buildTree(childFullPath, childRelativePath);
    } else if (entry.isFile()) {
      item.children[entry.name] = {
        name: entry.name,
        type: "file",
        path: childRelativePath.replace(/\\/g, "/"),
      };
    }
  }
  return item;
}

// --- Express Routes ---

app.post("/api/casparcg", async (req, res) => {
  const host = CASPARCG_HOST;
  const port = CASPARCG_PORT;
  const body = req.body;
  const action = String(body.action || "");
  const channel = parsePositiveInteger(body.channel, 1);
  const layer = parsePositiveInteger(body.layer, 1);
  const clip = String(body.clip || "").trim();
  const box = body.box || {};

  try {
    if (action === "test") {
      const reply = await sendAmcpCommand({ host, port, command: "VERSION" });
      res.json({ message: `CasparCG replied: ${reply}` });
    } else if (action === "play" || action === "playLoop") {
      const loopFlag = (action === "playLoop" && !isImage(clip)) ? " LOOP" : "";
      const command = `PLAY ${channel}-${layer} "${escapeAmcpValue(clip)}"${loopFlag}`;
      const reply = await sendAmcpCommand({ host, port, command });
      res.json({ message: `Sent: ${command}\n\nCasparCG replied:\n${reply}` });
    } else if (action === "stop") {
      const command = `STOP ${channel}-${layer}`;
      const reply = await sendAmcpCommand({ host, port, command });
      res.json({ message: `Sent: ${command}\n\nCasparCG replied:\n${reply}` });
    } else if (action === "fill") {
      const command = getFillCommand(channel, layer, box);
      const reply = await sendAmcpCommand({ host, port, command });
      res.json({ message: `Sent: ${command}\n\nCasparCG replied:\n${reply}` });
    } else if (action === "playAllLoop") {
      const videos = Array.isArray(body.videos) ? body.videos : [];
      const playableVideos = videos.filter((v) => String(v.clip || "").trim() !== "");
      if (playableVideos.length === 0) return res.status(400).json({ error: "No videos to play." });

      const commands = [
        ...playableVideos.map(v => getFillCommand(channel, parsePositiveInteger(v.layer, 1), v.box)),
        ...playableVideos.map(v => `PLAY ${channel}-${parsePositiveInteger(v.layer, 1)} "${escapeAmcpValue(v.clip)}"${isImage(v.clip) ? "" : " LOOP"}`)
      ];
      const reply = await sendAmcpCommands({ host, port, commands });
      res.json({ message: `Sent commands.\n\nCasparCG replied:\n${reply}` });
    } else if (action === "stopAll") {
      const command = `CLEAR ${channel}`;
      const reply = await sendAmcpCommand({ host, port, command });
      res.json({ message: `Sent: ${command}\n\nCasparCG replied:\n${reply}` });
    } else if (action === "paths") {
      const reply = await sendAmcpCommand({ host, port, command: "INFO PATHS" });
      const paths = parseInfoPaths(reply);
      const rootPath = normalizeRootPath(findPreferredMediaRoot(paths));
      if (rootPath) setMediaRoot(rootPath);
      res.json({ message: "Fetched paths.", paths, root: rootPath });
    } else {
      res.status(400).json({ error: "Unknown action." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/media-tree", async (req, res) => {
  const requestedRoot = req.query.root;
  const mediaRoot = (typeof requestedRoot === "string" && requestedRoot.trim() !== "" 
    ? normalizeRootPath(requestedRoot) 
    : null) || getMediaRoot();

  if (!mediaRoot) return res.status(400).json({ error: "Media root not available." });

  try {
    setMediaRoot(mediaRoot);
    const tree = await buildTree(mediaRoot);
    res.json({ tree, root: mediaRoot });
  } catch (error) {
    res.json({ tree: { name: "Media", type: "folder", children: {} }, root: mediaRoot, warning: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
