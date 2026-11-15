import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  assertAutolink,
  assertCodegenSchema,
  assertDependencies,
  assertEditableFiles,
  assertExternalConsumer,
  assertNativeInputs,
  assertNativePackage,
  assertUnchanged,
  captureNativeInputs,
  consumerPath,
  hash,
  readJson,
  seedConsumer,
  snapshot,
  writeJson,
} from "./consumer-probe.mjs"
import { runLifecycle } from "./run-lifecycle.mjs"

const fixture = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(fixture, "../../../..")
const setup = (context) => {
  const temporary = mkdtempSync(path.join(tmpdir(), "codon-expo-probe-"))
  context.after(() => rmSync(temporary, { recursive: true, force: true }))
  const consumer = path.join(temporary, "consumer")
  mkdirSync(consumer)
  return { temporary, consumer }
}
const put = (root, relative, contents) => {
  const filename = path.join(root, relative)
  mkdirSync(path.dirname(filename), { recursive: true })
  writeFileSync(filename, contents)
}
const manifest = (root, relative, contents) => put(root, relative, `${JSON.stringify(contents)}\n`)
const packageAt = (root, relative, name, version) => {
  manifest(root, `${relative}/package.json`, { name, version, main: "index.js" })
  put(root, `${relative}/index.js`, "module.exports = {}\n")
}
const fakeNativePackage = (root) => {
  const native = "modules/codon-selected"
  manifest(root, `${native}/package.json`, {
    name: "@fixture/codon-selected",
    version: "0.0.1",
    codegenConfig: { name: "SelectedSpec", type: "all", jsSrcsDir: "src/specs" },
  })
  for (const [relative, contents] of Object.entries({
    "src/specs/SelectedNativeComponent.ts": "export const spec = true\n",
    "ios/Selected.mm": "// synthetic native source\n",
    "Selected.podspec": "# synthetic podspec\n",
    "android/build.gradle": "// synthetic Gradle source\n",
    "android/src/Selected.java": "// synthetic native source\n",
    "react-native.config.js": "module.exports = {}\n",
  }))
    put(root, `${native}/${relative}`, contents)
  return { path: native, name: "@fixture/codon-selected", version: "0.0.1", codegenName: "SelectedSpec" }
}
const nodeCommand = (body) => [process.execPath, "-e", `const fs = require('node:fs'); ${body}`]

test("seed creates an external pinned Expo consumer without installing packages or importing the whole library", (context) => {
  const { consumer } = setup(context)
  const result = seedConsumer(consumer, repository)
  const source = readJson(path.join(repository, "apps/native-showcase/package.json"))
  assert.equal(result.pins.dependencies.expo, source.dependencies.expo)
  assert.equal(result.pins.dependencies["react-native"], source.dependencies["react-native"])
  assert.equal(result.pins.dependencies.react, source.dependencies.react)
  assert.equal(result.pins.devDependencies["react-dom"], source.devDependencies["react-dom"])
  assert.match(readFileSync(path.join(consumer, ".npmrc"), "utf8"), /^minimum-release-age=10080\n$/)
  assertExternalConsumer(consumer, repository)
  assert.ok(!Object.keys(result.pins.dependencies).some((name) => name.startsWith("@codon-ui/")))
  assert.ok(!("node_modules" in result.files))
  assert.match(readFileSync(path.join(consumer, "SelectedComponents.tsx"), "utf8"), /throw new Error/)
  assert.throws(() => seedConsumer(consumer, repository), /empty consumer/)
})

test("consumer isolation rejects repository descendants, ancestors, inherited workspaces and alias paths", (context) => {
  const { temporary, consumer } = setup(context)
  assertExternalConsumer(consumer, repository)
  assert.throws(() => assertExternalConsumer(fixture, repository), /outside/)
  assert.throws(() => assertExternalConsumer(path.dirname(repository), repository), /outside/)
  const linked = path.join(temporary, "linked")
  symlinkSync(repository, linked, "dir")
  assert.throws(() => assertExternalConsumer(linked, repository), /outside/)
  put(temporary, "pnpm-workspace.yaml", 'packages: ["*"]\n')
  assert.throws(() => assertExternalConsumer(consumer, repository), /inherits workspace/)
  rmSync(path.join(temporary, "pnpm-workspace.yaml"))
  put(consumer, "pnpm-workspace.yaml", 'packages: ["*"]\n')
  assert.throws(() => assertExternalConsumer(consumer, repository), /inherits workspace/)
})

