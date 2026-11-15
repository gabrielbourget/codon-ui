import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { inspectNativeAdapter } from "./nativeAdapter"
import { validateNativeCompileOwnership } from "./ownership"
import { createSourceReader, hashSource, stripSourceComments, type TSourceReader } from "./sourceFiles"
import { projectNativeTableSources } from "./tableProjection"

const nativeRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const reader = await createSourceReader(nativeRoot)
const text = async (sourcePath: string) => (await reader.read(sourcePath)).toString("utf8")
const manifest = JSON.parse(await text("package.json"))
const adapter = await inspectNativeAdapter(reader, manifest.name, manifest.codegenConfig)

const bodyAfter = (source: string, marker: string) => {
  const markerIndex = source.indexOf(marker)
  assert.ok(markerIndex >= 0, marker)
  const open = source.indexOf("{", markerIndex)
  let depth = 1
  for (const match of source.slice(open + 1).matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{}]/g)) {
    if (match[0] === "{") depth++
    if (match[0] === "}") depth--
    if (depth === 0) return source.slice(open + 1, open + 1 + match.index!)
  }
  throw new Error(`Unbalanced body: ${marker}`)
}
const statementHash = (source: string) =>
  hashSource(
    Buffer.from(
      stripSourceComments(source).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\s+/g, (token) =>
        /^\s+$/.test(token) ? "" : token,
      ),
    ),
  )

// Frozen from 25206f24. Normalization removes trivia, retains literal bytes, and adapts only
// the moved context/session names, shared mutex indirection and JSI string conversion boundary.
const BEFORE_EXTRACTION = {
  javaRequest: "f448628382f728b07fc34efb36c6a69e237c75f6f47f69c2cfacbb06bf44b182",
  javaDriver: "d8a16074f93bab39044e08dc87f587d20fe54e7129a96c6ead085fa84604b0e8",
  javaMount: "9e47cb9b341792a1cdb1d77f1f31641a96ad2403b9ff10b26c1f7404ced827ee",
  jniTableFunctions: "a47b5800d00e6c143403aabf05e922442407c0072d45b1bfb3132bb072ff392d",
  iosRequest: "82390c143f658be97b537b172ba8c82b8e200618a7b76245d68658648d654d5f",
  iosMount: "3dd4d5b70a0145873807cef502e35f31b5b52df61d70d7a628eb04827bb8365d",
  iosClose: "b9bf4e023d44de3f41ad16d4001a212bbb7c09f81c76164d7cbc1df094259699",
  iosPop: "d9befe30b7cc97a4a706f590966a33190f6ffbbeae3ee226eaf082c089661d01",
  javaPop: "414d6c8a6f62498eef14386d342b19e07c4128bd8695e5a60875ed31b4ba9ea4",
  nativePopFrame: "d6c6d82e099d5e9cdf8cf510f531f6e8e7ba98ebcfa08c495700cfe63ec9e563",
  nativeViewport: "b81bf83eb6b4073eeac6e6d3b5e786edcdbc6a169e5579c83cb06b0240d05ec8",
  nativeCreatePop: "0a731af01a42dbf562276215d0d7eec1609d9e649a1aa61e53ccd26a5e229e8f",
  nativePopRequest: "608079de19f7fa278e934835f94c05a97564457b228a00ba77035153e8c2eb22",
  nativeClosePop: "c2c92ba0eda5aec732b28e499c2c1440d6ea6a4ce29449c0cc838fc54617018c",
} as const

