import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { DATE_SEGMENT_CANDIDATE_FILES } from "./dateSegmentOwnership"
import { inspectNativeAdapter } from "./nativeAdapter"
import { TABLE_COMPOSITION_FILES, TABLE_NATIVE_FILES } from "./ownership"
import {
  captureNativeConsumerSnapshot,
  defineNativeConsumerSnapshot,
  defineNativeSelectionState,
  parseNativeConsumerSnapshot,
  parseNativeSelectionState,
  planNativeSelection,
  validateNativeSelectionPlan,
  type TNativeConsumerSnapshot,
} from "./selectionLifecycle"
import {
  buildNativeSelection,
  defineNativeSelectionManifest,
  inspectNativeRuntimeIdentities,
  parseNativeSelectionManifest,
  serializeNativeSelectionManifest,
  validateNativeSelectionPayloads,
  type TNativeSelectionManifest,
} from "./selectionManifest"
import { createSourceReader, hashSource } from "./sourceFiles"

const sourceRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const full = await buildNativeSelection({
  sourceRoot,
  requests: [
    { component: "table-b", features: ["table"] },
    { component: "input" },
    { component: "table-a", features: ["table"] },
  ],
})
const oneTable = await buildNativeSelection({
  sourceRoot,
  requests: [{ component: "input" }, { component: "table-b", features: ["table"] }],
})
const core = await buildNativeSelection({ sourceRoot, requests: [{ component: "input" }] })
const empty = await buildNativeSelection({ sourceRoot: "/not-read-for-empty-selection", requests: [] })
const consumerRoot = "/tmp/codon-native-selection-model"
const editedHash = hashSource(Buffer.from("consumer edit"))
const selectedFile = "ios/CUINativeFeatures.mm"
const baselineState = defineNativeSelectionState(consumerRoot, full.manifest)
const redefine = (manifest: TNativeSelectionManifest, patch: Partial<TNativeSelectionManifest>) =>
  defineNativeSelectionManifest(
    Object.fromEntries(Object.entries({ ...manifest, ...patch }).filter(([key]) => key !== "manifestId")),
  )

const snapshotOf = (
  manifest: TNativeSelectionManifest,
  overrides: Record<string, string | null> = {},
  extra: TNativeConsumerSnapshot["entries"] = [],
  root = consumerRoot,
) => {
  const files: TNativeConsumerSnapshot["entries"] = manifest.files.flatMap((file) => {
    const contentHash = Object.hasOwn(overrides, file.path) ? overrides[file.path] : file.contentHash
    return contentHash === null ? [] : [{ path: file.path, kind: "file" as const, contentHash }]
  })
  const directories = new Set<string>()
  for (const file of [...files, ...extra]) {
    const parts = file.path.split("/")
    for (let count = 1; count < parts.length; count++) directories.add(parts.slice(0, count).join("/"))
  }
  return defineNativeConsumerSnapshot({
    schemaVersion: 1,
    root,
    rootKind: "directory",
    entries: [
      ...[...directories].map((directory) => ({ path: directory, kind: "directory" as const })),
      ...files,
      ...extra,
    ],
  })
}
const blocked = (plan: ReturnType<typeof planNativeSelection>, code: string, sourcePath?: string) => {
  assert.equal(plan.status, "blocked")
  assert.deepEqual(plan.operations, [])
  assert.equal(plan.nextState, null)
  assert.ok(
    plan.conflicts.some((finding) => finding.code === code && (!sourcePath || finding.path === sourcePath)),
    JSON.stringify(plan.conflicts),
  )
}

