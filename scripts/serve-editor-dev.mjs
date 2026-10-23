// 開発用: エディタの static export を配信する小さな静的サーバ。
// 使い方: node scripts/serve-editor-dev.mjs [exportDir] [port]
//   既定 exportDir: ../tukumana-layerling-workshop-mode/apps/web/.next-export, port: 3020
// 別ターミナルで EDITOR_DEV_URL=http://localhost:3020 npm run dev を起動する。
// export は basePath=/3dp/editor でビルドされているため、
// そのプレフィックス付き/なしの両方のパスを export ディレクトリ直下にマップする。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "../tukumana-layerling-workshop-mode/apps/web/.next-export");
const port = Number(process.argv[3] ?? 3020);
const PREFIX = "/3dp/editor";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".lyl": "application/zip",
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p.startsWith(PREFIX)) p = p.slice(PREFIX.length) || "/";
  const abs = path.join(root, path.normalize(p));
  if (!abs.startsWith(root)) return null;
  const candidates = [abs, abs + ".html", path.join(abs, "index.html")];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(new URL(req.url, "http://x").pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`editor export: ${root} -> http://localhost:${port}`));
