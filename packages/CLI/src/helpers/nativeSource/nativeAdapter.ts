import path from "node:path"

import { z } from "zod"

import {
  parseSource,
  stringLiteral,
  stripSourceComments,
  visitSource,
  type TSourceFinding,
  type TSourceNode,
  type TSourceReader,
} from "./sourceFiles"

const CODEGEN_NAME = "CodonNativeInputSpec"
const SPEC_DIRECTORY = "src/input/specs"
const JAVA_DIRECTORY = "android/src/main/java/com/codonui/input"
const PACKAGE_PATH = `${JAVA_DIRECTORY}/CodonInputPackage.java`
const MOTION_CMAKE = "android/src/main/jni/CMakeLists.txt"
const OVERLAY_CMAKE = "android/src/main/jni/overlay/CMakeLists.txt"
const DESCRIPTOR_PATH = "cpp/overlay/react/renderer/components/CodonNativeOverlay/ComponentDescriptors.h"

const codegenSchema = z.object({
  name: z.literal(CODEGEN_NAME),
  type: z.literal("all"),
  jsSrcsDir: z.literal(SPEC_DIRECTORY),
  android: z.object({ javaPackageName: z.literal("com.codonui.input") }),
  ios: z.object({ modulesProvider: z.record(z.string()), componentProvider: z.record(z.string()) }),
})

const configSchema = z.object({
  dependency: z.object({
    platforms: z.object({
      android: z.object({
        sourceDir: z.literal("./android"),
        packageImportPath: z.literal("import com.codonui.input.CodonInputPackage;"),
        packageInstance: z.literal("new CodonInputPackage()"),
        libraryName: z.literal("CodonNativeOverlay"),
        cmakeListsPath: z.literal("src/main/jni/overlay/CMakeLists.txt"),
        componentDescriptors: z.array(z.string()),
      }),
      ios: z.object({ podspecPath: z.literal("./CodonNativeInput.podspec") }),
    }),
  }),
})

export type TNativeBinding = {
  kind: "component" | "module"
  name: string
  sourcePath: string
  iosSourcePath?: string
  androidSourcePath?: string
  androidDescriptor?: string
}
export type TNativeDependency = {
  from: string
  to: string
  kind: "native-build" | "native-registration" | "native-include" | "native-java"
}
export type TNativeAdapter = {
  identity: string
  files: string[]
  bindings: TNativeBinding[]
  prefabPackage: string
  cmakeSources: string[]
  dependencies: TNativeDependency[]
  findings: TSourceFinding[]
}

const readLiteral = (value: unknown): unknown => {
  const node = value as TSourceNode
  if (!node || typeof node !== "object") throw new Error("Expected static config literal")
  if (["StringLiteral", "BooleanLiteral", "NumericLiteral"].includes(String(node.type))) return node.value
  if (node.type === "ArrayExpression") return (node.elements as unknown[]).map(readLiteral)
  if (node.type === "ObjectExpression")
    return Object.fromEntries(
      (node.properties as TSourceNode[]).map((property) => {
        if (property.type !== "ObjectProperty" || property.computed)
          throw new Error("Dynamic native config is unsupported")
        const key = property.key as TSourceNode
        return [String(key.name ?? key.value), readLiteral(property.value)]
      }),
    )
  throw new Error("Dynamic native config is unsupported")
}

export const readNativeBindings = (content: string, sourcePath: string): TNativeBinding[] => {
  const bindings: TNativeBinding[] = []
  visitSource(parseSource(content), (node) => {
    if (node.type !== "CallExpression") return
    const callee = node.callee as TSourceNode
    const name = stringLiteral((node.arguments as unknown[])[0])
    if (!name) return
    if (callee.type === "Identifier" && callee.name === "codegenNativeComponent")
      bindings.push({ kind: "component", name, sourcePath })
    const object = callee.object as TSourceNode | undefined
    const property = callee.property as TSourceNode | undefined
    if (
      callee.type === "MemberExpression" &&
      object?.name === "TurboModuleRegistry" &&
      ["get", "getEnforcing"].includes(String(property?.name))
    )
      bindings.push({ kind: "module", name, sourcePath })
  })
  return bindings
}

