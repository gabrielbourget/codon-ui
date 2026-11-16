import path from "node:path"
import { fileURLToPath } from "node:url"

import { cleanupPackSource } from "./pack-source.mjs"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

cleanupPackSource(path.join(packageRoot, "dist"))

console.log("[codon-ui-cli-pack] cleaned generated package registry source.")
