import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { buildNativeSourceGraph } from "./graph"
import { inspectNativeAdapter } from "./nativeAdapter"
import { createSourceReader, hashSource, readSourceImports, type TSourceReader } from "./sourceFiles"

const nativeRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const realReader = await createSourceReader(nativeRoot)
const manifest = JSON.parse((await realReader.read("package.json")).toString("utf8"))
const baseline = await inspectNativeAdapter(realReader, manifest.name, manifest.codegenConfig)
const nativeContents = new Map(
  await Promise.all(baseline.files.map(async (sourcePath) => [sourcePath, await realReader.read(sourcePath)] as const)),
)

const alteredReader = (changes: Record<string, string | null>): TSourceReader => {
  const contents = new Map(nativeContents)
  for (const [sourcePath, content] of Object.entries(changes)) {
    if (content === null) contents.delete(sourcePath)
    else contents.set(sourcePath, Buffer.from(content))
  }
  return {
    read: async (sourcePath) => {
      const content = contents.get(sourcePath)
      if (!content) throw new Error(`Missing source ${sourcePath}`)
      return content
    },
    list: async (directory) =>
      [...contents.keys()].filter((sourcePath) => sourcePath.startsWith(`${directory}/`)).sort(),
    isFile: async (sourcePath) => contents.has(sourcePath),
    references: async () => [],
  }
}
const text = (sourcePath: string) => nativeContents.get(sourcePath)!.toString("utf8")
const inspectChanges = (
  changes: Record<string, string | null>,
  config: unknown = manifest.codegenConfig,
  name: string = manifest.name,
) => inspectNativeAdapter(alteredReader(changes), name, config)

const withFixture = async (files: Record<string, string>, check: (root: string) => Promise<void>) => {
  const root = await mkdtemp(path.join(tmpdir(), "codon-native-graph-"))
  try {
    const sources = {
      "package.json": JSON.stringify({ name: manifest.name, peerDependencies: { react: "19.2.3" } }),
      ...files,
    }
    for (const [sourcePath, content] of Object.entries(sources)) {
      await mkdir(path.dirname(path.join(root, sourcePath)), { recursive: true })
      await writeFile(path.join(root, sourcePath), content)
    }
    await check(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test("maintained native registrations, complete source lists and prefab identity agree", () => {
  assert.deepEqual(baseline.findings, [])
  assert.equal(baseline.bindings.filter((item) => item.kind === "component").length, 7)
  assert.equal(baseline.bindings.filter((item) => item.kind === "module").length, 3)
  assert.equal(baseline.prefabPackage, "codon-ui_react-native")
  assert.equal(
    baseline.bindings.find((item) => item.name === "CUIFieldBinding")?.iosSourcePath,
    "ios/CUIFormMetadata.mm",
  )
  assert.equal(
    baseline.bindings.find((item) => item.name === "CUIFocusView")?.androidDescriptor,
    "CUIOwnedFocusViewComponentDescriptor",
  )
  for (const required of [
    "android/src/main/consumer-rules.pro",
    "cpp/input/PositionDescriptor.h",
    "cpp/motion/UPSTREAM.json",
    "ios/CUIDragDataStore.swift",
    "android/src/main/AndroidManifest.xml",
  ])
    assert.ok(baseline.files.includes(required), required)
  assert.equal(baseline.cmakeSources.length, 19)
  assert.ok(
    baseline.dependencies.some(
      (item) =>
        item.from === "ios/CUIFocusView.mm" && item.to === "ios/CUIInputWindow.h" && item.kind === "native-include",
    ),
  )
  assert.ok(
    baseline.dependencies.some(
      (item) =>
        item.from.endsWith("CUIFocusView.java") &&
        item.to.endsWith("CUIInputWindow.java") &&
        item.kind === "native-java",
    ),
  )
})

test("AST imports include type edges, reexports, dynamic imports and require without matching comments", () => {
  const result = readSourceImports(`
    // import "./fake"
    import { type A } from "./types"
    export type { A } from "./types"
    export * from "./shared"
    type B = import("./type-query").B
    import("./lazy")
    require("./asset.json")
    import(variable)
  `)
  assert.deepEqual(result.imports, [
    { specifier: "./types", typeOnly: true },
    { specifier: "./types", typeOnly: true },
    { specifier: "./shared", typeOnly: false },
    { specifier: "./type-query", typeOnly: true },
    { specifier: "./lazy", typeOnly: false },
    { specifier: "./asset.json", typeOnly: false },
  ])
  assert.deepEqual(result.unsupported, ["Nonliteral import"])
})

test("cyclic source closures are deduplicated, stable and retain owners, hashes and upstream notices", async () => {
  await withFixture(
    {
      "src/a.ts": 'export * from "./shared"; import type { B } from "./types"',
      "src/b.ts": 'export * from "./shared"',
      "src/shared.ts": 'import "./a"; import React from "react"; export const x = 1',
      "src/types.ts": "export type B = string",
      "src/LICENSE.example.md": "license bytes",
    },
    async (root) => {
      const graph = await buildNativeSourceGraph({
        sourceRoot: root,
        entrypoints: { a: ["src/a.ts"], b: ["src/b.ts"] },
      })
      assert.deepEqual(graph.findings, [])
      assert.equal(graph.nativeAdapter, undefined)
      assert.equal(graph.files.length, 6)
      const shared = graph.files.find((item) => item.sourcePath === "src/shared.ts")!
      assert.deepEqual(shared.owners, ["a", "b"])
      assert.equal(shared.contentHash, hashSource(await readFile(path.join(root, shared.sourcePath))))
      assert.deepEqual(graph.externalDependencies[0], {
        packageName: "react",
        specifier: "react",
        requiredRange: "19.2.3",
        kind: "peer",
        importedBy: ["src/shared.ts"],
      })
      assert.deepEqual(
        graph,
        await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { b: ["src/b.ts"], a: ["src/a.ts"] } }),
      )
      await writeFile(path.join(root, "src/shared.ts"), 'import "./a"; export const x = 2')
      const changed = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { a: ["src/a.ts"] } })
      assert.notEqual(
        changed.files.find((item) => item.sourcePath === shared.sourcePath)?.contentHash,
        shared.contentHash,
      )
    },
  )
})

