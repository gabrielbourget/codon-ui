import { createHash } from "node:crypto"
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

export const PACKAGED_SOURCE_ROOT = "../registry-source"
export const INTEGRITY_FILE_NAME = "registry-source.integrity.json"
export const WEB_REGISTRY_FILE_NAMES = ["local-react.registry.json", "local-react-support.registry.json"]

const fail = (message) => {
  throw new Error(`[codon-ui-cli-pack] ${message}`)
}

const hash = (content) => `sha256:${createHash("sha256").update(content).digest("hex")}`

const assertPortablePath = (value) => {
  if (
    typeof value !== "string" ||
    !value ||
    /[\\:\x00-\x1f\x7f<>"|?*]/u.test(value) ||
    value.split("/").some((segment) => !segment || segment === "." || segment === ".." || /[. ]$/u.test(segment)) ||
    value.split("/").some((segment) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment))
  ) {
    fail(`Non-portable registry path ${JSON.stringify(value)}.`)
  }
}

const assertRegistryFileName = (fileName) => {
  assertPortablePath(fileName)
  if (fileName.includes("/") || !fileName.endsWith(".registry.json")) {
    fail(`Expected a registry snapshot filename, received ${JSON.stringify(fileName)}.`)
  }
}

export const readRequiredRegistryFileNames = (args) => {
  const requiredFileNames = []
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== "--require-registry" || !args[index + 1]) {
      fail("Usage: [--require-registry <snapshot.registry.json>] (repeatable).")
    }
    assertRegistryFileName(args[index + 1])
    requiredFileNames.push(args[index + 1])
  }
  return requiredFileNames
}

const assertContained = (root, candidate) => {
  const relativePath = path.relative(root, candidate)
  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    fail(`Registry source escapes its allowed root: ${candidate}.`)
  }
}

const readSourceFile = (root, sourcePath) => {
  assertPortablePath(sourcePath)
  let resolvedPath
  try {
    resolvedPath = realpathSync(path.join(root, sourcePath))
  } catch {
    fail(`Registry source file is missing at ${sourcePath}.`)
  }
  assertContained(realpathSync(root), resolvedPath)
  if (!lstatSync(resolvedPath).isFile()) fail(`Registry source is not a regular file: ${sourcePath}.`)
  return readFileSync(resolvedPath)
}

const parseSnapshot = (content, fileName) => {
  let snapshot
  try {
    snapshot = JSON.parse(content.toString("utf8"))
  } catch {
    fail(`Registry snapshot ${fileName} is not valid JSON.`)
  }
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    typeof snapshot.sourceIdentity !== "string" ||
    !snapshot.sourceIdentity ||
    (snapshot.sourceRoot !== undefined && (typeof snapshot.sourceRoot !== "string" || !snapshot.sourceRoot)) ||
    !Array.isArray(snapshot.items) ||
    !snapshot.items.length
  ) {
    fail(`Registry snapshot ${fileName} must use schemaVersion 1 with a sourceIdentity and nonempty items.`)
  }
  for (const item of snapshot.items) {
    if (!item || !Array.isArray(item.files) || !item.files.length) {
      fail(`Registry snapshot ${fileName} has an item without source files.`)
    }
    for (const file of item.files) {
      assertPortablePath(file?.sourcePath)
      if (file.contentHash !== undefined && !/^sha256:[a-f0-9]{64}$/u.test(file.contentHash)) {
        fail(`Unsupported contentHash for ${file.sourcePath} in ${fileName}; expected sha256:<hex>.`)
      }
    }
  }
  return snapshot
}

const registryFileNames = (registryRoot, requiredFileNames) => {
  const fileNames = readdirSync(registryRoot).filter((fileName) => fileName.endsWith(".registry.json"))
  for (const fileName of [...WEB_REGISTRY_FILE_NAMES, ...requiredFileNames]) {
    assertRegistryFileName(fileName)
    if (!fileNames.includes(fileName)) {
      fail(`Required registry snapshot ${fileName} is missing. Generate it before packing; no fallback is available.`)
    }
  }
  fileNames.forEach(assertRegistryFileName)
  return fileNames.sort()
}

export const cleanupPackSource = (distRoot) => {
  for (const entry of ["registry", "registry-source", INTEGRITY_FILE_NAME]) {
    rmSync(path.join(distRoot, entry), { force: true, recursive: true })
  }
}

const collectFiles = (root, relativeRoot) => {
  const directoryPath = path.join(root, relativeRoot)
  if (!lstatSync(directoryPath).isDirectory()) fail(`Expected a regular package directory: ${relativeRoot}.`)
  return readdirSync(directoryPath).flatMap((name) => {
    const relativePath = path.posix.join(relativeRoot, name)
    assertPortablePath(relativePath)
    const stat = lstatSync(path.join(root, relativePath))
    if (stat.isSymbolicLink()) fail(`Packaged registry files must not contain symlinks: ${relativePath}.`)
    if (stat.isDirectory()) return collectFiles(root, relativePath)
    if (!stat.isFile()) fail(`Packaged registry source is not a regular file: ${relativePath}.`)
    return [relativePath]
  })
}

const integrityFiles = (distRoot) =>
  [...collectFiles(distRoot, "registry"), ...collectFiles(distRoot, "registry-source")].sort().map((relativePath) => {
    const content = readFileSync(path.join(distRoot, relativePath))
    return { path: relativePath, size: content.length, contentHash: hash(content) }
  })

