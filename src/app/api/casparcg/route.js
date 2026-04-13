import net from "node:net";

export const runtime = "nodejs";

const DEFAULT_TIMEOUT_MS = 5000;

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

function stripExtension(filename) {
  if (typeof filename !== "string") {
    return filename;
  }
  // Removes the last dot and everything after it, but only if it's not a path separator
  return filename.replace(/\.[^/.]+$/, "");
}

function sendAmcpCommand({ host, port, command }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;

    function finish(error) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve(response.trim() || "No response from CasparCG.");
    }

    socket.setTimeout(DEFAULT_TIMEOUT_MS);

    socket.on("connect", () => {
      socket.write(`${command}\r\n`);
    });

    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");

      if (response.endsWith("\r\n")) {
        finish();
      }
    });

    socket.on("timeout", () => {
      finish(new Error("Timed out while waiting for CasparCG."));
    });

    socket.on("error", (error) => {
      finish(error);
    });

    socket.on("end", () => {
      finish();
    });
  });
}

function sendAmcpCommands({ host, port, commands }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;

    function finish(error) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve(response.trim() || "No response from CasparCG.");
    }

    socket.setTimeout(DEFAULT_TIMEOUT_MS);

    socket.on("connect", () => {
      socket.write(`${commands.join("\r\n")}\r\n`);
    });

    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");

      const responseCount = response
        .split(/\r?\n/)
        .filter((line) => /^\d{3}/.test(line)).length;

      if (responseCount >= commands.length) {
        finish();
      }
    });

    socket.on("timeout", () => {
      finish(new Error("Timed out while waiting for CasparCG."));
    });

    socket.on("error", (error) => {
      finish(error);
    });

    socket.on("end", () => {
      finish();
    });
  });
}

function getFillCommand(channel, layer, box = {}) {
  const x = parseMixerNumber(box.x, 0);
  const y = parseMixerNumber(box.y, 0);
  const width = parseMixerNumber(box.width, 1);
  const height = parseMixerNumber(box.height, 1);

  if (width <= 0 || height <= 0) {
    throw new Error("Width and height must be greater than 0.");
  }

  return [
    `MIXER ${channel}-${layer} FILL`,
    formatMixerNumber(x),
    formatMixerNumber(y),
    formatMixerNumber(width),
    formatMixerNumber(height),
  ].join(" ");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const host = String(body.host || "127.0.0.1").trim();
    const port = parsePositiveInteger(body.port, 5250);
    const channel = parsePositiveInteger(body.channel, 1);
    const layer = parsePositiveInteger(body.layer, 1);
    const clip = String(body.clip || "").trim();
    const box = body.box || {};

    if (!host) {
      return Response.json({ error: "Host is required." }, { status: 400 });
    }

    let command;

    if (action === "test") {
      command = "VERSION";
    } else if (action === "stop") {
      command = `STOP ${channel}-${layer}`;
    } else if (action === "play") {
      const clipName = stripExtension(clip);
      command = `PLAY ${channel}-${layer} "${escapeAmcpValue(clipName)}"`;
    } else if (action === "playLoop") {
      const clipName = stripExtension(clip);
      command = `PLAY ${channel}-${layer} "${escapeAmcpValue(clipName)}" LOOP`;
    } else if (action === "fill") {
      command = getFillCommand(channel, layer, box);
    } else if (action === "playAllLoop") {
      const videos = Array.isArray(body.videos) ? body.videos : [];
      const playableVideos = videos.filter((video) =>
        String(video.clip || "").trim() !== "",
      );

      if (playableVideos.length === 0) {
        return Response.json(
          {
            error:
              "Enter at least one media name or full path before playing all.",
          },
          { status: 400 },
        );
      }

      const fillCommands = playableVideos.map((video) => {
        const videoLayer = parsePositiveInteger(video.layer, 1);

        return getFillCommand(channel, videoLayer, video.box);
      });
      const playCommands = playableVideos.map((video) => {
        const videoLayer = parsePositiveInteger(video.layer, 1);
        const videoClip = String(video.clip || "").trim();
        const clipName = stripExtension(videoClip);

        return `PLAY ${channel}-${videoLayer} "${escapeAmcpValue(clipName)}" LOOP`;
      });
      const commands = [...fillCommands, ...playCommands];

      const reply = await sendAmcpCommands({ host, port, commands });

      return Response.json({
        message: `Sent:\n${commands.join("\n")}\n\nCasparCG replied:\n${reply}`,
      });
    } else if (action === "stopAll") {
      const videos = Array.isArray(body.videos) ? body.videos : [];
      const layers = [
        ...new Set(videos.map((video) => parsePositiveInteger(video.layer, 1))),
      ];
      const commands = layers.map((videoLayer) => `STOP ${channel}-${videoLayer}`);
      const reply = await sendAmcpCommands({ host, port, commands });

      return Response.json({
        message: `Sent:\n${commands.join("\n")}\n\nCasparCG replied:\n${reply}`,
      });
    } else {
      return Response.json({ error: "Unknown action." }, { status: 400 });
    }

    const reply = await sendAmcpCommand({ host, port, command });

    return Response.json({
      message: `Sent: ${command}\n\nCasparCG replied:\n${reply}`,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Could not talk to CasparCG." },
      { status: 500 },
    );
  }
}
