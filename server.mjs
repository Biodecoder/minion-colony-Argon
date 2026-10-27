/**
 * Static HTTP server for Minion Colony.
 * Serves ES modules, PNG sprite sheets, YosterIsland.ttf, and .m4a audio clips.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ttf": "font/ttf",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav"
};

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const relPath = urlPath === "/" ? "/index.html" : urlPath;
      const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(__dirname, safePath);

      if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "no-cache"
        });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`Minion Colony server running at http://127.0.0.1:${actualPort}`);
      resolve({ server, port: actualPort, url: `http://127.0.0.1:${actualPort}` });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer(PORT);
}
