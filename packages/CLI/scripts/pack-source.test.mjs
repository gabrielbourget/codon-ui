import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  cleanupPackSource,
  INTEGRITY_FILE_NAME,
  PACKAGED_SOURCE_ROOT,
  preparePackSource,
  readRequiredRegistryFileNames,
  verifyPackSource,
  WEB_REGISTRY_FILE_NAMES,
} from "./pack-source.mjs"

const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const nativeFileName = "future-native.registry.json"
const sourcePath = "packages/react/component.tsx"
const sha256 = (content) => `sha256:${createHash("sha256").update(content).digest("hex")}`

const write = (filePath, content) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

const fixture = (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "codon-ui-pack-test-"))
  context.after(() => rmSync(temporaryRoot, { force: true, recursive: true }))
  const repoRoot = path.join(temporaryRoot, "repo")
  const packageRoot = path.join(repoRoot, "packages/CLI")
  const distRoot = path.join(packageRoot, "dist")
  const registryRoot = path.join(packageRoot, "registry")
  write(path.join(distRoot, "index.js"), "// built CLI\n")
  write(path.join(repoRoot, sourcePath), "export const component = true\n")

  const snapshot = {
    schemaVersion: 1,
    sourceIdentity: "test-web",
    sourceRoot: "../../..",
    items: [{ name: "component", files: [{ sourcePath }] }],
  }
  const writeSnapshot = (name, value) => write(path.join(registryRoot, name), JSON.stringify(value))
  WEB_REGISTRY_FILE_NAMES.forEach((name) => writeSnapshot(name, snapshot))
  return { temporaryRoot, repoRoot, packageRoot, distRoot, registryRoot, snapshot, writeSnapshot }
}

test("preserves web snapshot metadata and source bytes, deduplicates shared files, and prepares deterministically", (context) => {
  const setup = fixture(context)
  setup.snapshot.metadata = { retained: true }
  setup.writeSnapshot(WEB_REGISTRY_FILE_NAMES[0], setup.snapshot)
  const result = preparePackSource(setup)
  assert.equal(result.sourceFileCount, 1)
  assert.deepEqual(result.snapshotFileNames, [...WEB_REGISTRY_FILE_NAMES].sort())
  assert.deepEqual(JSON.parse(readFileSync(path.join(setup.distRoot, "registry", WEB_REGISTRY_FILE_NAMES[0]))), {
    ...setup.snapshot,
    sourceRoot: PACKAGED_SOURCE_ROOT,
  })
  const packagedSource = path.join(setup.distRoot, "registry-source", sourcePath)
  assert.deepEqual(readFileSync(packagedSource), readFileSync(path.join(setup.repoRoot, sourcePath)))
  const firstManifest = readFileSync(path.join(setup.distRoot, INTEGRITY_FILE_NAME))
  preparePackSource(setup)
  assert.deepEqual(readFileSync(path.join(setup.distRoot, INTEGRITY_FILE_NAME)), firstManifest)
})

test("discovers native-shaped snapshots and preserves all listed native byte formats after relocation without repository sources", (context) => {
  const setup = fixture(context)
  const nativePaths = ["src/NativeView.tsx", "ios/View.mm", "android/View.java", "cpp/View.cpp", "asset.bin"]
  const content = Buffer.from([0, 10, 13, 128, 255])
  nativePaths.forEach((filePath) => write(path.join(setup.repoRoot, "native", filePath), content))
  const nativeSnapshot = {
    ...setup.snapshot,
    sourceIdentity: "test-native",
    sourceRoot: "../../../native",
    items: [
      {
        name: "native",
        files: nativePaths.map((filePath) => ({ sourcePath: filePath, contentHash: sha256(content) })),
      },
    ],
  }
  setup.writeSnapshot(nativeFileName, nativeSnapshot)
  const result = preparePackSource(setup)
  assert.equal(result.snapshotFileNames.length, 3)
  assert.equal(result.sourceFileCount, 6)
  const relocatedDistRoot = path.join(setup.temporaryRoot, "relocated/dist")
  cpSync(setup.distRoot, relocatedDistRoot, { recursive: true })
  rmSync(setup.repoRoot, { recursive: true })
  assert.deepEqual(verifyPackSource({ distRoot: relocatedDistRoot, requiredFileNames: [nativeFileName] }), result)
  nativePaths.forEach((filePath) =>
    assert.deepEqual(readFileSync(path.join(relocatedDistRoot, "registry-source", filePath)), content),
  )
})