// This is a source profile for the maintained adapter, not a Ruby/Groovy/CMake interpreter.
// Unsupported registration shapes are findings; source is never executed during inspection.
export const inspectNativeAdapter = async (
  reader: TSourceReader,
  packageName: string,
  codegenConfig: unknown,
): Promise<TNativeAdapter> => {
  const findings: TSourceFinding[] = []
  const dependencies = new Map<string, TNativeDependency>()
  const depend = (from: string, to: string, kind: TNativeDependency["kind"]) => {
    if (from !== to) dependencies.set(JSON.stringify([from, to, kind]), { from, to, kind })
  }
  const report = (sourcePath: string, message: string) =>
    findings.push({ code: "native-registration", sourcePath, message })
  const requireText = (sourcePath: string, text: string, expected: string) => {
    if (!text.includes(expected)) report(sourcePath, `Missing native integration: ${expected}`)
  }
  const readText = async (sourcePath: string) => {
    try {
      return stripSourceComments(
        (await reader.read(sourcePath)).toString("utf8"),
        sourcePath.endsWith("CMakeLists.txt") || sourcePath.endsWith(".podspec"),
      )
    } catch (error) {
      report(sourcePath, String(error))
      return ""
    }
  }
  const files = ["package.json", "react-native.config.js", "CodonNativeInput.podspec", "android/build.gradle"]
  for (const directory of ["ios", "android/src", "cpp"]) {
    try {
      files.push(...(await reader.list(directory)))
    } catch (error) {
      report(directory, String(error))
    }
  }
  let specPaths: string[] = []
  try {
    specPaths = await reader.list(SPEC_DIRECTORY)
  } catch (error) {
    report(SPEC_DIRECTORY, String(error))
  }
  files.push(...specPaths)
  const bindings: TNativeBinding[] = []
  for (const sourcePath of specPaths.filter((item) => item.endsWith(".ts"))) {
    try {
      const found = readNativeBindings(await readText(sourcePath), sourcePath)
      if (found.length !== 1) report(sourcePath, "Expected exactly one recognized codegen binding")
      bindings.push(...found)
    } catch (error) {
      report(sourcePath, String(error))
    }
  }
  const parsedCodegen = codegenSchema.safeParse(codegenConfig)
  if (!parsedCodegen.success) report("package.json", `Unsupported codegen config: ${parsedCodegen.error.message}`)
  let config: z.infer<typeof configSchema> | undefined
  try {
    const ast = parseSource(await readText("react-native.config.js"))
    const statement = ast.program.body.find((node) => node.type === "ExportDefaultDeclaration") as
      | TSourceNode
      | undefined
    config = configSchema.parse(readLiteral(statement?.declaration))
  } catch (error) {
    report("react-native.config.js", String(error))
  }
  const packageSource = await readText(PACKAGE_PATH)
  const iosImplementations = new Map<string, { sourcePath: string; content: string }[]>()
  for (const sourcePath of files.filter((item) => item.startsWith("ios/") && item.endsWith(".mm"))) {
    const content = await readText(sourcePath)
    for (const match of content.matchAll(/@implementation\s+(\w+)\b/g)) {
      iosImplementations.set(match[1], [...(iosImplementations.get(match[1]) ?? []), { sourcePath, content }])
    }
  }
  const expectedDescriptors: string[] = []
  const seen = new Set<string>()
  for (const binding of bindings) {
    if (!/^[A-Za-z_]\w*$/.test(binding.name)) {
      report(binding.sourcePath, `Invalid codegen identity: ${binding.name}`)
      continue
    }
    if (seen.has(binding.name)) report(binding.sourcePath, `Duplicate codegen identity: ${binding.name}`)
    seen.add(binding.name)
    const providerMap =
      binding.kind === "module" ? parsedCodegen.data?.ios.modulesProvider : parsedCodegen.data?.ios.componentProvider
    const provider = providerMap?.[binding.name]
    if (!provider) report("package.json", `Missing iOS provider for ${binding.name}`)
    else {
      const implementations = iosImplementations.get(provider) ?? []
      if (implementations.length !== 1)
        report("package.json", `Expected one iOS implementation of ${provider}, found ${implementations.length}`)
      else {
        binding.iosSourcePath = implementations[0].sourcePath
        depend("package.json", binding.iosSourcePath, "native-registration")
        requireText(
          binding.iosSourcePath,
          implementations[0].content,
          binding.kind === "module"
            ? `RCT_EXPORT_MODULE(${binding.name})`
            : `concreteComponentDescriptorProvider<${binding.name === "CUIFocusView" ? "CUIOwnedFocusView" : binding.name}ComponentDescriptor>`,
        )
      }
    }
    const javaClass = `${binding.name}${binding.kind === "component" ? "Manager" : "Module"}`
    const javaPath = `${JAVA_DIRECTORY}/${javaClass}.java`
    binding.androidSourcePath = javaPath
    depend(PACKAGE_PATH, javaPath, "native-registration")
    const javaSource = await readText(javaPath)
    if (binding.kind === "component" && !new RegExp(`NAME\\s*=\\s*"${binding.name}"`).test(javaSource))
      report(javaPath, `Missing Java binding name ${binding.name}`)
    requireText(PACKAGE_PATH, packageSource, `new ${javaClass}(`)
    if (binding.kind === "module") {
      requireText(javaPath, javaSource, `extends Native${binding.name}Spec`)
      requireText(PACKAGE_PATH, packageSource, `modules.put(${javaClass}.NAME,`)
    } else {
      binding.androidDescriptor =
        binding.name === "CUIFocusView" ? "CUIOwnedFocusViewComponentDescriptor" : `${binding.name}ComponentDescriptor`
      expectedDescriptors.push(binding.androidDescriptor)
      requireText(javaPath, javaSource, `${binding.name}ManagerDelegate`)
    }
  }
  const registeredClasses = new Set(
    bindings.map((binding) => `${binding.name}${binding.kind === "component" ? "Manager" : "Module"}`),
  )
  for (const match of packageSource.matchAll(/new\s+(CUI\w+(?:Manager|Module))\(/g)) {
    if (!registeredClasses.has(match[1]))
      report(PACKAGE_PATH, `Android package registers an unknown codegen class: ${match[1]}`)
  }
  const javaSources = new Map<string, string>()
  const javaClasses = new Map<string, string>()
  for (const sourcePath of files.filter((item) => item.endsWith(".java"))) {
    const javaSource = await readText(sourcePath)
    for (const match of javaSource.matchAll(/\bSystem\.loadLibrary\(\s*"([^"]+)"/g)) {
      if (match[1] !== "codon_motion") report(sourcePath, `Unsupported JNI library identity: ${match[1]}`)
    }
    const content = javaSource.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ")
    javaSources.set(sourcePath, content)
    for (const match of content.matchAll(/\b(?:class|interface|enum|record)\s+(\w+)/g))
      javaClasses.set(match[1], sourcePath)
    depend("android/build.gradle", sourcePath, "native-build")
  }
  const generatedClasses = new Set(
    bindings
      .filter((item) => item.kind === "component")
      .flatMap((item) => [`${item.name}ManagerDelegate`, `${item.name}ManagerInterface`]),
  )
  for (const [sourcePath, content] of javaSources) {
    for (const match of content.matchAll(/\bCUI\w+\b/g)) {
      const target = javaClasses.get(match[0])
      if (target) depend(sourcePath, target, "native-java")
      else if (!generatedClasses.has(match[0])) report(sourcePath, `Unresolved owned Java type: ${match[0]}`)
    }
  }
  for (const [kind, providers] of Object.entries(parsedCodegen.data?.ios ?? {})) {
    const expectedNames = bindings
      .filter((item) => (kind === "modulesProvider") === (item.kind === "module"))
      .map((item) => item.name)
      .sort()
    if (JSON.stringify(Object.keys(providers).sort()) !== JSON.stringify(expectedNames))
      report("package.json", `iOS ${kind} does not match codegen specs`)
  }
  const descriptors = config?.dependency.platforms.android.componentDescriptors ?? []
  if (JSON.stringify([...descriptors].sort()) !== JSON.stringify(expectedDescriptors.sort()))
    report("react-native.config.js", "Android descriptors do not match codegen specs and owned focus descriptor")
  requireText(DESCRIPTOR_PATH, await readText(DESCRIPTOR_PATH), "../../../../../input/PositionDescriptor.h")
  requireText(
    "cpp/input/PositionDescriptor.h",
    await readText("cpp/input/PositionDescriptor.h"),
    "class CUIOwnedFocusViewComponentDescriptor",
  )
  const podspec = await readText("CodonNativeInput.podspec")
  for (const token of [
    's.name = "CodonNativeInput"',
    '"ios/**/*.{h,mm,swift}"',
    '"cpp/**/*.{h,cpp}"',
    "install_modules_dependencies(s)",
    's.public_header_files = "ios/CUIBackdropCaptureSource.h", "ios/CUIForegroundCompositionSource.h"',
  ])
    requireText("CodonNativeInput.podspec", podspec, token)
  const gradle = await readText("android/build.gradle")
  for (const token of [
    "com.facebook.react",
    'namespace "com.codonui.input"',
    "prefabPublishing true",
    "prefab true",
    'codon_motion { headers "../cpp/input" }',
    "src/main/jni/CMakeLists.txt",
    "generateCodegenArtifactsFromSchema",
    "generated/source/codegen/jni",
    'consumerProguardFiles "src/main/consumer-rules.pro"',
  ])
    requireText("android/build.gradle", gradle, token)
  for (const sourcePath of [
    "android/src/main/AndroidManifest.xml",
    "android/src/main/consumer-rules.pro",
    MOTION_CMAKE,
  ]) {
    await readText(sourcePath)
    depend("android/build.gradle", sourcePath, "native-build")
  }
  for (const sourcePath of ["ios/CUIBackdropCaptureSource.h", "ios/CUIForegroundCompositionSource.h"])
    await readText(sourcePath)
  for (const sourcePath of files.filter((item) => /^(?:ios\/.*\.(?:h|mm|swift)|cpp\/.*\.(?:h|cpp))$/.test(item)))
    depend("CodonNativeInput.podspec", sourcePath, "native-build")
  for (const sourcePath of [PACKAGE_PATH, OVERLAY_CMAKE, DESCRIPTOR_PATH, "CodonNativeInput.podspec"])
    depend("react-native.config.js", sourcePath, "native-registration")
  depend(OVERLAY_CMAKE, "android/src/main/jni/overlay/CodonNativeOverlay.cpp", "native-build")
  const prefabPackage = packageName.replace(/^@/, "").replace("/", "_")
  const overlay = await readText(OVERLAY_CMAKE)
  for (const token of [
    `find_package(${prefabPackage} REQUIRED CONFIG)`,
    `${prefabPackage}::codon_motion`,
    "react_codegen_CodonNativeOverlay",
    "CodonNativeOverlay.cpp",
    "${CUI_OVERLAY_GENERATED_DIR}/*.cpp",
    `react/renderer/components/${CODEGEN_NAME}/*.cpp`,
  ])
    requireText(OVERLAY_CMAKE, overlay, token)
  requireText(
    "android/src/main/jni/overlay/CodonNativeOverlay.cpp",
    await readText("android/src/main/jni/overlay/CodonNativeOverlay.cpp"),
    `${CODEGEN_NAME}_ModuleProvider(name, params)`,
  )
  requireText(
    "android/src/main/jni/overlay/CodonNativeOverlay.h",
    await readText("android/src/main/jni/overlay/CodonNativeOverlay.h"),
    "react/renderer/components/CodonNativeOverlay/ComponentDescriptors.h",
  )
  requireText(
    "android/src/main/jni/overlay/CodonNativeOverlay.h",
    await readText("android/src/main/jni/overlay/CodonNativeOverlay.h"),
    `<${CODEGEN_NAME}.h>`,
  )
  const cmake = await readText(MOTION_CMAKE)
  for (const token of [
    "${CODEGEN_DIR}",
    "target_link_libraries(codon_motion ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni android log)",
  ])
    requireText(MOTION_CMAKE, cmake, token)
  const variables: Record<string, string> = { CMAKE_CURRENT_LIST_DIR: path.posix.dirname(MOTION_CMAKE) }
  const expand = (value: string) => value.replace(/\$\{([^}]+)\}/g, (token, name: string) => variables[name] ?? token)
  for (const match of cmake.matchAll(/set\((\w+)\s+"([^"]+)"\)/g))
    variables[match[1]] = path.posix.normalize(expand(match[2]))
  const block = cmake.match(/add_library\(codon_motion\s+SHARED([\s\S]*?)\)/)?.[1]
  if (!block) report(MOTION_CMAKE, "Unsupported codon_motion source list")
  const cmakeSources: string[] = []
  for (const match of (block ?? "").matchAll(/[^\s"()]+\.cpp/g)) {
    const expanded = expand(match[0])
    const sourcePath = path.posix.normalize(
      expanded.startsWith("android/") || expanded.startsWith("cpp/")
        ? expanded
        : path.posix.join(path.posix.dirname(MOTION_CMAKE), expanded),
    )
    cmakeSources.push(sourcePath)
    depend(MOTION_CMAKE, sourcePath, "native-build")
    if (!files.includes(sourcePath)) report(MOTION_CMAKE, `Missing CMake source: ${sourcePath}`)
  }
  for (const sourcePath of files.filter(
    (item) => item.endsWith(".cpp") && !item.includes("/overlay/CodonNativeOverlay.cpp"),
  )) {
    if (!cmakeSources.includes(sourcePath))
      report(MOTION_CMAKE, `Native C++ source is absent from codon_motion: ${sourcePath}`)
  }
  // Quoted includes are owned inputs. Angle-bracket SDK/generated headers are supplied by the native toolchain.
  for (const sourcePath of files.filter((item) => /\.(h|mm|cpp)$/.test(item))) {
    const content = await readText(sourcePath)
    for (const match of content.matchAll(/^\s*#\s*(?:include|import)\s+"([^"]+)"/gm)) {
      const candidates = [path.posix.dirname(sourcePath), "ios", "cpp/motion", "android/src/main/jni"].map(
        (directory) => path.posix.normalize(path.posix.join(directory, match[1])),
      )
      const target = candidates.find((candidate) => files.includes(candidate))
      if (target) depend(sourcePath, target, "native-include")
      else report(sourcePath, `Unresolved owned include: ${match[1]}`)
    }
  }
  return {
    identity: CODEGEN_NAME,
    files: [...new Set(files)].sort(),
    bindings,
    prefabPackage,
    cmakeSources: cmakeSources.sort(),
    dependencies: [...dependencies.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    findings,
  }
}
