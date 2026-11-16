import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Source-only producer/consumer regression; no SDK or native runtime proof.
const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const repository = path.resolve(packageRoot, "../..")
const root = realpathSync(mkdtempSync(path.join(tmpdir(), "codon-native-update-")))
const consumer = path.join(root, "consumer")
const producer = path.join(root, "producer")
const hash = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`
const put = (name: string, text: string) => {
  writeFileSync(path.join(producer, name), text)
  return hash(text)
}
const file = (
  sourcePath: string,
  targetRole: "components" | "utils" | "assets",
  targetPath: string,
  contentHash: string,
) => ({ sourcePath, targetRole, targetPath, contentHash, role: "source" })
const invoke = (args: string[], success = true) => {
  const run = spawnSync(
    process.execPath,
    [
      path.join(repository, "node_modules/tsx/dist/cli.mjs"),
      path.join(packageRoot, "src/index.ts"),
      ...args,
      "--cwd",
      consumer,
      "--json",
    ],
    { cwd: packageRoot, encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
  )
  assert.ifError(run.error)
  const report = JSON.parse(run.stdout)
  assert.equal(run.status, success ? 0 : 1, JSON.stringify({ args, report, stderr: run.stderr }))
  return report
}
try {
  mkdirSync(consumer)
  mkdirSync(producer)
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({
      name: "native-update-control",
      private: true,
      packageManager: "pnpm@10.18.3",
      dependencies: { react: "19.2.3", "react-native": "0.86.3", expo: "57.0.26" },
    }),
  )
  const bootstrap = file(
    "bootstrap.cjs",
    "assets",
    "react-native.config.js",
    put("bootstrap.cjs", "module.exports = {}\n"),
  )
  const oldHelper = file("old-helper.ts", "utils", "helpers/old.ts", put("old-helper.ts", "export const value = 1\n"))
  const newHelper = file("new-helper.ts", "utils", "helpers/new.ts", put("new-helper.ts", "export const value = 2\n"))
  const first = file(
    "entry-first.ts",
    "components",
    "Button/index.ts",
    put("entry-first.ts", 'export { value } from "./old-helper"\n'),
  )
  const changed = file(
    "entry-changed.ts",
    "components",
    "Button/index.ts",
    put("entry-changed.ts", 'export { value as nextValue } from "./old-helper"\n'),
  )
  const newClosure = file(
    "entry-new.ts",
    "components",
    "Button/index.ts",
    put("entry-new.ts", 'export { value } from "./new-helper"\n'),
  )
  const coreFactory = file(
    "factory-core.ts",
    "utils",
    "native/factory.ts",
    put("factory-core.ts", "export const table = false\n"),
  )
  const fullFactory = file(
    "factory-full.ts",
    "utils",
    "native/factory.ts",
    put("factory-full.ts", "export const table = true; export const version = 1\n"),
  )
  const nextFullFactory = file(
    "factory-next.ts",
    "utils",
    "native/factory.ts",
    put("factory-next.ts", "export const table = true; export const version = 2\n"),
  )
  const tableRuntime = file(
    "table-runtime.ts",
    "utils",
    "native/table.ts",
    put("table-runtime.ts", "export const runtime = true\n"),
  )
  const tableEntry = file(
    "table-entry.ts",
    "components",
    "Table/index.ts",
    put("table-entry.ts", "export const Table = true\n"),
  )
  const sourcePackage = "@codon-ui/react-native"
  const snapshot = (name: string, entry: ReturnType<typeof file>, helperName: string, factory = fullFactory) => {
    const contents = {
      schemaVersion: 1,
      sourceIdentity: "@codon-ui/react-native-local",
      sourceRoot: ".",
      native: {
        schemaVersion: 1,
        composition: { core: [coreFactory], table: [factory] },
        rootConfig: { module: bootstrap, commonjs: bootstrap },
      },
      items: [
        { name: "old-helper", type: "support", sourcePackage, files: [oldHelper], registryDependencies: [] },
        { name: "new-helper", type: "support", sourcePackage, files: [newHelper], registryDependencies: [] },
        { name: "button", type: "component", sourcePackage, files: [entry], registryDependencies: [helperName] },
        { name: "native-table", type: "support", sourcePackage, files: [tableRuntime], registryDependencies: [] },
        { name: "native-composition", type: "support", sourcePackage, files: [coreFactory], registryDependencies: [] },
        {
          name: "table",
          type: "component",
          sourcePackage,
          files: [tableEntry],
          registryDependencies: ["native-composition"],
        },
      ],
    }
    const target = path.join(producer, name + ".registry.json")
    writeFileSync(target, JSON.stringify(contents))
    return target
  }
  const v1 = snapshot("first", first, "old-helper")
  const sameClosure = snapshot("same-closure", changed, "old-helper")
  const v2 = snapshot("new-closure", newClosure, "new-helper")
  invoke(["init", "--target", "react-native"])
  invoke(["add", "button", "--registry-source", v1])
  const entryPath = path.join(consumer, "src/components/Button/index.ts")
  const lockPath = path.join(consumer, "codon-ui.lock.json")
  const beforeEntry = readFileSync(entryPath, "utf8")
  const beforeLock = readFileSync(lockPath, "utf8")
  const preview = invoke(["update", "button", "--dry-run", "--registry-source", v2])
  assert.equal(
    preview.itemUpdateState,
    "blocked",
    "a changed helper closure must not preview an incomplete component-only update",
  )
  assert.ok(
    preview.blockers.some((item: { code: string }) => item.code === "update-dry-run-native-dependency-closure-drift"),
  )
  const blocked = invoke(["update", "button", "--registry-source", v2], false)
  assert.equal(blocked.applied, false)
  const blockedAll = invoke(["update", "--all", "--registry-source", v2], false)
  assert.equal(blockedAll.applied, false)
  assert.equal(readFileSync(entryPath, "utf8"), beforeEntry)
  assert.equal(readFileSync(lockPath, "utf8"), beforeLock)
  assert.ok(!existsSync(path.join(consumer, "src/components/_codon-ui-registry/utils/helpers/new.ts")))
  const safe = invoke(["update", "button", "--registry-source", sameClosure])
  assert.equal(safe.applied, true)
  assert.match(readFileSync(entryPath, "utf8"), /nextValue/)
  writeFileSync(entryPath, readFileSync(entryPath, "utf8") + "\n// consumer edit\n")
  const protectedLock = readFileSync(lockPath, "utf8")
  const protectedUpdate = invoke(["update", "button", "--registry-source", v1], false)
  assert.equal(protectedUpdate.applied, false)
  assert.match(readFileSync(entryPath, "utf8"), /consumer edit/)
  assert.equal(readFileSync(lockPath, "utf8"), protectedLock)
  invoke(["add", "table", "--registry-source", v1])
  const upgradedProfile = snapshot("upgraded-profile", first, "old-helper", nextFullFactory)
  const profilePreview = invoke(["update", "native-composition", "--dry-run", "--registry-source", upgradedProfile])
  assert.equal(
    profilePreview.files[0].nextSourceHash,
    nextFullFactory.contentHash,
    "changed Table factories must preview the full profile rather than core",
  )
  const profileUpdate = invoke(["update", "native-composition", "--registry-source", upgradedProfile])
  assert.equal(profileUpdate.applied, true)
  assert.match(
    readFileSync(path.join(consumer, "src/components/_codon-ui-registry/utils/native/factory.ts"), "utf8"),
    /table = true; export const version = 2/,
  )
  console.log("[codon-ui] native stable-closure update and conservative dependency-drift/edit protection verified")
} finally {
  rmSync(root, { recursive: true, force: true })
}