test("extracted Android request, mount and native driver preserve the original guarded statements", async () => {
  const session = await text("android/src/main/java/com/codonui/input/CUITableNativeSession.java")
  const request = bodyAfter(session, "@Override public String request(")
  assert.equal(statementHash(bodyAfter(request, "synchronized (lock)")), BEFORE_EXTRACTION.javaRequest)
  assert.equal(
    statementHash(bodyAfter(session, "@DoNotStrip private void onTableStickyMount()")),
    BEFORE_EXTRACTION.javaMount,
  )
  assert.equal(
    statementHash(await text("android/src/main/java/com/codonui/input/CUITableStickyPresentation.java")),
    BEFORE_EXTRACTION.javaDriver,
  )
  const core = await text("android/src/main/java/com/codonui/input/CUIMotionSnapshotModule.java")
  assert.match(core, /createTable\(context, valid, this\)/)
  assert.match(
    core,
    /synchronized String tableStickyPresentation\(String encoded\)\s*\{\s*return tableFeature.request\(encoded\);/,
  )
  assert.match(
    core,
    /valid.set\(false\);[\s\S]*nativeClosePop[\s\S]*backdrop.invalidate\(\)[\s\S]*tableFeature.invalidate\(\)/,
  )
  assert.ok(!/tableHandle|tableDriver|nativeCreateTable|CUITableStickyPresentation/.test(core))
  assert.equal(
    statementHash(bodyAfter(core, "@Override public synchronized String popPresentation(")),
    BEFORE_EXTRACTION.javaPop,
  )
})

test("extracted iOS request, mount and cleanup retain calling-runtime and lifecycle statements", async () => {
  const feature = await text("ios/CUITableFeature.mm")
  assert.equal(statementHash(bodyAfter(feature, "std::string request(")), BEFORE_EXTRACTION.iosRequest)
  assert.equal(statementHash(bodyAfter(feature, "static void CUIUpdateStickyDriver(")), BEFORE_EXTRACTION.iosMount)
  assert.equal(statementHash(bodyAfter(feature, "void close()")), BEFORE_EXTRACTION.iosClose)
  const core = await text("ios/CUIMotionSnapshot.mm")
  assert.match(core, /CUICreateNativeTableFeature\(_valid, _pop->mutex\)/)
  assert.match(core, /self.table_->request\(runtime, encoded\)/)
  assert.match(core, /_valid->store\(false\); _pop->close\(\); _table->close\(\)/)
  assert.match(core, /count != 1 \|\| !arguments\[0\].isString\(\)/)
  assert.ok(!/codon::table|CUITableStickyPresentation|CUIUpdateStickyDriver/.test(core))
  assert.equal(statementHash(bodyAfter(core, "static facebook::jsi::Value popPresentation(")), BEFORE_EXTRACTION.iosPop)
})

test("Table JNI functions retain original bodies, bind the feature class once and share the sole loader", async () => {
  const feature = await text("android/src/main/jni/TableStickyJNI.cpp")
  assert.equal(
    statementHash(
      feature.slice(
        feature.indexOf("struct NativeTableSession {"),
        feature.indexOf("void registerTableStickyNatives()"),
      ),
    ),
    BEFORE_EXTRACTION.jniTableFunctions,
  )
  const core = await text("android/src/main/jni/MotionSnapshotJNI.cpp")
  for (const name of [
    "nativePopFrame",
    "nativeViewport",
    "nativeCreatePop",
    "nativePopRequest",
    "nativeClosePop",
  ] as const)
    assert.equal(statementHash(bodyAfter(core, `${name}(`)), BEFORE_EXTRACTION[name])
  assert.ok(!/NativeTableSession|nativeCreateTable|cpp\/table/.test(core))
  assert.equal(core.split("registerNativeFeatureNatives();").length - 1, 1)
  assert.equal(feature.split('findClassStatic("com/codonui/input/CUITableNativeSession")').length - 1, 1)
  const nativeMethods = [...feature.matchAll(/makeNativeMethod\("([^"]+)"/g)].map((match) => match[1]).sort()
  const javaSession = await text("android/src/main/java/com/codonui/input/CUITableNativeSession.java")
  const declarations = [...javaSession.matchAll(/private static native \w+ (\w+)\(/g)].map((match) => match[1]).sort()
  assert.deepEqual(nativeMethods, declarations)
  assert.equal(nativeMethods.length, 7)
  assert.match(
    await text("android/src/main/consumer-rules.pro"),
    /-keep class com.codonui.input.CUITableNativeSession \{ \*; \}/,
  )
  const allCpp = await Promise.all(adapter.files.filter((file) => file.endsWith(".cpp")).map(text))
  assert.equal(allCpp.join("\n").split("JNI_OnLoad(").length - 1, 1)
})

type TSchema = {
  modules: Record<string, { type: string; moduleName?: string; spec?: { methods: { name: string }[] } }>
}
const codegenDirectory = path.join(nativeRoot, "node_modules/react-native/scripts/codegen")
const requireNative = createRequire(path.join(nativeRoot, "node_modules/react-native/package.json"))
const utils = requireNative(path.join(codegenDirectory, "codegen-utils.js")) as {
  getCombineJSToSchema: () => { combineSchemasInFileList: (paths: string[], platform: string) => TSchema }
}
const generator = requireNative(path.join(codegenDirectory, "generate-specs-cli-executor.js")) as {
  generateSpecFromInMemorySchema: (
    platform: string,
    schema: TSchema,
    output: string,
    name: string,
    javaPackage: string,
    type: string,
    localPaths: boolean,
  ) => void
}
const listFiles = async (root: string): Promise<string[]> => {
  const files: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(absolute)))
    else files.push(absolute)
  }
  return files.sort()
}