test("snapshots bind source, config and locks while ignoring installed and generated outputs", (context) => {
  const { consumer } = setup(context)
  put(consumer, "src/Input.tsx", "export const value = 0\n")
  put(consumer, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
  const before = snapshot(consumer)
  put(consumer, "node_modules/peer/index.js", "ignored\n")
  put(consumer, "android/build/generated.cpp", "ignored\n")
  assertUnchanged(before, snapshot(consumer))
  put(consumer, "pnpm-lock.yaml", "changed\n")
  assert.throws(() => assertUnchanged(before, snapshot(consumer)), /pnpm-lock.yaml/)
})

test("snapshots detect additions and removals in addition to changed bytes", (context) => {
  const { consumer } = setup(context)
  put(consumer, "src/a.ts", "a\n")
  const before = snapshot(consumer)
  put(consumer, "src/b.ts", "b\n")
  assert.throws(() => assertUnchanged(before, snapshot(consumer)), /src\/b.ts/)
  rmSync(path.join(consumer, "src/b.ts"))
  rmSync(path.join(consumer, "src/a.ts"))
  assert.throws(() => assertUnchanged(before, snapshot(consumer)), /src\/a.ts/)
})

test("editable source rejects wrong bytes, hardlinks and symlinks to canonical source", (context) => {
  const { temporary, consumer } = setup(context)
  const contents = "export const own = true\n"
  put(temporary, "canonical.ts", contents)
  put(consumer, "copy.ts", contents)
  assertEditableFiles(consumer, { "copy.ts": hash(contents) })
  assert.throws(() => assertEditableFiles(consumer, { "copy.ts": hash("wrong") }), /unexpected distributed bytes/)
  linkSync(path.join(temporary, "canonical.ts"), path.join(consumer, "hard.ts"))
  assert.throws(() => assertEditableFiles(consumer, { "hard.ts": hash(contents) }), /shares an inode/)
  symlinkSync(path.join(temporary, "canonical.ts"), path.join(consumer, "linked.ts"))
  assert.throws(() => assertEditableFiles(consumer, { "linked.ts": hash(contents) }), /escapes consumer/)
  assert.throws(() => consumerPath(consumer, "../canonical.ts"), /escapes consumer/)
  assert.throws(() => consumerPath(consumer, path.join(temporary, "canonical.ts")), /relative/)
})

test("dependencies deduplicate real installed identities across caller and selected native contexts", (context) => {
  const { consumer } = setup(context)
  manifest(consumer, "package.json", { dependencies: { react: "19.2.3" } })
  packageAt(consumer, "node_modules/react", "react", "19.2.3")
  mkdirSync(path.join(consumer, "modules/codon-selected"), { recursive: true })
  assert.equal(
    assertDependencies(consumer, { react: "19.2.3" }, [".", "modules/codon-selected"]).react.version,
    "19.2.3",
  )
  packageAt(consumer, "modules/codon-selected/node_modules/react", "react", "19.2.3")
  assert.throws(
    () => assertDependencies(consumer, { react: "19.2.3" }, [".", "modules/codon-selected"]),
    /multiple installed identities/,
  )
})

test("dependencies reject version drift, duplicate declarations and workspace resolution leakage", (context) => {
  const { temporary, consumer } = setup(context)
  manifest(consumer, "package.json", { dependencies: { react: "19.2.3" } })
  packageAt(consumer, "node_modules/react", "react", "19.2.7")
  assert.throws(() => assertDependencies(consumer, { react: "19.2.3" }), /version mismatch/)
  manifest(consumer, "package.json", { dependencies: { react: "19.2.3" }, devDependencies: { react: "19.2.3" } })
  assert.throws(() => assertDependencies(consumer, { react: "19.2.3" }), /one exact consumer declaration/)
  manifest(consumer, "package.json", { dependencies: { react: "19.2.3" } })
  rmSync(path.join(consumer, "node_modules/react"), { recursive: true })
  packageAt(temporary, "external-react", "react", "19.2.3")
  symlinkSync(path.join(temporary, "external-react"), path.join(consumer, "node_modules/react"), "dir")
  assert.throws(() => assertDependencies(consumer, { react: "19.2.3" }), /outside the external consumer/)
})

test("dependency inspection handles packages that hide package.json with exports", (context) => {
  const { consumer } = setup(context)
  manifest(consumer, "package.json", { dependencies: { peer: "1.0.0" } })
  packageAt(consumer, "node_modules/peer", "peer", "1.0.0")
  manifest(consumer, "node_modules/peer/package.json", { name: "peer", version: "1.0.0", exports: "./index.js" })
  assert.equal(assertDependencies(consumer, { peer: "1.0.0" }).peer.version, "1.0.0")
})

test("native package checks require selected codegen identity and both platform sources", (context) => {
  const { consumer } = setup(context)
  const expected = fakeNativePackage(consumer)
  assertNativePackage(consumer, expected.path, expected)
  assert.throws(
    () => assertNativePackage(consumer, expected.path, { ...expected, codegenName: "OtherSpec" }),
    /OtherSpec/,
  )
  rmSync(path.join(consumer, expected.path, "ios/Selected.mm"))
  assert.throws(() => assertNativePackage(consumer, expected.path, expected), /missing iOS source/)
})

test("codegen schema checks distinguish exact selected modules, missing and extra modules and invalid types", () => {
  const schema = {
    modules: { SelectedNativeComponent: { type: "Component" }, NativeSelected: { type: "NativeModule" } },
  }
  assertCodegenSchema(schema, ["NativeSelected", "SelectedNativeComponent"])
  assert.throws(() => assertCodegenSchema(schema, ["NativeSelected"]), /selection/)
  assert.throws(
    () => assertCodegenSchema(schema, ["NativeSelected", "SelectedNativeComponent", "Missing"]),
    /selection/,
  )
  assert.throws(
    () => assertCodegenSchema({ modules: { Invalid: { type: "unknown" } } }, ["Invalid"]),
    /invalid codegen/,
  )
})

test("autolink checks bind the consumer, selected package version, paths and exact descriptors on each OS", (context) => {
  const { temporary, consumer } = setup(context)
  const native = fakeNativePackage(consumer)
  const packageRoot = path.join(consumer, native.path)
  const config = {
    root: consumer,
    dependencies: {
      [native.name]: {
        root: packageRoot,
        platforms: {
          android: {
            sourceDir: path.join(packageRoot, "android"),
            libraryName: "SelectedSpec",
            componentDescriptors: ["SelectedDescriptor"],
          },
          ios: { podspecPath: path.join(packageRoot, "Selected.podspec") },
        },
      },
    },
  }
  const android = {
    platform: "android",
    absent: ["@fixture/unselected"],
    packages: [
      {
        name: native.name,
        path: native.path,
        version: native.version,
        paths: { sourceDir: `${native.path}/android` },
        values: { libraryName: "SelectedSpec", componentDescriptors: ["SelectedDescriptor"] },
      },
    ],
  }
  assertAutolink(consumer, config, android)
  assertAutolink(consumer, config, {
    platform: "ios",
    packages: [
      {
        name: native.name,
        path: native.path,
        version: native.version,
        paths: { podspecPath: `${native.path}/Selected.podspec` },
      },
    ],
  })
  assert.throws(() => assertAutolink(consumer, { ...config, root: temporary }, android), /wrong consumer/)
  const wrong = structuredClone(config)
  wrong.dependencies[native.name].platforms.android.componentDescriptors = ["WrongDescriptor"]
  assert.throws(() => assertAutolink(consumer, wrong, android), /wrong componentDescriptors/)
  wrong.dependencies[native.name].root = temporary
  assert.throws(() => assertAutolink(consumer, wrong, android), /wrong autolink root/)
  config.dependencies["@fixture/unselected"] = { root: packageRoot }
  assert.throws(() => assertAutolink(consumer, config, android), /unselected native dependency/)
})

test("runner validates actual JSON stdout from an autolink command and a generated codegen schema file", (context) => {
  const { temporary, consumer } = setup(context)
  const native = fakeNativePackage(consumer)
  const packageRoot = path.join(consumer, native.path)
  const config = {
    root: consumer,
    dependencies: {
      [native.name]: {
        root: packageRoot,
        platforms: { ios: { podspecPath: path.join(packageRoot, "Selected.podspec") } },
      },
    },
  }
  const plan = {
    steps: [
      {
        id: "autolink",
        argv: nodeCommand(`console.log(${JSON.stringify(JSON.stringify(config))})`),
        expect: {
          unchanged: true,
          autolink: {
            platform: "ios",
            packages: [
              {
                name: native.name,
                path: native.path,
                version: native.version,
                paths: { podspecPath: `${native.path}/Selected.podspec` },
              },
            ],
          },
        },
      },
      {
        id: "codegen",
        argv: nodeCommand(
          `fs.mkdirSync('build'); fs.writeFileSync('build/schema.json', ${JSON.stringify(JSON.stringify({ modules: { Selected: { type: "Component" } } }))})`,
        ),
        expect: {
          codegen: { path: "build/schema.json", modules: ["Selected"] },
        },
      },
    ],
  }
  assert.equal(
    runLifecycle({ root: consumer, repository, plan, evidence: path.join(temporary, "evidence") }).verdict,
    "PASS",
  )
})

test("native input fingerprint invalidates changed, added and deleted native inputs and JS/native version drift", (context) => {
  const { consumer } = setup(context)
  const expected = fakeNativePackage(consumer)
  put(consumer, "package.json", '{"version":"0.0.1"}\n')
  put(consumer, "codon-ui.lock.json", "{}\n")
  const roots = [expected.path, "package.json", "codon-ui.lock.json"]
  const captured = captureNativeInputs(consumer, roots)
  assertNativeInputs(consumer, captured)
  put(consumer, `${expected.path}/ios/New.mm`, "// new native source\n")
  assert.throws(() => assertNativeInputs(consumer, captured), /rebuild/)
  rmSync(path.join(consumer, expected.path, "ios/New.mm"))
  put(consumer, "package.json", '{"version":"0.0.2"}\n')
  assert.throws(() => assertNativeInputs(consumer, captured), /rebuild/)
  put(consumer, "package.json", '{"version":"0.0.1"}\n')
  rmSync(path.join(consumer, expected.path, "src/specs/SelectedNativeComponent.ts"))
  assert.throws(() => assertNativeInputs(consumer, captured), /rebuild/)
})

test("lifecycle runs synthetic add, repeat, shared add, clean update and local-edit preservation with evidence", (context) => {
  const { temporary, consumer } = setup(context)
  const evidence = path.join(temporary, "evidence")
  const first = "export const first = 1\n"
  const updated = "export const first = 2\n"
  const shared = "export const shared = true\n"
  const plan = {
    steps: [
      {
        id: "add",
        argv: nodeCommand(
          `fs.mkdirSync('src'); fs.writeFileSync('src/First.ts', ${JSON.stringify(first)}); fs.writeFileSync('src/shared.ts', ${JSON.stringify(shared)})`,
        ),
        expect: {
          files: { "src/First.ts": hash(first), "src/shared.ts": hash(shared) },
          absent: ["src/Web", "modules/unselected"],
        },
      },
      { id: "repeat-add", argv: nodeCommand(""), expect: { unchanged: true } },
      {
        id: "add-shared",
        argv: nodeCommand("fs.writeFileSync('src/Second.ts', 'export const second = true\\n')"),
        expect: { preserved: ["src/First.ts", "src/shared.ts"] },
      },
      { id: "update-preview", argv: nodeCommand("console.log('preview')"), expect: { unchanged: true } },
      {
        id: "update-clean",
        argv: nodeCommand(`fs.writeFileSync('src/First.ts', ${JSON.stringify(updated)})`),
        expect: { files: { "src/First.ts": hash(updated) }, preserved: ["src/Second.ts", "src/shared.ts"] },
      },
      {
        id: "update-edited",
        localEdit: { path: "src/First.ts", append: "// consumer-owned edit\n" },
        argv: nodeCommand("process.exitCode = 1"),
        expectExitCodes: [1],
        expect: { unchanged: true },
      },
    ],
  }
  const report = runLifecycle({ root: consumer, repository, plan, evidence })
  assert.equal(report.verdict, "PASS")
  assert.equal(report.nativeBuildVerified, false)
  assert.equal(report.steps.length, 6)
  assert.equal(readJson(path.join(evidence, "report.json")).verdict, "PASS")
  assert.match(readFileSync(path.join(consumer, "src/First.ts"), "utf8"), /consumer-owned edit/)
})

test("lifecycle fails and retains before/after inventories when an update overwrites the local edit", (context) => {
  const { temporary, consumer } = setup(context)
  const evidence = path.join(temporary, "evidence")
  put(consumer, "Input.tsx", "export const draft = 0\n")
  const plan = {
    steps: [
      {
        id: "bad-update",
        localEdit: { path: "Input.tsx", append: "// local edit\n" },
        argv: nodeCommand("fs.writeFileSync('Input.tsx', 'overwritten')"),
        expect: { preserved: ["Input.tsx"] },
      },
    ],
  }
  assert.throws(() => runLifecycle({ root: consumer, repository, plan, evidence }), /consumer edit changed/)
  assert.equal(readJson(path.join(evidence, "report.json")).verdict, "FAIL")
  assert.notDeepEqual(
    readJson(path.join(evidence, "01-bad-update.before.json")),
    readJson(path.join(evidence, "01-bad-update.after.json")),
  )
})

test("lifecycle entry point propagates failed CLI exit and saves the failure report", (context) => {
  const { temporary, consumer } = setup(context)
  const planPath = path.join(temporary, "plan.json")
  const evidence = path.join(temporary, "evidence")
  writeJson(planPath, {
    steps: [{ id: "failed-add", argv: nodeCommand("process.exitCode = 7"), expect: { unchanged: true } }],
  })
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [path.join(fixture, "run-lifecycle.mjs"), consumer, repository, planPath, evidence],
        { stdio: "pipe" },
      ),
    (error) => error.status !== 0,
  )
  const report = readJson(path.join(evidence, "report.json"))
  assert.equal(report.verdict, "FAIL")
  assert.equal(report.steps[0].exitCode, 7)
})