test("type-only native references retain declarations without activating the native adapter", async () => {
  await withFixture(
    {
      "src/a.ts": 'import type { Spec } from "./input/specs/NativeTest"; export type A = Spec',
      "src/input/specs/NativeTest.ts": "export interface Spec { test(): void }",
    },
    async (root) => {
      const graph = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { a: ["src/a.ts"] } })
      assert.equal(graph.valid, true)
      assert.equal(graph.nativeAdapter, undefined)
      assert.ok(graph.files.some((item) => item.sourcePath.endsWith("NativeTest.ts")))
    },
  )
})

test("source escapes, symlink directories, unknown dependencies and unresolved imports block validation", async () => {
  await withFixture(
    {
      "src/a.ts": 'import "./missing"; import "../../outside"; import "unknown/subpath"; import "./linked/file"',
      "outside/file.ts": "export const secret = true",
    },
    async (root) => {
      await symlink(path.join(root, "outside"), path.join(root, "src/linked"))
      const graph = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { a: ["src/a.ts"] } })
      assert.equal(graph.valid, false)
      assert.ok(graph.findings.some((item) => item.message.includes("escapes package")))
      assert.ok(graph.findings.some((item) => item.message.includes("Symlink source")))
      assert.ok(graph.findings.some((item) => item.code === "undeclared-dependency"))
      assert.ok(graph.findings.some((item) => item.message.includes("Unresolved relative import")))
      assert.ok(!graph.files.some((item) => item.sourcePath.includes("outside")))
    },
  )
})

test("platform variants and imports of test source require an explicit integration policy", async () => {
  await withFixture(
    {
      "src/a.ts": 'import "./shared"; import "./thing.test"',
      "src/shared.ts": "export {}",
      "src/shared.android.ts": "export {}",
      "src/thing.test.ts": "export {}",
    },
    async (root) => {
      const graph = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { a: ["src/a.ts"] } })
      assert.equal(graph.valid, false)
      assert.ok(graph.findings.some((item) => item.message.includes("Platform-specific resolution")))
      assert.ok(graph.findings.some((item) => item.code === "test-source-import"))
    },
  )
})