test("missing required native artifact fails clearly and removes stale prepared output", (context) => {
  const setup = fixture(context)
  preparePackSource(setup)
  assert.throws(
    () => preparePackSource({ ...setup, requiredFileNames: [nativeFileName] }),
    /Required registry snapshot future-native.registry.json is missing/u,
  )
  for (const name of ["registry", "registry-source", INTEGRITY_FILE_NAME]) {
    assert.equal(existsSync(path.join(setup.distRoot, name)), false)
  }
  assert.equal(existsSync(path.join(setup.distRoot, "index.js")), true)
})

for (const mode of ["changed source", "changed snapshot", "deleted source", "extra source", "changed manifest"]) {
  test(`integrity verification rejects ${mode}`, (context) => {
    const setup = fixture(context)
    preparePackSource(setup)
    if (mode === "changed source") write(path.join(setup.distRoot, "registry-source", sourcePath), "tampered")
    if (mode === "changed snapshot") write(path.join(setup.distRoot, "registry", WEB_REGISTRY_FILE_NAMES[0]), "{}")
    if (mode === "deleted source") rmSync(path.join(setup.distRoot, "registry-source", sourcePath))
    if (mode === "extra source") write(path.join(setup.distRoot, "registry-source/extra.mm"), "extra")
    if (mode === "changed manifest") {
      const manifestPath = path.join(setup.distRoot, INTEGRITY_FILE_NAME)
      const manifest = JSON.parse(readFileSync(manifestPath))
      manifest.files[0].contentHash = sha256("wrong")
      write(manifestPath, JSON.stringify(manifest))
    }
    assert.throws(() => verifyPackSource(setup), /integrity mismatch/u)
  })
}

test("rejects missing sources, stale declared hashes, malformed snapshots and unsupported schema versions", (context) => {
  const setup = fixture(context)
  for (const [snapshot, expectedError] of [
    [{ ...setup.snapshot, items: [{ files: [{ sourcePath: "missing.mm" }] }] }, /source file is missing/u],
    [
      { ...setup.snapshot, items: [{ files: [{ sourcePath, contentHash: sha256("wrong") }] }] },
      /contentHash does not match/u,
    ],
    [
      { ...setup.snapshot, items: [{ files: [{ sourcePath, contentHash: "sha1:unsupported" }] }] },
      /Unsupported contentHash/u,
    ],
    [{ ...setup.snapshot, schemaVersion: 2 }, /schemaVersion 1/u],
    [{ ...setup.snapshot, items: [] }, /nonempty items/u],
    [{ ...setup.snapshot, items: [{}] }, /without source files/u],
  ]) {
    setup.writeSnapshot(nativeFileName, snapshot)
    assert.throws(() => preparePackSource(setup), expectedError)
  }
  write(path.join(setup.registryRoot, nativeFileName), "not JSON")
  assert.throws(() => preparePackSource(setup), /not valid JSON/u)
})

test("rejects paths that escape or cannot be represented portably", (context) => {
  const setup = fixture(context)
  for (const invalidPath of [
    "../outside.mm",
    "/absolute.mm",
    "C:/drive.mm",
    "native\\view.mm",
    "./view.mm",
    "a//b.mm",
    "NUL.mm",
    "a/b.",
    "a/b ",
    "a/\u0000.mm",
  ]) {
    setup.writeSnapshot(nativeFileName, { ...setup.snapshot, items: [{ files: [{ sourcePath: invalidPath }] }] })
    assert.throws(() => preparePackSource(setup), /Non-portable registry path/u)
  }
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, sourceRoot: "../../../.." })
  assert.throws(() => preparePackSource(setup), /escapes its allowed root/u)
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, sourceRoot: setup.repoRoot })
  assert.throws(() => preparePackSource(setup), /relative sourceRoot/u)
})

