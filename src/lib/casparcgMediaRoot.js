import fs from "node:fs";
import path from "node:path";

const DEFAULT_MEDIA_ROOT =
  process.env.MEDIA_ROOT ||
  (process.platform === "win32"
    ? path.join("C:", "casparcg", "_media")
    : path.join(process.cwd(), "public"));
let casparCgMediaRoot = null;

function isPlaceholderPath(value) {
  return /<[^>]+>/.test(value);
}

function normalizeRootPath(rootPath) {
  if (typeof rootPath !== "string") {
    return null;
  }

  let normalized = rootPath.trim();
  if (normalized === "") {
    return null;
  }

  if (isPlaceholderPath(normalized)) {
    return null;
  }

  normalized = normalized.replace(/\//g, path.sep);
  normalized = normalized.replace(/["']/g, "");

  try {
    normalized = path.resolve(normalized);
  } catch {
    return null;
  }

  return normalized;
}

export function getMediaRoot() {
  return casparCgMediaRoot || DEFAULT_MEDIA_ROOT;
}

export function setMediaRoot(rootPath) {
  const normalized = normalizeRootPath(rootPath);

  if (!normalized) {
    return false;
  }

  try {
    const stats = fs.statSync(normalized);
    if (!stats.isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }

  casparCgMediaRoot = normalized;
  return true;
}

export function clearMediaRoot() {
  casparCgMediaRoot = null;
}
