import fs from "node:fs";
import path from "node:path";

let casparCgMediaRoot = null;

export function normalizeRootPath(rootPath) {
  if (typeof rootPath !== "string") {
    return null;
  }

  let normalized = rootPath.trim();
  if (normalized === "") {
    return null;
  }

  normalized = normalized.replace(/<[^>]+>/g, "");
  normalized = normalized.replace(/\//g, path.sep);
  normalized = normalized.replace(/["']/g, "");
  normalized = normalized.replace(/[ \t]+$/g, "");
  normalized = normalized.replace(/[\\\/]+$/g, "");

  if (normalized === "") {
    return null;
  }

  try {
    normalized = path.resolve(normalized);
  } catch {
    return null;
  }

  return normalized;
}

export function getMediaRoot() {
  if (casparCgMediaRoot) {
    return casparCgMediaRoot;
  }

  if (typeof process.env.MEDIA_ROOT === "string" && process.env.MEDIA_ROOT.trim() !== "") {
    return normalizeRootPath(process.env.MEDIA_ROOT.trim());
  }

  return null;
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