test("lifecycle rejects evidence under the consumer and checks real command deadlines", (context) => {
  const { temporary, consumer } = setup(context)
  const plan = {
    steps: [
      { id: "timeout", argv: nodeCommand("setInterval(() => {}, 1000)"), timeoutMs: 30, expect: { unchanged: true } },
    ],
  }
  assert.throws(
    () => runLifecycle({ root: consumer, repository, plan, evidence: path.join(consumer, "evidence") }),
    /outside/,
  )
  rmSync(path.join(consumer, "evidence"), { recursive: true })
  const evidence = path.join(temporary, "evidence")
  assert.throws(() => runLifecycle({ root: consumer, repository, plan, evidence }), /ETIMEDOUT/)
  assert.equal(readJson(path.join(evidence, "report.json")).verdict, "FAIL")
})

test("lifecycle rejects even an empty unselected native directory", (context) => {
  const { temporary, consumer } = setup(context)
  const plan = {
    steps: [
      {
        id: "unexpected-native",
        argv: nodeCommand("fs.mkdirSync('unselected-native')"),
        expect: { absent: ["unselected-native"] },
      },
    ],
  }
  assert.throws(
    () => runLifecycle({ root: consumer, repository, plan, evidence: path.join(temporary, "evidence") }),
    /unexpected output/,
  )
})

