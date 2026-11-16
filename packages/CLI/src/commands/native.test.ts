import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, existsSync, realpathSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { assertCliJsonReportContract } from "../testUtils/cliJsonContracts"

const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(packageRoot, "../..")
const showcase = JSON.parse(readFileSync(path.join(repoRoot, "apps/native-showcase/package.json"), "utf8"))
const intl = Object.fromEntries(Object.entries(showcase.dependencies).filter(([name]) => name.startsWith("@formatjs/")))
const root = realpathSync(mkdtempSync(path.join(tmpdir(), "codon-native-cli-")))
const read = (name: string) => readFileSync(path.join(root, name), "utf8")
const native = JSON.parse(readFileSync(path.join(repoRoot, "packages/react-native/package.json"), "utf8"))
const invoke = (args: string[], success = true) => {
  const run = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
      path.join(packageRoot, "src/index.ts"),
      ...args,
      "--cwd",
      root,
      "--json",
    ],
    { cwd: packageRoot, encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
  )
  assert.ifError(run.error)
  const report = JSON.parse(run.stdout)
  assert.equal(run.status, success ? 0 : 1, JSON.stringify({ findings: report.findings, stderr: run.stderr }, null, 2))
  return report
}
try {
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "native-source-consumer",
      private: true,
      type: "module",
      packageManager: "pnpm@10.18.3",
      dependencies: { ...native.peerDependencies, ...native.dependencies, ...intl },
    }),
  )
  const init = invoke(["init", "--target", "react-native"])
  assertCliJsonReportContract({ report: init, schemaName: "initStrict" })
  assert.equal(init.config.registry.sourcePackage, "@codon-ui/react-native")
  const button = invoke(["add", "button"])
  assertCliJsonReportContract({ report: button, schemaName: "addStrict" })
  assert.equal(button.applied, true)
  assert.equal(button.installPlan.sourceIdentity, "@codon-ui/react-native-local")
  const support = "src/components/_codon-ui-registry/utils/native/"
  assert.ok(existsSync(path.join(root, support, "src/components/Button/Button.tsx")))
  assert.ok(!existsSync(path.join(root, support, "cpp/table/StickyPresentation.cpp")))
  assert.match(
    read(support + "android/src/main/java/com/codonui/input/CUINativeFeatures.java"),
    /feature not installed/,
  )
  assert.equal(statSync(path.join(root, support, "src/components/Button/Button.tsx")).nlink, 1)
  const config = await import(path.join(root, "react-native.config.js"))
  assert.equal(config.default.dependencies["@codon-ui/react-native"].root, path.resolve(root, support))
  const lock = read("codon-ui.lock.json")
  const repeat = invoke(["add", "button"])
  assert.equal(repeat.effects.files.writtenCount, 0)
  assert.equal(read("codon-ui.lock.json"), lock)
  const input = invoke(["add", "input"])
  assert.equal(input.applied, true)
  const entry = "src/components/Button/index.ts"
  const original = read(entry)
  writeFileSync(path.join(root, entry), original + "\n// consumer edit\n")
  const before = read("codon-ui.lock.json")
  const blocked = invoke(["add", "button"], false)
  assert.equal(blocked.applied, false)
  assert.equal(read("codon-ui.lock.json"), before)
  assert.match(read(entry), /consumer edit/)
  writeFileSync(path.join(root, entry), original)
  const factoryPath = support + "android/src/main/java/com/codonui/input/CUINativeFeatures.java"
  const factory = read(factoryPath)
  const preTableLock = read("codon-ui.lock.json")
  writeFileSync(path.join(root, factoryPath), factory + "\n// consumer native edit\n")
  const nativeBlocked = invoke(["add", "table"], false)
  assert.equal(nativeBlocked.applied, false)
  assert.equal(read("codon-ui.lock.json"), preTableLock)
  assert.match(read(factoryPath), /consumer native edit/)
  assert.ok(!existsSync(path.join(root, support, "cpp/table/StickyPresentation.cpp")))
  writeFileSync(path.join(root, factoryPath), factory)
  const table = invoke(["add", "table"])
  assert.equal(table.applied, true)
  assert.ok(existsSync(path.join(root, support, "cpp/table/StickyPresentation.cpp")))
  assert.match(
    read(support + "android/src/main/java/com/codonui/input/CUINativeFeatures.java"),
    /new CUITableNativeSession/,
  )
  const tableJNI = read(support + "android/src/main/jni/TableStickyJNI.cpp")
  assert.match(tableJNI, /nativeTablePrepare/)
  assert.match(tableJNI, /nativeTableFrames/)
  const compositionPreview = invoke(["update", "native-composition", "--dry-run"])
  assert.equal(
    compositionPreview.summary.candidateFileCount,
    0,
    "an installed Table must retain its full native composition profile",
  )
  const installed = JSON.parse(read("codon-ui.lock.json"))
  assert.ok(installed.items["native-composition"].registryDependencies.includes("native-table"))
  const removedTable = invoke(["remove", "table", "--with-orphans"])
  assert.equal(removedTable.applied, true)
  assert.ok(!existsSync(path.join(root, "src/components/Table/index.ts")))
  // Other mounted component sources still use the full native factory; its Table dependency stays coherent.
  assert.ok(existsSync(path.join(root, support, "cpp/table/StickyPresentation.cpp")))
  assert.ok(JSON.parse(read("codon-ui.lock.json")).items["native-table"])
  const repeatedInput = invoke(["add", "input"])
  assert.equal(repeatedInput.effects.files.writtenCount, 0)
  const removedButton = invoke(["remove", "button", "--with-orphans"])
  assert.equal(removedButton.applied, true)
  assert.ok(existsSync(path.join(root, "src/components/Input/index.ts")))
  assert.ok(existsSync(path.join(root, factoryPath)))
  const fullFactory = read(factoryPath)
  const beforeLastRemove = read("codon-ui.lock.json")
  writeFileSync(path.join(root, factoryPath), fullFactory + "\n// consumer native edit\n")
  const protectedLast = invoke(["remove", "input", "--with-orphans"], false)
  assert.equal(protectedLast.applied, false)
  assert.equal(read("codon-ui.lock.json"), beforeLastRemove)
  assert.ok(existsSync(path.join(root, "src/components/Input/index.ts")))
  writeFileSync(path.join(root, factoryPath), fullFactory)
  const removedLast = invoke(["remove", "input", "--with-orphans"])
  assert.equal(removedLast.applied, true)
  assert.ok(!existsSync(path.join(root, factoryPath)))
  assert.ok(!existsSync(path.join(root, "react-native.config.js")))
  assert.deepEqual(JSON.parse(read("codon-ui.lock.json")).items, {})
  const all = invoke(["add", "--all"])
  assert.equal(all.applied, true)
  assert.equal(all.installPlan.requestedItems.length, 52)
  assert.ok(existsSync(path.join(root, support, "android/src/main/jni/TableStickyJNI.cpp")))
  const allLock = read("codon-ui.lock.json")
  const repeatAll = invoke(["add", "--all"])
  assert.equal(repeatAll.effects.files.writtenCount, 0)
  assert.equal(read("codon-ui.lock.json"), allLock)
  console.log(
    "[codon-ui] native source add/repeat/shared/local-edit/composition/remove/last-owner/all-52 controls verified",
  )
} finally {
  rmSync(root, { recursive: true, force: true })
}
