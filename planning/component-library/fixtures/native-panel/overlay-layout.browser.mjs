import { log } from "node:console"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repository = resolve(here, "../../../..")
const require = createRequire(join(repository, "packages/react/package.json"))
const vite = require.resolve("vite", { paths: [dirname(require.resolve("vitest/package.json"))] })
const { build } = await import(vite)
const workspace = realpathSync(mkdtempSync(join(tmpdir(), "codon-panel-overlay-layout-")))
const source = {
  canonicalRef: "ddc9f066f67af4742e05e04bd870726141c44129",
  files: Object.fromEntries(
    ["Panel.tsx", "helpers.ts", "PanelStyles.module.css"].map((file) => {
      const path = `packages/react/src/components/Panel/${file}`
      return [
        path,
        createHash("sha256")
          .update(readFileSync(join(repository, path)))
          .digest("hex"),
      ]
    }),
  ),
  react: JSON.parse(readFileSync(require.resolve("react/package.json"))).version,
  reactDom: JSON.parse(readFileSync(require.resolve("react-dom/package.json"))).version,
  fixture: createHash("sha256")
    .update(readFileSync(join(here, "overlay-layout.browser.tsx")))
    .digest("hex"),
}
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Canonical Panel overlay layout controls</title><style>html,body{margin:0;padding:0}pre{white-space:pre-wrap}:root{--cui-z-index-panel:100;--cui-z-index-content-offset:1;--cui-z-index-overlay-offset:0}</style></head><body><div id="root"></div><pre id="results">Running canonical layout controls.</pre><script type="module" src="${join(here, "overlay-layout.browser.tsx")}"></script></body></html>`
writeFileSync(join(workspace, "index.html"), html)
await build({
  root: workspace,
  configFile: false,
  logLevel: "error",
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      react: dirname(require.resolve("react/package.json")),
      "react-dom": dirname(require.resolve("react-dom/package.json")),
      "motion/react": require.resolve("motion/react"),
    },
  },
  build: { outDir: join(workspace, "dist"), emptyOutDir: true, target: "es2022" },
})
const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/result") {
    let body = ""
    for await (const part of request) {
      body += part
      if (body.length > 131072) return response.writeHead(413).end()
    }
    const result = JSON.parse(body)
    if (JSON.stringify(result.source) !== JSON.stringify(source)) return response.writeHead(409).end()
    if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + "\n")
    return response.writeHead(201).end()
  }
  if (request.url === "/source.json")
    return response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(source))
  const path = request.url === "/" ? "index.html" : request.url?.replace(/^\//, "")
  if (!path || path.includes("..") || path.includes("?")) return response.writeHead(404).end()
  try {
    const contents = readFileSync(join(workspace, "dist", path))
    const type =
      { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" }[extname(path)] ??
      "application/octet-stream"
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(contents)
  } catch {
    response.writeHead(404).end()
  }
})
server.listen(0, "127.0.0.1", () =>
  log(JSON.stringify({ pid: process.pid, url: `http://127.0.0.1:${server.address().port}`, workspace, source })),
)