test("lifecycle refuses to overwrite an earlier evidence directory", (context) => {
  const { temporary, consumer } = setup(context)
  const evidence = path.join(temporary, "evidence")
  put(evidence, "report.json", '{"verdict":"FAIL"}\n')
  const plan = { steps: [{ id: "noop", argv: nodeCommand(""), expect: { unchanged: true } }] }
  assert.throws(() => runLifecycle({ root: consumer, repository, plan, evidence }), /fresh evidence directory/)
  assert.equal(readJson(path.join(evidence, "report.json")).verdict, "FAIL")
})

test("lifecycle captures native inputs and rejects a later spec change through the actual runner", (context) => {
  const { temporary, consumer } = setup(context)
  const native = fakeNativePackage(consumer)
  const evidence = path.join(temporary, "evidence")
  const plan = {
    steps: [
      {
        id: "capture",
        argv: nodeCommand(""),
        captureNative: [native.path],
        expect: { unchanged: true, nativePackages: [native] },
      },
      { id: "same", argv: nodeCommand(""), expect: { unchanged: true, sameNativeAs: "capture" } },
      {
        id: "stale",
        argv: nodeCommand(`fs.appendFileSync('${native.path}/src/specs/SelectedNativeComponent.ts', '// spec v2')`),
        expect: { sameNativeAs: "capture" },
      },
    ],
  }
  assert.throws(() => runLifecycle({ root: consumer, repository, plan, evidence }), /rebuild/)
  const report = readJson(path.join(evidence, "report.json"))
  assert.deepEqual(
    report.steps.map((step) => step.verdict),
    ["PASS", "PASS", "FAIL"],
  )
  const captured = readJson(path.join(evidence, "01-capture.native-inputs.json"))
  assert.equal(captured.kind, "native-input-fingerprint")
  const capturedPath = path.join(evidence, "01-capture.native-inputs.json")
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [path.join(fixture, "consumer-probe.mjs"), "native-check", consumer, capturedPath],
        { stdio: "pipe" },
      ),
    (error) => error.status !== 0,
  )
})
