/**
 * Custom Node.js HTTP server entry point for Render/Railway deployment.
 *
 * TanStack Start's build output (`dist/server/server.js`) exports a Web Fetch API
 * handler ({ fetch }). This wrapper bridges it to a Node.js HTTP server so it
 * can listen on process.env.PORT as required by Render.
 */

// @ts-check
import { createServer } from "node:http";
import { Readable } from "node:stream";

const PORT = process.env.PORT || 3000;

// Dynamically import the built handler
const { default: app } = await import("./dist/server/server.js");

if (!app || !app.fetch) {
  console.error("Failed to load server handler from dist/server/server.js");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    // Build request URL
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url, `http://${host}`);

    // Collect body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body =
      req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0
        ? Buffer.concat(chunks)
        : undefined;

    // Build Web API Request
    const request = new Request(url.toString(), {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = Array.isArray(v) ? v.join(", ") : v;
        return acc;
      }, {}),
      body,
      duplex: "half",
    });

    // Call TanStack Start handler
    const response = await app.fetch(request);

    // Write response
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
