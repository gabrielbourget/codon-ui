import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.join(packageRoot, "src")
const distRoot = path.join(packageRoot, "dist")

const copyCssAssets = (sourceDirectory) => {
  readdirSync(sourceDirectory, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(sourceDirectory, entry.name)

    if (entry.isDirectory()) {
      copyCssAssets(sourcePath)
      return
    }

    if (!entry.isFile() || !entry.name.endsWith(".css")) return

    const relativePath = path.relative(sourceRoot, sourcePath)
    const targetPath = path.join(distRoot, relativePath)

    mkdirSync(path.dirname(targetPath), { recursive: true })
    cpSync(sourcePath, targetPath)
  })
}

if (existsSync(sourceRoot) && existsSync(distRoot)) {
  copyCssAssets(sourceRoot)
}
