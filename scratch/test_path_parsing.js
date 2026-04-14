const path = require('node:path');

function parseInfoPaths(output) {
  const lines = String(output || "").split(/\r?\n/);
  const paths = {};

  // Check if it's XML
  if (output.includes("<?xml") || output.includes("<paths>")) {
    const mediaPathMatch = output.match(/<media-path>(.*?)<\/media-path>/i);
    const initialPathMatch = output.match(/<initial-path>(.*?)<\/initial-path>/i);
    
    let mediaPath = mediaPathMatch ? mediaPathMatch[1].trim() : "";
    let initialPath = initialPathMatch ? initialPathMatch[1].trim() : "";
    
    if (mediaPath) {
        // Check if mediaPath is absolute
        // On Windows, absolute starts with drive letter like D: or \ for root
        const isAbsolute = /^[a-zA-Z]:/.test(mediaPath) || mediaPath.startsWith("/") || mediaPath.startsWith("\\");
        
        if (!isAbsolute && initialPath) {
            // It's relative. Combine with initialPath
            // Ensure initialPath has a trailing slash or handle it with path.join
            // But we don't know the FS of the server necessarily, but here we assume Windows-ish or consistent slashes.
            // Using forward slashes for joining if it looks like the user's example
            let combined = initialPath;
            if (!combined.endsWith("/") && !combined.endsWith("\\")) {
                combined += "/";
            }
            combined += mediaPath;
            paths["media"] = combined;
        } else {
            paths["media"] = mediaPath;
        }
    }
    
    // Also extract other tags for completeness
    const tags = ['log-path', 'data-path', 'template-path', 'initial-path'];
    tags.forEach(tag => {
        const match = output.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'i'));
        if (match) {
            paths[tag.replace('-path', '')] = match[1].trim();
        }
    });

    return paths;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const cleaned = trimmed.replace(/^\d{3}\s*/, "").trim();

    if (!cleaned.includes(":")) {
      continue;
    }

    const [rawKey, ...rawValue] = cleaned.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();

    if (value) {
      paths[key] = value;
    }
  }

  return paths;
}

const test1 = `<?xml version="1.0" encoding="utf-8"?>\n<paths>\n   <media-path>d:/casparcg/_media/</media-path>\n   <log-path>log/</log-path>\n   <data-path>data/</data-path>\n   <template-path>c:/casparcg/</template-path>\n   <initial-path>D:\\casparcg-server-060226/</initial-path>`;

const test2 = `<?xml version="1.0" encoding="utf-8"?>\n<paths>\n   <media-path>_media/</media-path>\n   <log-path>log/</log-path>\n   <data-path>data/</data-path>\n   <template-path>c:/casparcg/</template-path>\n   <initial-path>D:\\casparcg-server-060226/</initial-path>`;

console.log("Test 1 Result:", parseInfoPaths(test1));
console.log("Test 2 Result:", parseInfoPaths(test2));
