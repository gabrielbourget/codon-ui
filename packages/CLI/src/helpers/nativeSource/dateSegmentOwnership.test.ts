import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  DATE_SEGMENT_CANDIDATE_FILES,
  DATE_SEGMENT_SPEC,
  inspectDateSegmentOwnership,
  validateDateSegmentOmission,
} from "./dateSegmentOwnership"
import { buildNativeSourceGraph } from "./graph"
import { inspectNativeAdapter } from "./nativeAdapter"
import { createSourceReader, type TSourceReader } from "./sourceFiles"

const nativeRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const reader = await createSourceReader(nativeRoot)
const manifest = JSON.parse((await reader.read("package.json")).toString("utf8"))
const adapter = await inspectNativeAdapter(reader, manifest.name, manifest.codegenConfig)
const controls = { button: ["src/components/Button/Button.tsx"], input: ["src/components/Input/Input.tsx"] }
const [graph, controlGraph] = await Promise.all([
  buildNativeSourceGraph({
    sourceRoot: nativeRoot,
    entrypoints: {
      ...controls,
      time: ["src/components/TimePicker/TimePicker.tsx"],
      datetime: ["src/components/DateTimePicker/DateTimePicker.tsx"],
      range: ["src/components/DateTimeRangePicker/DateTimeRangePicker.tsx"],
    },
  }),
  buildNativeSourceGraph({ sourceRoot: nativeRoot, entrypoints: controls }),
])
const ownership = await inspectDateSegmentOwnership(reader, adapter, graph)

test("three temporal pickers share one runtime date spec; ordinary controls only inherit its wire types/build inputs", () => {
  assert.deepEqual(graph.findings, [])
  assert.deepEqual(controlGraph.findings, [])
  assert.deepEqual(ownership.runtimeOwners, ["datetime", "range", "time"])
  assert.ok(!controlGraph.nativeRuntimeOwners.some((item) => item.sourcePath === DATE_SEGMENT_SPEC))
  assert.ok(controlGraph.files.some((item) => item.sourcePath === DATE_SEGMENT_SPEC))
  assert.ok(ownership.typeOnlyImporters.includes("src/input/ordinaryEditorKeys.ts"))
  assert.equal(ownership.registrations.length, 4)
  assert.equal(new Set(ownership.registrations.map((item) => `${item.scope}:${item.identity}`)).size, 4)
  assert.equal(graph.nativeAdapter?.bindings.filter((item) => item.name === "CUIDateSegment").length, 1)
})

test("date ownership exposes concrete shared keyboard, focus, form and accessibility dependencies", () => {
  assert.deepEqual(ownership.findings, [])
  assert.equal(ownership.candidateFiles.length, 12)
  assert.equal(ownership.status, "shared-required")
  assert.equal(ownership.projectionAvailable, false)
  assert.equal(ownership.selectiveInstallValidated, false)
  for (const caller of [
    "ios/CUIKeyboardScope.mm",
    "ios/CUIOrdinaryEditorKeys.mm",
    "ios/CUIFieldSemantics.h",
    "ios/CUIFormFieldFocus.mm",
    "ios/CUIFieldGroupDocument.mm",
    "android/src/main/java/com/codonui/input/CUIKeyboardScope.java",
    "android/src/main/java/com/codonui/input/CUIFormMetadataView.java",
    "android/src/main/java/com/codonui/input/CUIFocusWithinObserver.java",
    "android/src/main/java/com/codonui/input/CUIFieldSemantics.java",
  ])
    assert.ok(
      ownership.sharedReferences.some((edge) => edge.from === caller),
      caller,
    )
  assert.deepEqual(ownership.prefabHeaders, ["cpp/input/DateSegmentKeyPolicy.h"])
})

test("date omission rejects retained native refs, runtime consumers, shared declarations and the prefab ABI", async () => {
  assert.deepEqual(validateDateSegmentOmission(ownership, []), [])
  const rejected = validateDateSegmentOmission(ownership, DATE_SEGMENT_CANDIDATE_FILES)
  for (const code of ["date-retained-reference", "date-runtime-required", "date-types-required", "date-prefab-abi"])
    assert.ok(
      rejected.some((finding) => finding.code === code),
      code,
    )
  const controlsOnly = await inspectDateSegmentOwnership(reader, adapter, controlGraph)
  assert.deepEqual(controlsOnly.runtimeOwners, [])
  const rejectedControls = validateDateSegmentOmission(controlsOnly, DATE_SEGMENT_CANDIDATE_FILES)
  assert.ok(!rejectedControls.some((finding) => finding.code === "date-runtime-required"))
  assert.ok(rejectedControls.some((finding) => finding.code === "date-retained-reference"))
  assert.ok(rejectedControls.some((finding) => finding.code === "date-types-required"))
})

test("removing a leaf policy alone still requires its retained editor and exported-header contract", () => {
  const rejected = validateDateSegmentOmission(ownership, ["cpp/input/DateSegmentKeyPolicy.h"])
  assert.ok(
    rejected.some(
      (finding) => finding.sourcePath === "ios/CUIDateSegment.mm" && finding.code === "date-retained-reference",
    ),
  )
  assert.ok(rejected.some((finding) => finding.code === "date-prefab-abi"))
})