test("component selections share one complete native adapter and keep unrelated components out", async () => {
  const graph = await buildNativeSourceGraph({
    sourceRoot: nativeRoot,
    entrypoints: {
      button: ["src/components/Button/Button.tsx"],
      time: ["src/components/TimePicker/TimePicker.tsx"],
    },
  })
  assert.deepEqual(graph.findings, [])
  assert.deepEqual(graph.nativeAdapter?.owners, ["button", "time"])
  assert.deepEqual(graph.nativeAdapter?.files, baseline.files)
  assert.equal(new Set(graph.files.map((item) => item.sourcePath)).size, graph.files.length)
  assert.ok(graph.files.some((item) => item.sourcePath === "src/input/specs/NativeCUIDragAndDrop.ts"))
  assert.ok(!graph.files.some((item) => item.sourcePath === "src/components/Avatar/Avatar.tsx"))
  assert.ok(!graph.files.some((item) => item.sourcePath === "src/index.ts"))
  assert.deepEqual(graph.files.find((item) => item.sourcePath === "ios/CUIFormMetadata.mm")?.owners, ["button", "time"])
})

test("missing iOS providers and shared implementation classes are detected", async () => {
  const config = structuredClone(manifest.codegenConfig)
  delete config.ios.componentProvider.CUIFieldBinding
  const missingProvider = await inspectChanges({}, config)
  assert.ok(missingProvider.findings.some((item) => item.message.includes("Missing iOS provider for CUIFieldBinding")))
  const sourcePath = "ios/CUIFormMetadata.mm"
  const missingClass = await inspectChanges({
    [sourcePath]: text(sourcePath).replace("@implementation CUIFieldBinding", "@implementation RemovedBinding"),
  })
  assert.ok(missingClass.findings.some((item) => item.message.includes("one iOS implementation of CUIFieldBinding")))
})

test("Android package factories, module metadata and custom descriptors are all required", async () => {
  const sourcePath = "android/src/main/java/com/codonui/input/CodonInputPackage.java"
  const changed = await inspectChanges({
    [sourcePath]: text(sourcePath)
      .replace("new CUIDateSegmentManager()", "null")
      .replace("modules.put(CUIMotionSnapshotModule.NAME,", "modules.put(Removed.NAME,"),
  })
  assert.ok(changed.findings.some((item) => item.message.includes("new CUIDateSegmentManager(")))
  assert.ok(changed.findings.some((item) => item.message.includes("modules.put(CUIMotionSnapshotModule.NAME,")))
  const descriptors = await inspectChanges({
    "react-native.config.js": text("react-native.config.js").replace(
      "CUIOwnedFocusViewComponentDescriptor",
      "CUIFocusViewComponentDescriptor",
    ),
  })
  assert.ok(descriptors.findings.some((item) => item.message.includes("Android descriptors")))
})

test("missing or unlisted CMake translation units and owned headers are detected", async () => {
  const cmakePath = "android/src/main/jni/CMakeLists.txt"
  const omitted = await inspectChanges({ [cmakePath]: text(cmakePath).replace("  MotionDrawingJNI.cpp\n", "") })
  assert.ok(
    omitted.findings.some((item) =>
      item.message.includes("absent from codon_motion: android/src/main/jni/MotionDrawingJNI.cpp"),
    ),
  )
  const missing = await inspectChanges({ "cpp/motion/ViewportQuery.cpp": null, "ios/CUIInputWindow.h": null })
  assert.ok(
    missing.findings.some((item) => item.message.includes("Missing CMake source: cpp/motion/ViewportQuery.cpp")),
  )
  assert.ok(missing.findings.some((item) => item.message.includes("Unresolved owned include: CUIInputWindow.h")))
  const added = await inspectChanges({ "cpp/motion/NewNative.cpp": "void newNative() {}" })
  assert.ok(added.findings.some((item) => item.message.includes("absent from codon_motion: cpp/motion/NewNative.cpp")))
})

test("missing Java helpers, manifest and consumer keep rules are detected", async () => {
  const changed = await inspectChanges({
    "android/src/main/java/com/codonui/input/CUIInputWindow.java": null,
    "android/src/main/AndroidManifest.xml": null,
    "android/src/main/consumer-rules.pro": null,
  })
  assert.ok(changed.findings.some((item) => item.message.includes("Unresolved owned Java type: CUIInputWindow")))
  assert.ok(changed.findings.some((item) => item.sourcePath === "android/src/main/AndroidManifest.xml"))
  assert.ok(changed.findings.some((item) => item.sourcePath === "android/src/main/consumer-rules.pro"))
})