test("selection is deterministic across request permutations/repeats and explicitly closes shared/Table ownership", async () => {
  const repeated = await buildNativeSelection({
    sourceRoot,
    requests: [
      { component: "table-a", features: ["table", "table"] },
      { component: "table-b" },
      { component: "input" },
      { component: "table-b", features: ["table"] },
      { component: "table-a" },
    ],
  })
  assert.equal(serializeNativeSelectionManifest(repeated.manifest), serializeNativeSelectionManifest(full.manifest))
  assert.deepEqual(full.manifest.units, [
    { id: "shared", requires: [], owners: ["input", "table-a", "table-b"] },
    { id: "table", requires: ["shared"], owners: ["table-a", "table-b"] },
  ])
  assert.equal(full.manifest.files.length, 209)
  assert.equal(core.manifest.files.length, 196)
  assert.equal(full.manifest.sourceInputHash, core.manifest.sourceInputHash)
  assert.equal(full.manifest.selectiveInstallValidated, false)
  assert.deepEqual(empty.manifest.files, [])
  assert.deepEqual(empty.payloads, [])
  for (const file of DATE_SEGMENT_CANDIDATE_FILES)
    assert.equal(core.manifest.files.find((input) => input.path === file)?.unit, "shared")
  assert.deepEqual(
    full.manifest.files
      .filter((file) => file.unit === "table")
      .map((file) => file.path)
      .sort(),
    [...TABLE_NATIVE_FILES].sort(),
  )
  assert.deepEqual(
    core.manifest.files
      .filter((file) => file.sourceHash !== file.contentHash)
      .map((file) => file.path)
      .sort(),
    [...TABLE_COMPOSITION_FILES].sort(),
  )
})