test("missing component registration or changed prefab exposure invalidates the date ownership profile", async () => {
  const missingBinding = await inspectDateSegmentOwnership(reader, {
    ...adapter,
    bindings: adapter.bindings.filter((binding) => binding.name !== "CUIDateSegment"),
  })
  assert.equal(missingBinding.status, "invalid-source")
  assert.ok(
    missingBinding.findings.some((finding) => finding.message.includes("one native date-segment component binding")),
  )
  const changedReader: TSourceReader = {
    ...reader,
    read: async (sourcePath) =>
      sourcePath === "android/build.gradle"
        ? Buffer.from(
            (await reader.read(sourcePath)).toString("utf8").replace('headers "../cpp/input"', 'headers "../cpp"'),
          )
        : reader.read(sourcePath),
  }
  const changed = await inspectDateSegmentOwnership(changedReader, adapter)
  assert.equal(changed.status, "invalid-source")
  assert.ok(changed.findings.some((finding) => finding.message.includes("prefab header exposure changed")))
})

test("successful real nine-binding codegen cannot make naive date pruning a valid native package", async () => {
  const omitted = new Set<string>(DATE_SEGMENT_CANDIDATE_FILES)
  const contents = new Map(
    await Promise.all(
      adapter.files.filter((file) => !omitted.has(file)).map(async (file) => [file, await reader.read(file)] as const),
    ),
  )
  const projectedManifest = structuredClone(manifest)
  delete projectedManifest.codegenConfig.ios.componentProvider.CUIDateSegment
  contents.set("package.json", Buffer.from(JSON.stringify(projectedManifest)))
  contents.set(
    "react-native.config.js",
    Buffer.from(
      (await reader.read("react-native.config.js"))
        .toString("utf8")
        .replace('"CUIDateSegmentComponentDescriptor",', ""),
    ),
  )
  const packagePath = "android/src/main/java/com/codonui/input/CodonInputPackage.java"
  contents.set(
    packagePath,
    Buffer.from(contents.get(packagePath)!.toString("utf8").replace(", new CUIDateSegmentManager()", "")),
  )
  const prunedReader: TSourceReader = {
    read: async (sourcePath) => {
      const value = contents.get(sourcePath)
      if (!value) throw new Error(`Missing input ${sourcePath}`)
      return value
    },
    list: async (directory) => [...contents.keys()].filter((file) => file.startsWith(`${directory}/`)).sort(),
    isFile: async (sourcePath) => contents.has(sourcePath),
    references: async () => [],
  }
  const pruned = await inspectNativeAdapter(prunedReader, manifest.name, projectedManifest.codegenConfig)
  assert.equal(pruned.bindings.length, 9)
  assert.ok(pruned.findings.some((finding) => finding.message.includes("Unresolved owned Java type: CUIDateSegment")))
  assert.ok(pruned.findings.some((finding) => finding.message.includes("Unresolved owned include: CUIDateSegment.h")))
  const requireNative = createRequire(path.join(nativeRoot, "node_modules/react-native/package.json"))
  const directory = path.join(nativeRoot, "node_modules/react-native/scripts/codegen")
  const utils = requireNative(path.join(directory, "codegen-utils.js")) as {
    getCombineJSToSchema: () => {
      combineSchemasInFileList: (files: string[], platform: string) => { modules: Record<string, unknown> }
    }
  }
  const generator = requireNative(path.join(directory, "generate-specs-cli-executor.js")) as {
    generateSpecFromInMemorySchema: (
      platform: string,
      schema: unknown,
      output: string,
      name: string,
      javaPackage: string,
      type: string,
      localPaths: boolean,
    ) => void
  }
  const output = await mkdtemp(path.join(tmpdir(), "codon-date-pruning-"))
  try {
    const specPaths = (await reader.list(manifest.codegenConfig.jsSrcsDir))
      .filter((file) => file.endsWith(".ts") && file !== DATE_SEGMENT_SPEC)
      .map((file) => path.join(nativeRoot, file))
    for (const platform of ["android", "ios"]) {
      const schema = utils.getCombineJSToSchema().combineSchemasInFileList(specPaths, platform)
      assert.equal(Object.keys(schema.modules).length, 9)
      assert.ok(!schema.modules.CUIDateSegment)
      const destination = path.join(output, platform)
      generator.generateSpecFromInMemorySchema(
        platform,
        schema,
        destination,
        manifest.codegenConfig.name,
        manifest.codegenConfig.android.javaPackageName,
        manifest.codegenConfig.type,
        false,
      )
      const descriptorPath =
        platform === "android"
          ? "jni/react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h"
          : "react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h"
      assert.ok(
        !(await readFile(path.join(destination, descriptorPath), "utf8")).includes("CUIDateSegmentComponentDescriptor"),
      )
    }
    assert.ok(pruned.findings.length > 0)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})
