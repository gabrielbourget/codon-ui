import assert from "node:assert/strict"
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { inspectNativeAdapter } from "./nativeAdapter"
import {
  inspectTableNativeOwnership,
  validateNativeCompileOwnership,
  validateNativeRegistrationClaims,
} from "./ownership"
import { createSourceReader, type TSourceReader } from "./sourceFiles"

const nativeRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const reader = await createSourceReader(nativeRoot)
const manifest = JSON.parse((await reader.read("package.json")).toString("utf8")) as {
  name: string
  codegenConfig: {
    name: string
    type: string
    jsSrcsDir: string
    android: { javaPackageName: string }
    ios: { modulesProvider: Record<string, string>; componentProvider: Record<string, string> }
  }
}
const adapter = await inspectNativeAdapter(reader, manifest.name, manifest.codegenConfig)
const complete = await inspectTableNativeOwnership(reader, adapter, true)
const omitted = await inspectTableNativeOwnership(reader, adapter, false)

test("all native inputs have one explicit owner; Table's eight files are not independently removable", () => {
  assert.deepEqual(complete.findings, [])
  assert.equal(complete.status, "source-complete")
  assert.equal(complete.selectiveInstallValidated, false)
  const table = complete.units.find((item) => item.id === "table")!
  const shared = complete.units.find((item) => item.id === "shared")!
  assert.equal(table.files.length, 8)
  assert.deepEqual(table.requires, ["shared"])
  assert.deepEqual(shared.requires, ["table"])
  assert.deepEqual([...shared.files, ...table.files].sort(), [...adapter.files].sort())
  assert.equal(new Set([...shared.files, ...table.files]).size, adapter.files.length)
  assert.equal(omitted.status, "blocked")
  assert.deepEqual(omitted.excludedFiles, table.files)
  assert.ok(
    omitted.findings.some(
      (item) => item.code === "native-retained-reference" && item.sourcePath === "ios/CUIMotionSnapshot.mm",
    ),
  )
  assert.ok(
    omitted.findings.some(
      (item) => item.code === "native-retained-reference" && item.sourcePath.endsWith("CUIMotionSnapshotModule.java"),
    ),
  )
  assert.ok(
    omitted.findings.some(
      (item) => item.code === "native-retained-reference" && item.sourcePath.endsWith("MotionSnapshotJNI.cpp"),
    ),
  )
  assert.ok(
    omitted.findings.some(
      (item) => item.code === "native-build-selection-required" && item.sourcePath.endsWith("CMakeLists.txt"),
    ),
  )
  assert.ok(
    omitted.findings.some(
      (item) => item.code === "native-build-selection-required" && item.sourcePath.endsWith(".podspec"),
    ),
  )
  assert.equal(omitted.embeddedTableSources.length, 4)
})

test("Table does not independently claim the shared module, package, descriptors, loader or prefab", () => {
  assert.deepEqual(validateNativeRegistrationClaims(complete.registrationClaims), [])
  assert.ok(complete.registrationClaims.every((claim) => claim.unit === "shared"))
  for (const scope of ["codegen-binding", "ios-provider", "android-provider"]) {
    assert.equal(
      complete.registrationClaims.filter((claim) => claim.scope === scope && claim.identity === "CUIMotionSnapshot")
        .length,
      1,
    )
    const motion = complete.registrationClaims.find(
      (claim) => claim.scope === scope && claim.identity === "CUIMotionSnapshot",
    )!
    const duplicates = validateNativeRegistrationClaims([...complete.registrationClaims, { ...motion, unit: "table" }])
    assert.equal(duplicates.length, 1)
    assert.equal(duplicates[0].code, "duplicate-native-registration")
  }
  for (const scope of [
    "android-package",
    "android-descriptor",
    "ios-pod",
    "cmake-target",
    "jni-entry",
    "prefab-package",
  ]) {
    const original = complete.registrationClaims.find((claim) => claim.scope === scope)!
    assert.equal(
      validateNativeRegistrationClaims([...complete.registrationClaims, { ...original, unit: "table" }]).length,
      1,
    )
    assert.equal(validateNativeRegistrationClaims([...complete.registrationClaims, original]).length, 1)
  }
  assert.equal(complete.registrationClaims.filter((claim) => claim.scope === "jni-entry").length, 1)
})

test("unknown Table files and changed embedded method/lifecycle boundaries require an ownership update", async () => {
  const drifted: TSourceReader = {
    ...reader,
    read: async (sourcePath) =>
      sourcePath === "src/input/specs/NativeCUIMotionSnapshot.ts"
        ? Buffer.from("export interface Spec {}")
        : reader.read(sourcePath),
  }
  const drift = await inspectTableNativeOwnership(
    drifted,
    { ...adapter, files: [...adapter.files, "cpp/table/New.cpp"] },
    true,
  )
  assert.equal(drift.status, "blocked")
  assert.ok(drift.findings.some((item) => item.message.includes("New Table input")))
  assert.ok(drift.findings.some((item) => item.message.includes("Embedded Table boundary changed")))
})

