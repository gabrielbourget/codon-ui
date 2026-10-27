import { log } from "node:console"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import process from "node:process"
import { fileURLToPath, URL } from "node:url"

const stylesheet = readFileSync(
  new URL("../../../../packages/react/src/components/Panel/PanelStyles.module.css", import.meta.url),
)
const routes = new Map([
  ["/", ["text/html", readFileSync(new URL("./filter-reference.html", import.meta.url))]],
  ["/numeric", ["text/html", readFileSync(new URL("./numeric-reference.html", import.meta.url))]],
  ["/panel.css", ["text/css", stylesheet]],
  [
    "/source.json",
    [
      "application/json",
      JSON.stringify({
        path: "packages/react/src/components/Panel/PanelStyles.module.css",
        sha256: createHash("sha256").update(stylesheet).digest("hex"),
        fixture: fileURLToPath(import.meta.url),
      }),
    ],
  ],
])
const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/result") {
    let data = ""
    for await (const part of request) {
      data += part
      if (data.length > 65536) return response.writeHead(413).end()
    }
    const result = JSON.parse(data)
    if (result.source.sha256 !== createHash("sha256").update(stylesheet).digest("hex"))
      return response.writeHead(409).end()
    if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + "\n")
    return response.writeHead(201).end()
  }
  const resource = routes.get(request.url)
  if (!resource) return response.writeHead(404).end()
  response.writeHead(200, { "Content-Type": resource[0], "Cache-Control": "no-store" }).end(resource[1])
})
server.listen(0, "127.0.0.1", () => log(`Panel filter reference: http://127.0.0.1:${server.address().port}`))