test("rejects symlink escapes in source files and snapshot files", (context) => {
  const setup = fixture(context)
  const outsidePath = path.join(setup.temporaryRoot, "outside.mm")
  write(outsidePath, "outside")
  symlinkSync(outsidePath, path.join(setup.repoRoot, "escape.mm"))
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, items: [{ files: [{ sourcePath: "escape.mm" }] }] })
  assert.throws(() => preparePackSource(setup), /escapes its allowed root/u)
  rmSync(path.join(setup.registryRoot, nativeFileName))
  write(outsidePath, JSON.stringify(setup.snapshot))
  symlinkSync(outsidePath, path.join(setup.registryRoot, nativeFileName))
  assert.throws(() => preparePackSource(setup), /escapes its allowed root/u)
})

test("rejects symlinks in packaged files even when they point to identical bytes", (context) => {
  const setup = fixture(context)
  preparePackSource(setup)
  const packagedPath = path.join(setup.distRoot, "registry-source", sourcePath)
  rmSync(packagedPath)
  symlinkSync(path.join(setup.repoRoot, sourcePath), packagedPath)
  assert.throws(() => verifyPackSource(setup), /must not contain symlinks/u)
})

test("rejects source collisions between snapshots and case-insensitive path aliases", (context) => {
  const setup = fixture(context)
  write(path.join(setup.repoRoot, "alternative", sourcePath), "different bytes")
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, sourceRoot: "../../../alternative" })
  assert.throws(() => preparePackSource(setup), /Conflicting registry source bytes/u)
  const aliasPath = sourcePath.toUpperCase()
  write(path.join(setup.repoRoot, aliasPath), "export const component = true\n")
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, items: [{ files: [{ sourcePath: aliasPath }] }] })
  assert.throws(() => preparePackSource(setup), /differ only by case/u)
})

test("rejects directory aliases and Unicode normalization collisions before packing", (context) => {
  const setup = fixture(context)
  for (const [firstPath, secondPath] of [
    ["Native/one.mm", "native/two.mm"],
    ["caf\u00e9/one.mm", "cafe\u0301/two.mm"],
  ]) {
    for (const filePath of [firstPath, secondPath]) write(path.join(setup.repoRoot, filePath), "same bytes")
    setup.writeSnapshot(nativeFileName, {
      ...setup.snapshot,
      items: [{ files: [{ sourcePath: firstPath }, { sourcePath: secondPath }] }],
    })
    assert.throws(() => preparePackSource(setup), /differ only by case or Unicode normalization/u)
  }
})

test("rejects unreferenced source files even if their bytes are listed in the integrity manifest", (context) => {
  const setup = fixture(context)
  preparePackSource(setup)
  const extraPath = "registry-source/unreferenced.mm"
  const content = "unreferenced"
  write(path.join(setup.distRoot, extraPath), content)
  const manifestPath = path.join(setup.distRoot, INTEGRITY_FILE_NAME)
  const manifest = JSON.parse(readFileSync(manifestPath))
  manifest.files.push({ path: extraPath, size: content.length, contentHash: sha256(content) })
  manifest.files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  write(manifestPath, JSON.stringify(manifest))
  assert.throws(() => verifyPackSource(setup), /inventory does not exactly match registry snapshot references/u)
})

test("requires the existing web snapshots and a built CLI", (context) => {
  const setup = fixture(context)
  rmSync(path.join(setup.registryRoot, WEB_REGISTRY_FILE_NAMES[0]))
  assert.throws(() => preparePackSource(setup), /Required registry snapshot local-react.registry.json is missing/u)
  rmSync(path.join(setup.distRoot, "index.js"))
  assert.throws(() => preparePackSource(setup), /dist\/index.js is missing/u)
})

test("validates explicit required registry arguments", () => {
  assert.deepEqual(readRequiredRegistryFileNames([]), [])
  assert.deepEqual(
    readRequiredRegistryFileNames([
      "--require-registry",
      nativeFileName,
      "--require-registry",
      "support.registry.json",
    ]),
    [nativeFileName, "support.registry.json"],
  )
  for (const args of [
    ["--native"],
    ["--require-registry"],
    ["--require-registry", "../native.registry.json"],
    ["--require-registry", "native.json"],
  ]) {
    assert.throws(() => readRequiredRegistryFileNames(args), /Usage:|Non-portable|snapshot filename/u)
  }
})

