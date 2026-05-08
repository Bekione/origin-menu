/**
 * Custom Node.js HTTP server entry point for Render deployment.
 *
 * Serves static assets from dist/client/ directly,
 * and passes all other requests to the TanStack Start SSR handler.
 */

// @ts-check
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;
const CLIENT_DIR = join(__dirname, "dist", "client");

// MIME types for static assets
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

// Dynamically import the built SSR handler
const { default: app } = await import("./dist/server/server.js");

if (!app || !app.fetch) {
  console.error("Failed to load server handler from dist/server/server.js");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url || "/";

    // Serve static assets from dist/client/
    const filePath = join(CLIENT_DIR, url.split("?")[0]);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      // Cache static assets aggressively (they have content hashes in filenames)
      if (url.startsWith("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      createReadStream(filePath).pipe(res);
      return;
    }

    // SSR: pass to TanStack Start handler
    const host = req.headers.host || `localhost:${PORT}`;
    const fullUrl = new URL(url, `http://${host}`);

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body =
      req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0
        ? Buffer.concat(chunks)
        : undefined;

    const request = new Request(fullUrl.toString(), {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = Array.isArray(v) ? v.join(", ") : v;
        return acc;
      }, {}),
      body,
      duplex: "half",
    });

    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Request error:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`Origin Restaurant server running on port ${PORT}`);
});