test("package renaming, missing generated source globs and Gradle wiring cannot silently validate", async () => {
  const renamed = await inspectChanges({}, manifest.codegenConfig, "@consumer/custom-native")
  assert.ok(renamed.findings.some((item) => item.message.includes("find_package(consumer_custom-native")))
  const cmakePath = "android/src/main/jni/overlay/CMakeLists.txt"
  const changed = await inspectChanges({
    [cmakePath]: text(cmakePath).replace("${CUI_OVERLAY_GENERATED_DIR}/*.cpp", "removed/*.cpp"),
    "android/build.gradle": text("android/build.gradle").replace("generateCodegenArtifactsFromSchema", "removedTask"),
  })
  assert.ok(changed.findings.some((item) => item.message.includes("${CUI_OVERLAY_GENERATED_DIR}/*.cpp")))
  assert.ok(changed.findings.some((item) => item.message.includes("generateCodegenArtifactsFromSchema")))
})

test("dynamic config is rejected as data without executing its side effects", async () => {
  const changed = await inspectChanges({
    "react-native.config.js": 'throw new Error("must never execute"); export default (() => process.exit(42))()',
  })
  assert.ok(
    changed.findings.some(
      (item) => item.sourcePath === "react-native.config.js" && item.message.includes("Dynamic native config"),
    ),
  )
})

test("comments cannot satisfy a removed native build source or Java factory", async () => {
  const cmakePath = "android/src/main/jni/CMakeLists.txt"
  const javaPath = "android/src/main/java/com/codonui/input/CodonInputPackage.java"
  const changed = await inspectChanges({
    [cmakePath]: text(cmakePath).replace("  MotionDrawingJNI.cpp\n", "# MotionDrawingJNI.cpp\n"),
    [javaPath]: text(javaPath).replace("new CUIDateSegmentManager()", "null /* new CUIDateSegmentManager() */"),
  })
  assert.ok(changed.findings.some((item) => item.message.includes("absent from codon_motion")))
  assert.ok(changed.findings.some((item) => item.message.includes("new CUIDateSegmentManager(")))
})

test("complete maintained public entrypoint has no unowned source or dependency gaps", async () => {
  const graph = await buildNativeSourceGraph({ sourceRoot: nativeRoot, entrypoints: { public: ["src/index.ts"] } })
  assert.deepEqual(graph.findings, [])
  assert.equal(graph.valid, true)
  assert.equal(graph.nativeAdapter?.bindings.length, 10)
  assert.ok(graph.files.some((item) => item.sourcePath === "src/components/Avatar/Avatar.tsx"))
  assert.ok(graph.files.some((item) => item.sourcePath === "src/motion/kernel/LICENSE.motion-dom.md"))
  assert.ok(graph.externalDependencies.some((item) => item.specifier.startsWith("react-native/Libraries/")))
  assert.ok(!graph.files.some((item) => item.sourcePath.includes("/__tests__/")))
})

test("relative declaration directives travel with source and retain containment checks", async () => {
  await withFixture(
    {
      "src/entry.ts": '/// <reference path="./ambient.d.ts" />\nexport const value = 1\n',
      "src/ambient.d.ts": 'declare module "private-sdk-bridge" { export const value: number }\n',
    },
    async (root) => {
      const graph = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { example: ["src/entry.ts"] } })
      assert.equal(graph.valid, true, JSON.stringify(graph.findings))
      assert.ok(graph.files.some((file) => file.sourcePath === "src/ambient.d.ts"))
      assert.ok(graph.edges.some((edge) => edge.to === "src/ambient.d.ts" && edge.kind === "type"))
    },
  )
  await withFixture({ "src/entry.ts": '/// <reference path="../../outside.d.ts" />\nexport {}\n' }, async (root) => {
    const graph = await buildNativeSourceGraph({ sourceRoot: root, entrypoints: { example: ["src/entry.ts"] } })
    assert.equal(graph.valid, false)
    assert.ok(graph.findings.some((finding) => finding.code === "unresolved-source"))
  })
})
