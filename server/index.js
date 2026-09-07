import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const vite = dev
  ? await (
      await import("vite")
    ).createServer({ root, server: { middlewareMode: true }, appType: "spa" })
  : null;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const { handleApi } = await import("./history.js");
      return await handleApi(req, res, url);
    }
    if (dev) {
      if (url.pathname === "/civilization.html") req.url = "/";
      return vite.middlewares(req, res);
    }
    const base = resolve(root, "dist");
    let path = resolve(base, "." + decodeURIComponent(url.pathname));
    if (!path.startsWith(base + sep) && path !== base) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname === "/" || url.pathname === "/civilization.html")
      path = resolve(base, "index.html");
    if (!existsSync(path) || !(await stat(path)).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    createReadStream(path).pipe(res);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) res.writeHead(500);
    res.end("Unable to complete request");
  }
});
const port = Number(process.env.PORT || 5173);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`  Local: http://localhost:${port}/`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await vite?.close();
    server.close(() => process.exit(0));
  });