test("emitted payloads match manifests and materialize valid full/core native source profiles", async () => {
  for (const selection of [full, core]) {
    validateNativeSelectionPayloads(selection.manifest, selection.payloads)
    const directory = await mkdtemp(path.join(tmpdir(), "codon-selection-source-"))
    try {
      for (const payload of selection.payloads) {
        await mkdir(path.dirname(path.join(directory, payload.path)), { recursive: true })
        await writeFile(path.join(directory, payload.path), payload.content)
      }
      const reader = await createSourceReader(directory)
      const packageJson = JSON.parse((await reader.read("package.json")).toString("utf8"))
      const inspected = await inspectNativeAdapter(reader, packageJson.name, packageJson.codegenConfig)
      assert.deepEqual(inspected.findings, [])
      if (selection === full) {
        const relocated = await buildNativeSelection({ sourceRoot: directory, requests: selection.manifest.requests })
        assert.equal(relocated.manifest.manifestId, full.manifest.manifestId)
        const changedFile = "android/src/main/java/com/codonui/input/CUIDateSegmentKeyPolicy.java"
        await writeFile(
          path.join(directory, changedFile),
          Buffer.concat([await reader.read(changedFile), Buffer.from("\n// source revision\n")]),
        )
        const changed = await buildNativeSelection({ sourceRoot: directory, requests: selection.manifest.requests })
        assert.notEqual(changed.manifest.sourceInputHash, full.manifest.sourceInputHash)
        assert.notEqual(changed.manifest.manifestId, full.manifest.manifestId)
        assert.deepEqual(changed.manifest.identities, full.manifest.identities)
        await writeFile(
          path.join(directory, changedFile),
          selection.payloads.find((payload) => payload.path === changedFile)!.content,
        )
      }
      const observed = await captureNativeConsumerSnapshot(directory)
      const current = defineNativeSelectionState(directory, selection.manifest)
      assert.deepEqual(
        planNativeSelection({ desired: selection.manifest, previous: current, snapshot: observed }).operations,
        [],
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
  assert.throws(() => validateNativeSelectionPayloads(core.manifest, core.payloads.slice(1)), /payload set/)
  assert.throws(
    () =>
      validateNativeSelectionPayloads(
        core.manifest,
        core.payloads.map((file, index) => (index ? file : { ...file, content: Buffer.from("altered") })),
      ),
    /payload hash mismatch/,
  )
})

test("manifest rejects ownership/dependency gaps, wrong Table classification, date pruning and content tampering", () => {
  assert.throws(
    () => redefine(full.manifest, { units: full.manifest.units.map((unit) => ({ ...unit, requires: [] })) }),
    /dependency closure/,
  )
  assert.throws(
    () =>
      redefine(full.manifest, {
        files: full.manifest.files.map((file, index) => (index ? file : { ...file, owners: ["missing"] })),
      }),
    /owner mismatch/,
  )
  assert.throws(
    () => redefine(full.manifest, { files: full.manifest.files.filter((file) => file.path !== TABLE_NATIVE_FILES[0]) }),
    /Missing Table input/,
  )
  assert.throws(
    () =>
      redefine(full.manifest, {
        files: full.manifest.files.filter((file) => file.path !== DATE_SEGMENT_CANDIDATE_FILES[0]),
      }),
    /Missing shared date/,
  )
  assert.throws(
    () =>
      redefine(full.manifest, {
        files: full.manifest.files.map((file) =>
          file.unit === "table" ? { ...file, unit: "shared", owners: ["input", "table-a", "table-b"] } : file,
        ),
      }),
    /unit mismatch/,
  )
  assert.throws(
    () => parseNativeSelectionManifest({ ...full.manifest, sourceInputHash: editedHash }),
    /content ID mismatch/,
  )
})

test("portable manifest paths reject escapes, case/file-directory collisions and reserved names", () => {
  const original = core.manifest.files[0]
  for (const filePath of ["../escape", "/absolute", "a/./b", "a//b", "a\\b", "C:/drive", "ios/CON.h", "ios/trailing."])
    assert.throws(() => redefine(core.manifest, { files: [...core.manifest.files, { ...original, path: filePath }] }))
  for (const filePath of [original.path, original.path.toUpperCase(), `${original.path}/nested.h`])
    assert.throws(
      () => redefine(core.manifest, { files: [...core.manifest.files, { ...original, path: filePath }] }),
      /Duplicate|collision/,
    )
  assert.throws(
    () => redefine(core.manifest, { files: [...core.manifest.files, { ...original, path: "IOS/Additional.h" }] }),
    /casing collision/,
  )
})

test("manifest identities include runtime classes and reject duplicate claims even within one owner", () => {
  const identities = full.manifest.identities
  for (const [scope, identity] of [
    ["native-package", "@codon-ui/react-native"],
    ["prefab-package", "codon-ui_react-native"],
    ["android-class", "com.codonui.input.CUITableNativeSession"],
    ["objc-runtime-class", "CUITableStickyPresentation"],
    ["objc-runtime-class", "CUIMotionContinuousCorners"],
  ])
    assert.ok(
      identities.some((claim) => claim.scope === scope && claim.identity === identity),
      `${scope}:${identity}`,
    )
  assert.ok(!core.manifest.identities.some((claim) => claim.identity === "com.codonui.input.CUITableNativeSession"))
  assert.throws(
    () => redefine(full.manifest, { identities: [...identities, identities[0]] }),
    /Duplicate native identity/,
  )
  assert.throws(
    () => redefine(core.manifest, { identities: [{ ...identities[0], sourcePath: "missing.mm" }] }),
    /no owning file/,
  )
})

test("runtime identity inspection includes package-private top-level Java classes and ignores strings/comments/nested classes", () => {
  const identities = inspectNativeRuntimeIdentities([
    {
      path: "android/Example.java",
      content: Buffer.from(
        'package com.example; public class Example { String text = "class Imaginary {}"; class Nested {} } /* class Comment {} */ final class Other {}',
      ),
    },
    {
      path: "ios/Example.mm",
      content: Buffer.from('@implementation Example @end\nNSString *text = @"@implementation Imaginary";'),
    },
    { path: "ios/Example.swift", content: Buffer.from("@objc(SwiftExample) final class Example: NSObject {}") },
  ])
  assert.deepEqual(
    identities.map((claim) => claim.identity),
    ["com.example.Example", "com.example.Other", "Example", "SwiftExample"],
  )
  assert.throws(
    () =>
      inspectNativeRuntimeIdentities([
        { path: "ios/Example.mm", content: Buffer.from("@implementation Example\n (Category) @end") },
      ]),
    /explicit identity profile/,
  )
  assert.throws(
    () =>
      inspectNativeRuntimeIdentities([
        { path: "android/Example.java", content: Buffer.from("package com.example; class WrongFile {}") },
      ]),
    /Unsupported Java/,
  )
})

test("fresh installation plans owned inputs once and matching untracked bytes never grant ownership", () => {
  const missing = defineNativeConsumerSnapshot({
    schemaVersion: 1,
    root: consumerRoot,
    rootKind: "missing",
    entries: [],
  })
  const plan = planNativeSelection({ desired: core.manifest, previous: null, snapshot: missing })
  assert.equal(plan.status, "ready")
  assert.equal(plan.operations.length, 196)
  assert.ok(plan.operations.every((operation) => operation.action === "create" && operation.beforeHash === null))
  assert.deepEqual(plan.effects, { writesFiles: false, writesState: false })
  assert.equal(plan.nextState?.managedPaths.length, 196)
  const existing = snapshotOf(core.manifest)
  blocked(planNativeSelection({ desired: core.manifest, previous: null, snapshot: existing }), "untracked-target")
})

test("removing one Table owner retains all bytes; removing the last deletes thirteen and rewrites five", () => {
  const first = planNativeSelection({
    desired: oneTable.manifest,
    previous: baselineState,
    snapshot: snapshotOf(full.manifest),
  })
  assert.equal(first.status, "ready")
  assert.deepEqual(first.operations, [])
  assert.deepEqual(first.nextState?.manifest.units.find((unit) => unit.id === "table")?.owners, ["table-b"])
  const last = planNativeSelection({
    desired: core.manifest,
    previous: first.nextState,
    snapshot: snapshotOf(full.manifest),
  })
  assert.equal(last.status, "ready")
  assert.deepEqual(
    last.operations
      .filter((operation) => operation.action === "delete")
      .map((operation) => operation.path)
      .sort(),
    [...TABLE_NATIVE_FILES].sort(),
  )
  assert.deepEqual(
    last.operations
      .filter((operation) => operation.action === "replace")
      .map((operation) => operation.path)
      .sort(),
    [...TABLE_COMPOSITION_FILES].sort(),
  )
  for (const file of DATE_SEGMENT_CANDIDATE_FILES)
    assert.ok(!last.operations.some((operation) => operation.path === file))
})

test("adding Table to core creates only feature files and rewrites composition once", () => {
  const plan = planNativeSelection({
    desired: full.manifest,
    previous: defineNativeSelectionState(consumerRoot, core.manifest),
    snapshot: snapshotOf(core.manifest),
  })
  assert.equal(plan.status, "ready")
  assert.equal(plan.operations.filter((operation) => operation.action === "create").length, 13)
  assert.equal(plan.operations.filter((operation) => operation.action === "replace").length, 5)
  assert.equal(plan.operations.length, 18)
})

test("unchanged incoming bytes preserve edits and deletions without adopting either as a new baseline", () => {
  const snapshot = snapshotOf(full.manifest, { [selectedFile]: editedHash, "ios/CUINativeFeatures.h": null })
  const unchanged = planNativeSelection({ desired: oneTable.manifest, previous: baselineState, snapshot })
  assert.equal(unchanged.status, "ready")
  assert.deepEqual(unchanged.operations, [])
  assert.ok(
    unchanged.decisions.some((decision) => decision.path === selectedFile && decision.action === "preserve-edited"),
  )
  assert.ok(
    unchanged.decisions.some(
      (decision) => decision.path === "ios/CUINativeFeatures.h" && decision.action === "preserve-missing",
    ),
  )
  assert.equal(
    unchanged.nextState?.manifest.files.find((file) => file.path === selectedFile)?.contentHash,
    full.manifest.files.find((file) => file.path === selectedFile)?.contentHash,
  )
  blocked(
    planNativeSelection({ desired: core.manifest, previous: unchanged.nextState, snapshot }),
    "edited-input-update",
    selectedFile,
  )
})

test("upstream edits/removal block the entire transition when any affected native input is locally edited/deleted", () => {
  for (const observed of [editedHash, null])
    blocked(
      planNativeSelection({
        desired: core.manifest,
        previous: baselineState,
        snapshot: snapshotOf(full.manifest, { [selectedFile]: observed }),
      }),
      "edited-input-update",
      selectedFile,
    )
  const tableFile = TABLE_NATIVE_FILES[0]
  blocked(
    planNativeSelection({
      desired: core.manifest,
      previous: baselineState,
      snapshot: snapshotOf(full.manifest, { [tableFile]: editedHash }),
    }),
    "edited-input-removal",
    tableFile,
  )
  blocked(
    planNativeSelection({
      desired: empty.manifest,
      previous: baselineState,
      snapshot: snapshotOf(full.manifest, { [selectedFile]: editedHash }),
    }),
    "edited-input-removal",
    selectedFile,
  )
})

test("already-current incoming bytes are retained and missing retired owned inputs are safely released", () => {
  const incomingHash = core.manifest.files.find((file) => file.path === selectedFile)!.contentHash
  const plan = planNativeSelection({
    desired: core.manifest,
    previous: baselineState,
    snapshot: snapshotOf(full.manifest, { [selectedFile]: incomingHash, [TABLE_NATIVE_FILES[0]]: null }),
  })
  assert.equal(plan.status, "ready")
  assert.ok(plan.decisions.some((decision) => decision.path === selectedFile && decision.action === "already-current"))
  assert.ok(
    plan.decisions.some((decision) => decision.path === TABLE_NATIVE_FILES[0] && decision.action === "release-missing"),
  )
  assert.equal(plan.operations.length, 16)
})

test("released ownership is preserved without readoption and blocks changes or orphaned native source", () => {
  const state = defineNativeSelectionState(
    consumerRoot,
    full.manifest,
    baselineState.managedPaths.filter((file) => file !== selectedFile),
  )
  const snapshot = snapshotOf(full.manifest, { [selectedFile]: editedHash })
  const retained = planNativeSelection({ desired: oneTable.manifest, previous: state, snapshot })
  assert.equal(retained.status, "ready")
  assert.ok(!retained.nextState?.managedPaths.includes(selectedFile))
  blocked(
    planNativeSelection({ desired: core.manifest, previous: state, snapshot }),
    "released-input-update",
    selectedFile,
  )
  blocked(
    planNativeSelection({ desired: empty.manifest, previous: state, snapshot }),
    "released-input-retained",
    selectedFile,
  )
  const gone = planNativeSelection({
    desired: empty.manifest,
    previous: state,
    snapshot: snapshotOf(full.manifest, { [selectedFile]: null }),
  })
  assert.equal(gone.status, "ready")
  assert.deepEqual(gone.nextState?.managedPaths, [])
})

test("last native client removes only clean owned files and untracked native sources prevent orphan cleanup", () => {
  const clean = planNativeSelection({
    desired: empty.manifest,
    previous: baselineState,
    snapshot: snapshotOf(full.manifest),
  })
  assert.equal(clean.status, "ready")
  assert.equal(clean.operations.length, 209)
  assert.ok(clean.operations.every((operation) => operation.action === "delete"))
  const nativeExtra = snapshotOf(full.manifest, {}, [
    { path: "ios/Consumer.mm", kind: "file", contentHash: editedHash },
  ])
  blocked(
    planNativeSelection({ desired: empty.manifest, previous: baselineState, snapshot: nativeExtra }),
    "untracked-native-input",
    "ios/Consumer.mm",
  )
  const documentation = snapshotOf(full.manifest, {}, [{ path: "README.md", kind: "file", contentHash: editedHash }])
  const keepDocs = planNativeSelection({ desired: empty.manifest, previous: baselineState, snapshot: documentation })
  assert.equal(keepDocs.status, "ready")
  assert.ok(!keepDocs.operations.some((operation) => operation.path === "README.md"))
})

test("duplicate package/codegen/pod/prefab and runtime-class identities block before any operations", () => {
  for (const scope of [
    "native-package",
    "codegen-library",
    "ios-pod",
    "prefab-package",
    "android-class",
    "objc-runtime-class",
  ] as const) {
    const claim = core.manifest.identities.find((identity) => identity.scope === scope)!
    blocked(
      planNativeSelection({
        desired: core.manifest,
        previous: baselineState,
        snapshot: snapshotOf(full.manifest),
        externalIdentities: [{ scope, identity: claim.identity, owner: "other-native-package" }],
      }),
      "duplicate-identity",
      claim.sourcePath,
    )
  }
})

test("root, symlink, directory and case collisions fail closed", () => {
  blocked(
    planNativeSelection({
      desired: core.manifest,
      previous: baselineState,
      snapshot: snapshotOf(full.manifest, {}, [], "/tmp/other-native-root"),
    }),
    "root-mismatch",
  )
  for (const rootKind of ["symlink", "other"] as const)
    blocked(
      planNativeSelection({
        desired: core.manifest,
        previous: null,
        snapshot: defineNativeConsumerSnapshot({ schemaVersion: 1, root: consumerRoot, rootKind, entries: [] }),
      }),
      "unsafe-root",
    )
  for (const entry of [
    { path: "ios", kind: "symlink" },
    { path: selectedFile, kind: "directory" },
    { path: "IOS", kind: "directory" },
  ] as const) {
    const snapshot = defineNativeConsumerSnapshot({
      schemaVersion: 1,
      root: consumerRoot,
      rootKind: "directory",
      entries: entry.path.includes("/") ? [{ path: "ios", kind: "directory" }, entry] : [entry],
    })
    blocked(planNativeSelection({ desired: core.manifest, previous: null, snapshot }), "unsafe-path")
  }
})

test("plans bind the consumer snapshot, state, selection, external identities and exact plan contents", () => {
  const input = { desired: core.manifest, previous: baselineState, snapshot: snapshotOf(full.manifest) }
  const plan = planNativeSelection(input)
  assert.equal(validateNativeSelectionPlan(plan, input).planId, plan.planId)
  const reversed = defineNativeConsumerSnapshot({
    schemaVersion: 1,
    root: input.snapshot.root,
    rootKind: input.snapshot.rootKind,
    entries: [...input.snapshot.entries].reverse(),
  })
  assert.equal(planNativeSelection({ ...input, snapshot: reversed }).planId, plan.planId)
  const external = [
    { scope: "android-class" as const, identity: "unrelated.First", owner: "one" },
    { scope: "android-class" as const, identity: "unrelated.Second", owner: "two" },
  ]
  assert.equal(
    planNativeSelection({ ...input, externalIdentities: external }).planId,
    planNativeSelection({ ...input, externalIdentities: [...external].reverse() }).planId,
  )
  for (const changed of [
    { ...input, snapshot: snapshotOf(full.manifest, { [selectedFile]: editedHash }) },
    { ...input, snapshot: snapshotOf(full.manifest, { [selectedFile]: null }) },
    { ...input, snapshot: snapshotOf(full.manifest, {}, [], "/tmp/moved-native-root") },
    {
      ...input,
      snapshot: snapshotOf(full.manifest, {}, [{ path: "README.md", kind: "file" as const, contentHash: editedHash }]),
    },
    { ...input, previous: defineNativeSelectionState(consumerRoot, full.manifest, []) },
    { ...input, desired: oneTable.manifest },
    {
      ...input,
      externalIdentities: [{ scope: "android-class" as const, identity: "unrelated.Class", owner: "external" }],
    },
  ])
    assert.throws(() => validateNativeSelectionPlan(plan, changed), /Stale native selection plan/)
  assert.throws(() => validateNativeSelectionPlan({ ...plan, operations: [] }, input), /content ID mismatch/)
  assert.throws(() => parseNativeSelectionState({ ...baselineState, managedPaths: [] }), /content ID mismatch/)
  assert.throws(() => parseNativeConsumerSnapshot({ ...input.snapshot, entries: [] }), /content ID mismatch/)
})

test("snapshot capture is read-only, ignores known generated trees and never traverses observed symlinks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codon-selection-observation-"))
  const outside = await mkdtemp(path.join(tmpdir(), "codon-selection-outside-"))
  try {
    await mkdir(path.join(root, "ios"))
    await writeFile(path.join(root, selectedFile), "local source")
    await mkdir(path.join(root, "android/build"), { recursive: true })
    await writeFile(path.join(root, "android/build/generated.cpp"), "generated")
    await mkdir(path.join(root, "node_modules"))
    await writeFile(path.join(root, "node_modules/unknown.js"), "dependency")
    await writeFile(path.join(outside, "secret.cpp"), "must not traverse")
    await symlink(outside, path.join(root, "external"), "dir")
    const snapshot = await captureNativeConsumerSnapshot(root)
    assert.deepEqual(
      snapshot.entries.filter((entry) => entry.kind !== "directory").map((entry) => entry.path),
      ["external", selectedFile],
    )
    assert.equal(snapshot.entries.find((entry) => entry.path === "external")?.kind, "symlink")
    assert.equal((await readFile(path.join(root, selectedFile))).toString(), "local source")
    assert.equal((await captureNativeConsumerSnapshot(path.join(root, "external/nested"))).rootKind, "symlink")
    assert.equal((await captureNativeConsumerSnapshot(path.join(root, "missing"))).rootKind, "missing")
    assert.equal((await captureNativeConsumerSnapshot(path.join(root, selectedFile))).rootKind, "other")
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})
