import { rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageDirectory = dirname(fileURLToPath(import.meta.url))

rmSync(resolve(packageDirectory, "dist"), { recursive: true, force: true })
