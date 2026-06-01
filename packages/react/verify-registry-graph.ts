import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { reactRegistryManifest, resolveRegistryInstallGraph } from "./src/registry"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, "../..")

const fail = (message: string) => {
  console.error(`[registry-graph-smoke] ${message}`)
  process.exitCode = 1
}

const resolution = resolveRegistryInstallGraph(reactRegistryManifest)

resolution.issues.forEach((issue) => {
  fail(issue.message)
})

let sourceFileCount = 0

resolution.items.forEach(({ item }) => {
  item.files.forEach((file) => {
    const sourceContent = readFileSync(path.join(repoRoot, file.sourcePath), "utf8")

    if (!sourceContent.trim()) {
      fail(`Registry item "${item.name}" has an empty source file at ${file.sourcePath}.`)
    }

    sourceFileCount += 1
  })
})

if (process.exitCode) {
  process.exit()
}

const resolvedItemNames = resolution.items.map(({ item }) => item.name).join(", ")

console.log(
  `[registry-graph-smoke] resolved ${resolution.items.length} item(s) and read ${sourceFileCount} source file(s): ${resolvedItemNames}.`,
)