export const verifyPackSource = ({ distRoot, requiredFileNames = [] }) => {
  const manifest = JSON.parse(readFileSync(path.join(distRoot, INTEGRITY_FILE_NAME), "utf8"))
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.files)) fail("Invalid package integrity manifest.")
  const actualFiles = integrityFiles(distRoot)
  if (JSON.stringify(manifest.files) !== JSON.stringify(actualFiles)) {
    fail("Packaged registry integrity mismatch: source bytes, snapshots or file inventory changed.")
  }

  const registryRoot = path.join(distRoot, "registry")
  const snapshotFileNames = registryFileNames(registryRoot, requiredFileNames)
  const expectedPaths = new Set(snapshotFileNames.map((fileName) => `registry/${fileName}`))
  for (const fileName of snapshotFileNames) {
    const snapshot = parseSnapshot(readFileSync(path.join(registryRoot, fileName)), fileName)
    if (snapshot.sourceRoot !== PACKAGED_SOURCE_ROOT)
      fail(`Packaged snapshot ${fileName} has a nonportable sourceRoot.`)
    for (const item of snapshot.items) {
      for (const file of item.files) {
        const sourcePath = `registry-source/${file.sourcePath}`
        const content = readSourceFile(path.join(distRoot, "registry-source"), file.sourcePath)
        if (file.contentHash !== undefined && file.contentHash !== hash(content)) {
          fail(`Declared contentHash does not match source bytes: ${file.sourcePath}.`)
        }
        expectedPaths.add(sourcePath)
      }
    }
  }
  if (JSON.stringify([...expectedPaths].sort()) !== JSON.stringify(actualFiles.map((file) => file.path))) {
    fail("Packaged file inventory does not exactly match registry snapshot references.")
  }
  return { snapshotFileNames, sourceFileCount: expectedPaths.size - snapshotFileNames.length }
}

export const preparePackSource = ({ packageRoot, repoRoot, requiredFileNames = [] }) => {
  const distRoot = path.join(packageRoot, "dist")
  cleanupPackSource(distRoot)
  try {
    if (!lstatSync(path.join(distRoot, "index.js"), { throwIfNoEntry: false })?.isFile()) {
      fail("dist/index.js is missing. Run pnpm -F @codon-ui/cli build before packing.")
    }

    const registryRoot = path.join(packageRoot, "registry")
    const snapshotFileNames = registryFileNames(registryRoot, requiredFileNames)
    const sourceFiles = new Map()
    const packagedFiles = new Map()
    const portablePaths = new Map()
    const assertUniqueCasing = (filePath) => {
      const segments = filePath.split("/")
      for (let length = 1; length <= segments.length; length += 1) {
        const prefix = segments.slice(0, length).join("/")
        const key = prefix.normalize("NFC").toLowerCase()
        const previousPath = portablePaths.get(key)
        if (previousPath && previousPath !== prefix) {
          fail(`Registry paths differ only by case or Unicode normalization: ${previousPath}, ${prefix}.`)
        }
        portablePaths.set(key, prefix)
      }
    }

    for (const fileName of snapshotFileNames) {
      assertUniqueCasing(`registry/${fileName}`)
      const snapshot = parseSnapshot(readSourceFile(registryRoot, fileName), fileName)
      if (
        snapshot.sourceRoot &&
        (path.posix.isAbsolute(snapshot.sourceRoot) || path.win32.isAbsolute(snapshot.sourceRoot))
      ) {
        fail(`Registry snapshot ${fileName} must use a relative sourceRoot.`)
      }
      const sourceRoot = realpathSync(path.resolve(registryRoot, snapshot.sourceRoot ?? "."))
      assertContained(realpathSync(repoRoot), sourceRoot)
      for (const item of snapshot.items) {
        for (const file of item.files) {
          assertUniqueCasing(`registry-source/${file.sourcePath}`)
          const content = readSourceFile(sourceRoot, file.sourcePath)
          if (file.contentHash !== undefined && file.contentHash !== hash(content)) {
            fail(`Declared contentHash does not match source bytes: ${file.sourcePath}.`)
          }
          const previousContent = sourceFiles.get(file.sourcePath)
          if (previousContent && !previousContent.equals(content)) {
            fail(`Conflicting registry source bytes for ${file.sourcePath}.`)
          }
          sourceFiles.set(file.sourcePath, content)
        }
      }
      packagedFiles.set(
        `registry/${fileName}`,
        Buffer.from(`${JSON.stringify({ ...snapshot, sourceRoot: PACKAGED_SOURCE_ROOT }, null, 2)}\n`),
      )
    }
    for (const [sourcePath, content] of sourceFiles) packagedFiles.set(`registry-source/${sourcePath}`, content)
    for (const [relativePath, content] of packagedFiles) {
      const destination = path.join(distRoot, relativePath)
      mkdirSync(path.dirname(destination), { recursive: true })
      writeFileSync(destination, content)
    }
    writeFileSync(
      path.join(distRoot, INTEGRITY_FILE_NAME),
      `${JSON.stringify({ schemaVersion: 1, files: integrityFiles(distRoot) }, null, 2)}\n`,
    )
    return verifyPackSource({ distRoot, requiredFileNames })
  } catch (error) {
    cleanupPackSource(distRoot)
    throw error
  }
}
