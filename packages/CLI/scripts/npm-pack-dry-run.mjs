import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distRoot = path.join(packageRoot, "dist")
const preparePackSourcePath = path.join(packageRoot, "scripts", "prepare-pack-source.mjs")
const cleanupPackSourcePath = path.join(packageRoot, "scripts", "cleanup-pack-source.mjs")
const temporaryNpmRoot = mkdtempSync(path.join(tmpdir(), "codon-ui-npm-pack-"))
const temporaryUserConfigPath = path.join(temporaryNpmRoot, "user.npmrc")
const packEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([environmentName]) => !environmentName.toLowerCase().startsWith("npm_config_")),
)

packEnvironment.NPM_CONFIG_CACHE = path.join(temporaryNpmRoot, "cache")
packEnvironment.NPM_CONFIG_USERCONFIG = temporaryUserConfigPath
writeFileSync(temporaryUserConfigPath, "", "utf8")

const collectFiles = (directoryPath, relativeRoot = "") =>
  readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeRoot, entry.name)
    const absolutePath = path.join(directoryPath, entry.name)

    return entry.isDirectory() ? collectFiles(absolutePath, relativePath) : [relativePath]
  })

const fail = (message) => {
  throw new Error(`[codon-ui-cli-pack] ${message}`)
}

try {
  execFileSync(process.execPath, [preparePackSourcePath], { cwd: packageRoot, stdio: "inherit" })

  const expectedDistPaths = collectFiles(distRoot)
    .map((relativePath) => path.posix.join("dist", relativePath))
    .sort()
  const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: packageRoot,
    encoding: "utf8",
    env: packEnvironment,
  })
  const packResults = JSON.parse(packOutput)

  if (!Array.isArray(packResults) || packResults.length !== 1) {
    fail(`expected one npm pack result, received ${Array.isArray(packResults) ? packResults.length : "invalid JSON"}.`)
  }

  const packagedPaths = (packResults[0].files ?? []).map((file) => file.path).sort()
  const packagedDistPaths = packagedPaths.filter((packagedPath) => packagedPath.startsWith("dist/"))
  const unexpectedRootPaths = packagedPaths.filter(
    (packagedPath) => packagedPath !== "package.json" && !packagedPath.startsWith("dist/"),
  )
  const requiredPaths = [
    "dist/contracts.d.ts",
    "dist/contracts.js",
    "dist/index.d.ts",
    "dist/index.js",
    "dist/registry/local-react-support.registry.json",
    "dist/registry/local-react.registry.json",
    "package.json",
  ]

  if (JSON.stringify(packagedDistPaths) !== JSON.stringify(expectedDistPaths)) {
    fail("npm's dry-run dist manifest does not exactly match the prepared package dist tree.")
  }

  if (unexpectedRootPaths.length > 0) {
    fail(`npm's dry-run manifest contains unexpected root paths: ${unexpectedRootPaths.join(", ")}.`)
  }

  requiredPaths.forEach((requiredPath) => {
    if (!packagedPaths.includes(requiredPath)) fail(`required file ${requiredPath} is missing.`)
  })

  console.log(`[codon-ui-cli-pack] verified ${packagedPaths.length} packaged files for @codon-ui/cli.`)
} finally {
  execFileSync(process.execPath, [cleanupPackSourcePath], { cwd: packageRoot, stdio: "inherit" })
  rmSync(temporaryNpmRoot, { force: true, recursive: true })
}