test("materialized full and core-only inputs validate native source closure and emit identical stable codegen", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "codon-table-selection-"))
  const generatedIdentities = new Map<string, string[]>()
  let providerIdentities: string[] | undefined
  try {
    for (const includeTable of [true, false]) {
      const profile = includeTable ? "full" : "core"
      const projection = await projectNativeTableSources(reader, adapter, includeTable)
      assert.equal(projection.selectiveInstallValidated, false)
      assert.equal(projection.excludedFiles.length, includeTable ? 0 : 13)
      assert.equal(projection.replacements.length, includeTable ? 0 : 5)
      const replacements = new Map(projection.replacements.map((item) => [item.sourcePath, item]))
      const projectRoot = path.join(output, profile)
      for (const sourcePath of projection.retainedFiles) {
        const replacement = replacements.get(sourcePath)
        const original = await reader.read(sourcePath)
        if (replacement) {
          assert.equal(hashSource(original), replacement.sourceContentHash)
          assert.equal(hashSource(Buffer.from(replacement.content)), replacement.contentHash)
        }
        await mkdir(path.dirname(path.join(projectRoot, sourcePath)), { recursive: true })
        await writeFile(path.join(projectRoot, sourcePath), replacement?.content ?? original)
      }
      const projectedReader = await createSourceReader(projectRoot)
      const projectedAdapter = await inspectNativeAdapter(projectedReader, manifest.name, manifest.codegenConfig)
      assert.deepEqual(projectedAdapter.findings, [])
      assert.equal(projectedAdapter.cmakeSources.length, includeTable ? 19 : 16)
      if (!includeTable) {
        assert.ok(projectedAdapter.files.every((file) => !projection.excludedFiles.includes(file)))
        assert.ok(
          !projectedAdapter.dependencies.some((edge) =>
            /CUITableNativeSession|TableStickyJNI|cpp\/table\/|ios\/CUITable/.test(edge.to),
          ),
        )
        for (const sourcePath of [
          "ios/CUINativeFeatures.mm",
          "android/src/main/java/com/codonui/input/CUINativeFeatures.java",
        ])
          assert.match((await projectedReader.read(sourcePath)).toString("utf8"), /Table sticky: feature not installed/)
        assert.ok(
          !(await projectedReader.read("android/src/main/consumer-rules.pro"))
            .toString("utf8")
            .includes("CUITableNativeSession"),
        )
      }
      for (const platform of ["android", "ios"]) {
        const schema = utils
          .getCombineJSToSchema()
          .combineSchemasInFileList([path.join(projectRoot, manifest.codegenConfig.jsSrcsDir)], platform)
        assert.equal(Object.keys(schema.modules).length, 10)
        assert.ok(
          Object.values(schema.modules)
            .find((module) => module.moduleName === "CUIMotionSnapshot")
            ?.spec?.methods.some((method) => method.name === "tableStickyPresentation"),
        )
        const generatedRoot = path.join(output, `${profile}-${platform}`)
        generator.generateSpecFromInMemorySchema(
          platform,
          schema,
          generatedRoot,
          manifest.codegenConfig.name,
          manifest.codegenConfig.android.javaPackageName,
          manifest.codegenConfig.type,
          false,
        )
        const hashes = await Promise.all(
          (await listFiles(generatedRoot)).map(
            async (file) => `${path.relative(generatedRoot, file)}:${hashSource(await readFile(file))}`,
          ),
        )
        if (includeTable) generatedIdentities.set(platform, hashes)
        else assert.deepEqual(hashes, generatedIdentities.get(platform))
        if (platform === "android") {
          const cpp = (await listFiles(generatedRoot)).filter((file) => file.endsWith(".cpp"))
          assert.deepEqual(
            validateNativeCompileOwnership([
              { name: "codon_motion", sourcePaths: projectedAdapter.cmakeSources },
              {
                name: "react_codegen_CodonNativeOverlay",
                sourcePaths: ["android/src/main/jni/overlay/CodonNativeOverlay.cpp", ...cpp],
              },
            ]),
            [],
          )
          assert.match(
            await readFile(path.join(generatedRoot, "jni/CMakeLists.txt"), "utf8"),
            /react_codegen_CodonNativeInputSpec/,
          )
        }
      }
      const providerDirectory = path.join(output, `${profile}-providers`)
      const libraries = [{ config: manifest.codegenConfig, libraryPath: projectRoot }]
      const moduleEmitter = requireNative(
        path.join(codegenDirectory, "generate-artifacts-executor/generateRCTModuleProviders.js"),
      ) as {
        generateRCTModuleProviders: (root: string, pkg: object, libraries: unknown[], output: string) => void
      }
      const componentEmitter = requireNative(
        path.join(codegenDirectory, "generate-artifacts-executor/generateRCTThirdPartyComponents.js"),
      ) as {
        generateRCTThirdPartyComponents: (libraries: unknown[], output: string) => void
      }
      moduleEmitter.generateRCTModuleProviders(projectRoot, {}, libraries, providerDirectory)
      componentEmitter.generateRCTThirdPartyComponents(libraries, providerDirectory)
      const providerHashes = await Promise.all(
        (await listFiles(providerDirectory)).map(
          async (file) => `${path.basename(file)}:${hashSource(await readFile(file))}`,
        ),
      )
      if (includeTable) providerIdentities = providerHashes
      else assert.deepEqual(providerHashes, providerIdentities)
      await mkdir(path.join(projectRoot, "ios/ProjectionMetadata.xcodeproj"), { recursive: true })
      const podspecEmitter = requireNative(
        path.join(codegenDirectory, "generate-artifacts-executor/generateReactCodegenPodspec.js"),
      ) as {
        generateReactCodegenPodspec: (root: string, manifest: object, output: string, base: string) => void
      }
      podspecEmitter.generateReactCodegenPodspec(projectRoot, manifest, providerDirectory, projectRoot)
      const generatedPodspec = await readFile(path.join(providerDirectory, "ReactCodegen.podspec"), "utf8")
      for (const binding of projectedAdapter.bindings)
        assert.ok(generatedPodspec.includes(binding.sourcePath), binding.sourcePath)
    }
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test("projection refuses unknown source ownership, changed composition and unsupported build source formatting", async () => {
  await assert.rejects(
    projectNativeTableSources(
      reader,
      {
        ...adapter,
        dependencies: [
          ...adapter.dependencies,
          { from: "ios/CUIMotionSnapshot.mm", to: "ios/CUITableFeature.h", kind: "native-include" },
        ],
      },
      false,
    ),
    /Shared implementation still depends on Table/,
  )
  await assert.rejects(
    projectNativeTableSources(reader, { ...adapter, files: [...adapter.files, "cpp/table/New.cpp"] }, false),
    /valid canonical inputs/,
  )
  const changedFactory: TSourceReader = {
    ...reader,
    read: async (sourcePath) =>
      sourcePath === "ios/CUINativeFeatures.mm" ? Buffer.from("void wrongFactory() {}") : reader.read(sourcePath),
  }
  await assert.rejects(
    projectNativeTableSources(changedFactory, adapter, false),
    /Full-package feature composition changed/,
  )
  const changedBuild: TSourceReader = {
    ...reader,
    read: async (sourcePath) =>
      sourcePath === "android/src/main/jni/CMakeLists.txt"
        ? Buffer.from((await text(sourcePath)).replace("  TableStickyJNI.cpp\n", "    TableStickyJNI.cpp\n"))
        : reader.read(sourcePath),
  }
  await assert.rejects(projectNativeTableSources(changedBuild, adapter, false), /Native composition profile changed/)
})
