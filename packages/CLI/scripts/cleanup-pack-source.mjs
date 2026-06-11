import { rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

rmSync(path.join(packageRoot, "dist/registry"), { force: true, recursive: true })
rmSync(path.join(packageRoot, "dist/registry-source"), { force: true, recursive: true })

console.log("[codon-ui-cli-pack] cleaned generated package registry source.")
