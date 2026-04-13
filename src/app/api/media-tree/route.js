import fs from "node:fs/promises";
import path from "node:path";
import { getMediaRoot } from "../../../lib/casparcgMediaRoot";

export const runtime = "nodejs";

const DEFAULT_MEDIA_ROOT =
  process.env.MEDIA_ROOT || path.join(process.cwd(), "public");
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "output",
  "dist",
  "installer",
  "winsw",
  "Output",
]);

async function buildTree(dirPath, relativePath = "") {
  const item = {
    name: relativePath ? path.basename(relativePath) : "Media",
    type: "folder",
    children: {},
  };

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const sortedEntries = entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  for (const entry of sortedEntries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const childRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;
    const childFullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      item.children[entry.name] = await buildTree(
        childFullPath,
        childRelativePath,
      );
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

export async function GET() {
  const mediaRoot = getMediaRoot();

  try {
    const tree = await buildTree(mediaRoot);
    return Response.json({ tree, root: mediaRoot });
  } catch (error) {
    return Response.json(
      {
        error:
          error?.message ||
          `Could not read media tree from ${mediaRoot}`,
      },
      { status: 500 },
    );
  }
}