// Exercise the pinned generator itself; no generated C++/provider fixtures are hand-authored.
type TSchema = {
  modules: Record<
    string,
    { type: string; moduleName?: string; components?: Record<string, unknown>; spec?: { methods: { name: string }[] } }
  >
}
const requireNative = createRequire(path.join(nativeRoot, "node_modules/react-native/package.json"))
assert.equal((requireNative("./package.json") as { version: string }).version, "0.86.3")
const codegenDirectory = path.join(nativeRoot, "node_modules/react-native/scripts/codegen")
const utils = requireNative(path.join(codegenDirectory, "codegen-utils.js")) as {
  getCombineJSToSchema: () => { combineSchemasInFileList: (sourcePaths: string[], platform: string) => TSchema }
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
const output = await mkdtemp(path.join(tmpdir(), "codon-native-ownership-codegen-"))
after(async () => rm(output, { recursive: true, force: true }))
const schemas = new Map<string, TSchema>()
for (const platform of ["android", "ios"]) {
  const schema = utils
    .getCombineJSToSchema()
    .combineSchemasInFileList([path.join(nativeRoot, manifest.codegenConfig.jsSrcsDir)], platform)
  schemas.set(platform, schema)
  generator.generateSpecFromInMemorySchema(
    platform,
    schema,
    path.join(output, platform),
    manifest.codegenConfig.name,
    manifest.codegenConfig.android.javaPackageName,
    manifest.codegenConfig.type,
    false,
  )
}

test("real Android/iOS schemas still place the Table method inside the shared CUIMotionSnapshot module", async () => {
  for (const schema of schemas.values()) {
    assert.equal(Object.keys(schema.modules).length, 10)
    const modules = Object.values(schema.modules).filter((item) => item.type === "NativeModule")
    assert.equal(modules.length, 3)
    assert.equal(modules.filter((item) => item.moduleName === "CUIMotionSnapshot").length, 1)
    assert.equal(
      modules.filter((item) => item.spec?.methods.some((method) => method.name === "tableStickyPresentation")).length,
      1,
    )
    assert.ok(
      modules
        .find((item) => item.moduleName === "CUIMotionSnapshot")
        ?.spec?.methods.some((method) => method.name === "tableStickyPresentation"),
    )
  }
  const java = await readFile(
    path.join(output, "android/java/com/codonui/input/NativeCUIMotionSnapshotSpec.java"),
    "utf8",
  )
  assert.match(java, /abstract String tableStickyPresentation\(String request\)/)
  const ios = await readFile(path.join(output, "ios/CodonNativeInputSpec/CodonNativeInputSpec.h"), "utf8")
  assert.match(ios, /@protocol NativeCUIMotionSnapshotSpec[\s\S]*tableStickyPresentation:/)
  const cpp = await readFile(path.join(output, "android/jni/CodonNativeInputSpec-generated.cpp"), "utf8")
  assert.equal([...cpp.matchAll(/if \(moduleName == "CUIMotionSnapshot"\)/g)].length, 1)
  assert.match(cpp, /methodMap_\["tableStickyPresentation"\]/)
  const nativeJava = (
    await reader.read("android/src/main/java/com/codonui/input/CUIMotionSnapshotModule.java")
  ).toString("utf8")
  assert.match(nativeJava, /@Override public synchronized String tableStickyPresentation/)
})

test("real generated CMake source ownership is singular in the configured overlay; enabling the standard target duplicates it", async () => {
  const generatedRoot = path.join(output, "android/jni")
  const componentDirectory = `react/renderer/components/${manifest.codegenConfig.name}`
  const generatedCmake = await readFile(path.join(generatedRoot, "CMakeLists.txt"), "utf8")
  assert.ok(
    generatedCmake.includes(`file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS *.cpp ${componentDirectory}/*.cpp)`),
  )
  assert.match(generatedCmake, /add_library\(\s+react_codegen_CodonNativeInputSpec\s+OBJECT/)
  const overlay = (await reader.read("android/src/main/jni/overlay/CMakeLists.txt")).toString("utf8")
  assert.ok(overlay.includes('"${CUI_OVERLAY_GENERATED_DIR}/*.cpp"'))
  assert.ok(overlay.includes(`"\${CUI_OVERLAY_GENERATED_DIR}/${componentDirectory}/*.cpp"`))
  assert.ok(!overlay.includes("add_subdirectory"))
  const generatedCpp = [
    ...(await readdir(generatedRoot))
      .filter((file) => file.endsWith(".cpp"))
      .map((file) => path.join(generatedRoot, file)),
    ...(await readdir(path.join(generatedRoot, componentDirectory)))
      .filter((file) => file.endsWith(".cpp"))
      .map((file) => path.join(generatedRoot, componentDirectory, file)),
  ]
  assert.ok(generatedCpp.length > 1)
  const targets = [
    { name: "codon_motion", sourcePaths: adapter.cmakeSources.map((file) => path.join(nativeRoot, file)) },
    {
      name: "react_codegen_CodonNativeOverlay",
      sourcePaths: [path.join(nativeRoot, "android/src/main/jni/overlay/CodonNativeOverlay.cpp"), ...generatedCpp],
    },
  ]
  assert.deepEqual(validateNativeCompileOwnership(targets), [])
  const duplicated = validateNativeCompileOwnership([
    ...targets,
    { name: "react_codegen_CodonNativeInputSpec", sourcePaths: generatedCpp },
  ])
  assert.equal(duplicated.length, generatedCpp.length)
  assert.ok(duplicated.every((item) => item.code === "duplicate-native-translation-unit"))
})

test("real iOS provider generation registers every shared module/component once and introduces no Table provider", async () => {
  const libraries = [{ config: manifest.codegenConfig, libraryPath: nativeRoot }]
  const providerDirectory = path.join(output, "providers")
  const modules = requireNative(
    path.join(codegenDirectory, "generate-artifacts-executor/generateRCTModuleProviders.js"),
  ) as {
    generateRCTModuleProviders: (root: string, pkg: object, libraries: unknown[], output: string) => void
  }
  const components = requireNative(
    path.join(codegenDirectory, "generate-artifacts-executor/generateRCTThirdPartyComponents.js"),
  ) as {
    generateRCTThirdPartyComponents: (libraries: unknown[], output: string) => void
  }
  modules.generateRCTModuleProviders(nativeRoot, {}, libraries, providerDirectory)
  components.generateRCTThirdPartyComponents(libraries, providerDirectory)
  const moduleSource = await readFile(path.join(providerDirectory, "RCTModuleProviders.mm"), "utf8")
  const componentSource = await readFile(path.join(providerDirectory, "RCTThirdPartyComponentsProvider.mm"), "utf8")
  for (const [name, provider] of Object.entries(manifest.codegenConfig.ios.modulesProvider))
    assert.equal(moduleSource.split(`@"${name}": @"${provider}"`).length - 1, 1)
  for (const [name, provider] of Object.entries(manifest.codegenConfig.ios.componentProvider))
    assert.equal(componentSource.split(`@"${name}": NSClassFromString(@"${provider}")`).length - 1, 1)
  assert.ok(!moduleSource.includes('@"CUITable'))
  assert.ok(!componentSource.includes('@"CUITable'))
  const duplicateDirectory = path.join(output, "duplicate-provider-probe")
  components.generateRCTThirdPartyComponents([...libraries, ...libraries], duplicateDirectory)
  const duplicatedComponents = await readFile(
    path.join(duplicateDirectory, "RCTThirdPartyComponentsProvider.mm"),
    "utf8",
  )
  assert.equal(duplicatedComponents.split('@"CUIFocusView": NSClassFromString(@"CUIFocusView")').length - 1, 2)
  assert.ok(
    validateNativeRegistrationClaims([...complete.registrationClaims, ...complete.registrationClaims]).length > 0,
  )
})

test("real generated ReactCodegen podspec retains every spec input; Table files cannot be removed by editing providers alone", async () => {
  // Only project-path metadata is needed by the emitter; this is not a native consumer or an Xcode build.
  const projectRoot = path.join(output, "pod-metadata")
  await mkdir(path.join(projectRoot, "ios/OwnershipMetadata.xcodeproj"), { recursive: true })
  await mkdir(path.join(projectRoot, manifest.codegenConfig.jsSrcsDir), { recursive: true })
  const specs = (await reader.list(manifest.codegenConfig.jsSrcsDir)).filter((file) => file.endsWith(".ts"))
  for (const sourcePath of specs) await copyFile(path.join(nativeRoot, sourcePath), path.join(projectRoot, sourcePath))
  await writeFile(path.join(projectRoot, "package.json"), JSON.stringify(manifest))
  const podspecDirectory = path.join(output, "podspec")
  await mkdir(podspecDirectory)
  const generator = requireNative(
    path.join(codegenDirectory, "generate-artifacts-executor/generateReactCodegenPodspec.js"),
  ) as {
    generateReactCodegenPodspec: (root: string, manifest: object, output: string, base: string) => void
  }
  generator.generateReactCodegenPodspec(projectRoot, manifest, podspecDirectory, projectRoot)
  const podspec = await readFile(path.join(podspecDirectory, "ReactCodegen.podspec"), "utf8")
  for (const sourcePath of specs) assert.ok(podspec.includes(sourcePath), sourcePath)
  const nativePodspec = (await reader.read("CodonNativeInput.podspec")).toString("utf8")
  assert.ok(nativePodspec.includes('"ios/**/*.{h,mm,swift}"'))
  assert.ok(nativePodspec.includes('"cpp/**/*.{h,cpp}"'))
  assert.equal(omitted.status, "blocked")
})
