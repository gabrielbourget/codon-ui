import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PACKAGED_REGISTRY_SOURCE_ROOT = "../registry-source"
const registrySnapshotFileNames = ["local-react.registry.json", "local-react-support.registry.json"]

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(packageRoot, "../..")
const distRoot = path.join(packageRoot, "dist")
const generatedRegistryRoot = path.join(distRoot, "registry")
const generatedSourceRoot = path.join(distRoot, "registry-source")
const sourceRegistryRoot = path.join(packageRoot, "registry")

const fail = (message) => {
  console.error(`[codon-ui-cli-pack] ${message}`)
  process.exit(1)
}

if (!existsSync(path.join(distRoot, "index.js"))) {
  fail("dist/index.js is missing. Run pnpm -F @codon-ui/cli build before packing.")
}

rmSync(generatedRegistryRoot, { force: true, recursive: true })
rmSync(generatedSourceRoot, { force: true, recursive: true })
mkdirSync(generatedRegistryRoot, { recursive: true })
mkdirSync(generatedSourceRoot, { recursive: true })

const sourcePaths = new Set()

for (const snapshotFileName of registrySnapshotFileNames) {
  const sourceSnapshotPath = path.join(sourceRegistryRoot, snapshotFileName)
  const snapshot = JSON.parse(readFileSync(sourceSnapshotPath, "utf8"))
  const packagedSnapshot = {
    schemaVersion: snapshot.schemaVersion,
    sourceIdentity: snapshot.sourceIdentity,
    sourceRoot: PACKAGED_REGISTRY_SOURCE_ROOT,
    items: snapshot.items,
  }

  snapshot.items.forEach((item) => {
    item.files.forEach((file) => {
      sourcePaths.add(file.sourcePath)
    })
  })

  writeFileSync(
    path.join(generatedRegistryRoot, snapshotFileName),
    `${JSON.stringify(packagedSnapshot, null, 2)}\n`,
    "utf8",
  )
}

for (const sourcePath of [...sourcePaths].sort()) {
  const absoluteSourcePath = path.join(repoRoot, sourcePath)
  const packagedSourcePath = path.join(generatedSourceRoot, sourcePath)

  if (!existsSync(absoluteSourcePath)) {
    fail(`Registry source file is missing at ${sourcePath}.`)
  }

  mkdirSync(path.dirname(packagedSourcePath), { recursive: true })
  cpSync(absoluteSourcePath, packagedSourcePath)
}

console.log(
  `[codon-ui-cli-pack] prepared ${sourcePaths.size} registry source file(s) under ${path.relative(
    packageRoot,
    generatedSourceRoot,
  )}.`,
)