test("prepack and postpack wrappers discover native files and clean only generated registry output", (context) => {
  const setup = fixture(context)
  cpSync(scriptRoot, path.join(setup.packageRoot, "scripts"), { recursive: true })
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, sourceIdentity: "test-native" })
  setup.writeSnapshot("local-native.registry.json", {
    ...setup.snapshot,
    sourceIdentity: "@codon-ui/react-native-local",
  })
  const runScript = (name, args = []) =>
    execFileSync(process.execPath, [path.join(setup.packageRoot, "scripts", name), ...args], { encoding: "utf8" })
  assert.match(
    runScript("prepare-pack-source.mjs", ["--require-registry", nativeFileName]),
    /prepared 4 registry snapshot/u,
  )
  assert.equal(existsSync(path.join(setup.distRoot, "registry", nativeFileName)), true)
  runScript("cleanup-pack-source.mjs")
  assert.equal(existsSync(path.join(setup.distRoot, INTEGRITY_FILE_NAME)), false)
  assert.equal(existsSync(path.join(setup.distRoot, "index.js")), true)
  const missing = spawnSync(
    process.execPath,
    [
      path.join(setup.packageRoot, "scripts/prepare-pack-source.mjs"),
      "--require-registry",
      "missing-native.registry.json",
    ],
    { encoding: "utf8" },
  )
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /Required registry snapshot missing-native.registry.json is missing/u)
  cleanupPackSource(setup.distRoot)
})

test("npm pack dry-run includes discovered native snapshots and integrity data, and propagates required snapshots", (context) => {
  const setup = fixture(context)
  cpSync(scriptRoot, path.join(setup.packageRoot, "scripts"), { recursive: true })
  write(
    path.join(setup.packageRoot, "package.json"),
    JSON.stringify({ name: "codon-ui-pack-fixture", version: "0.0.0", type: "module", files: ["dist"] }),
  )
  for (const name of ["contracts.js", "contracts.d.ts", "index.d.ts"]) {
    write(path.join(setup.distRoot, name), "// fixture\n")
  }
  setup.writeSnapshot(nativeFileName, { ...setup.snapshot, sourceIdentity: "test-native" })
  setup.writeSnapshot("local-native.registry.json", {
    ...setup.snapshot,
    sourceIdentity: "@codon-ui/react-native-local",
  })
  const scriptPath = path.join(setup.packageRoot, "scripts/npm-pack-dry-run.mjs")
  const result = spawnSync(process.execPath, [scriptPath, "--require-registry", nativeFileName], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /prepared 4 registry snapshot/u)
  assert.match(result.stdout, /verified \d+ packaged files/u)
  assert.equal(existsSync(path.join(setup.distRoot, INTEGRITY_FILE_NAME)), false)
  const missing = spawnSync(process.execPath, [scriptPath, "--require-registry", "missing-native.registry.json"], {
    encoding: "utf8",
  })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /Required registry snapshot missing-native.registry.json is missing/u)
  assert.equal(existsSync(path.join(setup.distRoot, "registry")), false)
})

test("packs inactive native composition and module-format variants with the same integrity checks", (context) => {
  const setup = fixture(context)
  const ref = (name) => ({ sourcePath: `native/${name}`, contentHash: sha256(name) })
  for (const name of ["core.mm", "table.mm", "module.js", "common.cjs"])
    write(path.join(setup.repoRoot, "native", name), name)
  const snapshot = {
    ...setup.snapshot,
    sourceIdentity: "@codon-ui/react-native-local",
    native: {
      schemaVersion: 1,
      composition: { core: [ref("core.mm")], table: [ref("table.mm")] },
      rootConfig: { module: ref("module.js"), commonjs: ref("common.cjs") },
    },
  }
  setup.writeSnapshot(nativeFileName, snapshot)
  assert.equal(preparePackSource(setup).sourceFileCount, 5)
  for (const name of ["core.mm", "table.mm", "module.js", "common.cjs"])
    assert.equal(readFileSync(path.join(setup.distRoot, "registry-source/native", name), "utf8"), name)
  write(path.join(setup.distRoot, "registry-source/native/table.mm"), "changed")
  assert.throws(() => verifyPackSource(setup), /integrity mismatch/)
})
