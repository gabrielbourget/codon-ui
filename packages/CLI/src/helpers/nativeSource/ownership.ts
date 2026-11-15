import path from "node:path"

import type { TNativeAdapter, TNativeDependency } from "./nativeAdapter"
import { hashSource, stripSourceComments, type TSourceFinding, type TSourceReader } from "./sourceFiles"

export const NATIVE_OWNERSHIP_UNITS = ["shared", "table"] as const
export type TNativeOwnershipUnit = (typeof NATIVE_OWNERSHIP_UNITS)[number]
export type TNativeRegistrationClaim = {
  scope: string
  identity: string
  unit: TNativeOwnershipUnit
  sourcePath: string
}

export const TABLE_NATIVE_FILES = [
  "android/src/main/java/com/codonui/input/CUITableNativeSession.java",
  "android/src/main/java/com/codonui/input/CUITableStickyPresentation.java",
  "android/src/main/jni/TableStickyJNI.cpp",
  "android/src/main/jni/TableStickyJNI.h",
  "cpp/table/StickyConstraints.h",
  "cpp/table/StickyPresentation.cpp",
  "cpp/table/StickyPresentation.h",
  "cpp/table/StickyStyle.cpp",
  "cpp/table/StickyStyle.h",
  "ios/CUITableFeature.h",
  "ios/CUITableFeature.mm",
  "ios/CUITableStickyPresentation.h",
  "ios/CUITableStickyPresentation.mm",
] as const

export const TABLE_COMPOSITION_FILES = [
  "ios/CUINativeFeatures.mm",
  "android/src/main/java/com/codonui/input/CUINativeFeatures.java",
  "android/src/main/jni/NativeFeaturesJNI.cpp",
  "android/src/main/jni/CMakeLists.txt",
  "android/src/main/consumer-rules.pro",
] as const

const TABLE_BOUNDARIES = [
  {
    sourcePath: "src/input/specs/NativeCUIMotionSnapshot.ts",
    role: "shared-abi",
    markers: ["tableStickyPresentation(request: string): string"],
  },
  {
    sourcePath: "ios/CUITableFeature.mm",
    role: "feature-implementation",
    markers: ["class CUITableFeature", "CUIUpdateStickyDriver", "session_->mutex"],
  },
  {
    sourcePath: "android/src/main/java/com/codonui/input/CUITableNativeSession.java",
    role: "feature-implementation",
    markers: ["String request(String encoded)", "nativeCreateTable(", "tableDriver.invalidate()"],
  },
  {
    sourcePath: "android/src/main/jni/TableStickyJNI.cpp",
    role: "feature-implementation",
    markers: ["struct NativeTableSession", 'makeNativeMethod("nativeCreateTable", nativeCreateTable)'],
  },
] as const

export const validateNativeRegistrationClaims = (claims: readonly TNativeRegistrationClaim[]): TSourceFinding[] => {
  const seen = new Map<string, TNativeRegistrationClaim>()
  const findings: TSourceFinding[] = []
  for (const claim of claims) {
    const key = JSON.stringify([claim.scope, claim.identity])
    const prior = seen.get(key)
    if (prior)
      findings.push({
        code: "duplicate-native-registration",
        sourcePath: claim.sourcePath,
        message: `${claim.scope} ${claim.identity} claimed by both ${prior.unit}:${prior.sourcePath} and ${claim.unit}:${claim.sourcePath}`,
      })
    else seen.set(key, claim)
  }
  return findings
}

export const validateNativeCompileOwnership = (
  targets: readonly { name: string; sourcePaths: readonly string[] }[],
): TSourceFinding[] => {
  const compiledBy = new Map<string, string>()
  const findings: TSourceFinding[] = []
  for (const target of targets)
    for (const inputPath of target.sourcePaths) {
      const sourcePath = path.posix.normalize(inputPath)
      const prior = compiledBy.get(sourcePath)
      if (prior)
        findings.push({
          code: "duplicate-native-translation-unit",
          sourcePath,
          message: `${sourcePath} is compiled by both ${prior} and ${target.name}`,
        })
      else compiledBy.set(sourcePath, target.name)
    }
  return findings
}

export type TNativeOwnershipPlan = {
  units: { id: TNativeOwnershipUnit; files: string[]; requires: TNativeOwnershipUnit[] }[]
  selectedUnits: TNativeOwnershipUnit[]
  retainedFiles: string[]
  excludedFiles: string[]
  registrationClaims: TNativeRegistrationClaim[]
  crossUnitDependencies: (TNativeDependency & { fromUnit: TNativeOwnershipUnit; toUnit: TNativeOwnershipUnit })[]
  tableBoundaries: {
    sourcePath: string
    contentHash: string
    role: "shared-abi" | "feature-implementation"
    symbols: readonly string[]
  }[]
  findings: TSourceFinding[]
  status: "blocked" | "source-complete"
  selectiveInstallValidated: false
}

/** An ownership/extraction design for current bytes. It deliberately refuses unsafe Table pruning. */
export const inspectTableNativeOwnership = async (
  reader: TSourceReader,
  adapter: TNativeAdapter,
  includeTable: boolean,
): Promise<TNativeOwnershipPlan> => {
  const findings = [...adapter.findings]
  const report = (code: string, sourcePath: string, message: string) => findings.push({ code, sourcePath, message })
  const tableFiles = new Set<string>(TABLE_NATIVE_FILES)
  const owner = (sourcePath: string): TNativeOwnershipUnit => (tableFiles.has(sourcePath) ? "table" : "shared")
  for (const sourcePath of tableFiles) {
    if (!adapter.files.includes(sourcePath))
      report("native-ownership-profile", sourcePath, "Expected Table-owned input is absent")
  }
  for (const sourcePath of adapter.files) {
    if (
      (sourcePath.startsWith("cpp/table/") || /\/CUITable[^/]*\.(?:h|mm|java)$/.test(sourcePath)) &&
      !tableFiles.has(sourcePath)
    )
      report("native-ownership-profile", sourcePath, "New Table input requires an explicit ownership decision")
  }
  const tableBoundaries: TNativeOwnershipPlan["tableBoundaries"] = []
  const compositionMarkers = [
    ["ios/CUINativeFeatures.mm", "return CUICreateTableFeature(std::move(valid), std::move(mutex));"],
    [
      "android/src/main/java/com/codonui/input/CUINativeFeatures.java",
      "return new CUITableNativeSession(context, valid, lock);",
    ],
    ["android/src/main/jni/NativeFeaturesJNI.cpp", "registerTableStickyNatives();"],
  ] as const
  for (const [sourcePath, marker] of compositionMarkers) {
    try {
      const text = stripSourceComments((await reader.read(sourcePath)).toString("utf8"))
      if (text.split(marker).length !== 2)
        report("native-ownership-profile", sourcePath, `Full-package feature composition changed: ${marker}`)
    } catch (error) {
      report("native-ownership-profile", sourcePath, String(error))
    }
  }
  for (const source of TABLE_BOUNDARIES) {
    try {
      const content = await reader.read(source.sourcePath)
      const text = stripSourceComments(content.toString("utf8"))
      for (const marker of source.markers)
        if (!text.includes(marker))
          report("native-ownership-profile", source.sourcePath, `Extracted Table boundary changed: ${marker}`)
      tableBoundaries.push({
        sourcePath: source.sourcePath,
        contentHash: hashSource(content),
        role: source.role,
        symbols: source.markers,
      })
    } catch (error) {
      report("native-ownership-profile", source.sourcePath, String(error))
    }
  }
  const registrationClaims: TNativeRegistrationClaim[] = []
  const claim = (scope: string, identity: string, sourcePath: string) =>
    registrationClaims.push({ scope, identity, sourcePath, unit: owner(sourcePath) })
  for (const binding of adapter.bindings) {
    claim("codegen-binding", binding.name, binding.sourcePath)
    claim("ios-provider", binding.name, binding.iosSourcePath ?? "package.json")
    claim(
      "android-provider",
      binding.name,
      binding.androidSourcePath ?? "android/src/main/java/com/codonui/input/CodonInputPackage.java",
    )
    if (binding.androidDescriptor) claim("android-descriptor", binding.androidDescriptor, "react-native.config.js")
  }
  claim(
    "android-package",
    "com.codonui.input.CodonInputPackage",
    "android/src/main/java/com/codonui/input/CodonInputPackage.java",
  )
  claim("ios-pod", "CodonNativeInput", "CodonNativeInput.podspec")
  claim("cmake-target", "codon_motion", "android/src/main/jni/CMakeLists.txt")
  claim("cmake-target", "react_codegen_CodonNativeOverlay", "android/src/main/jni/overlay/CMakeLists.txt")
  claim("jni-entry", "codon_motion:JNI_OnLoad", "android/src/main/jni/MotionSnapshotJNI.cpp")
  claim("prefab-package", adapter.prefabPackage, "android/build.gradle")
  findings.push(...validateNativeRegistrationClaims(registrationClaims))
  const crossUnitDependencies = adapter.dependencies
    .filter((edge) => owner(edge.from) !== owner(edge.to))
    .map((edge) => ({ ...edge, fromUnit: owner(edge.from), toUnit: owner(edge.to) }))
  const selectedUnits: TNativeOwnershipUnit[] = includeTable ? ["shared", "table"] : ["shared"]
  const retainedFiles = adapter.files.filter((sourcePath) => selectedUnits.includes(owner(sourcePath)))
  const excludedFiles = adapter.files.filter((sourcePath) => !selectedUnits.includes(owner(sourcePath)))
  if (!includeTable) {
    for (const edge of crossUnitDependencies.filter((item) => item.fromUnit === "shared" && item.toUnit === "table")) {
      report(
        edge.kind === "native-build" ? "native-build-selection-required" : "native-retained-reference",
        edge.from,
        `${edge.kind} still requires excluded Table input ${edge.to}`,
      )
    }
  }
  return {
    units: NATIVE_OWNERSHIP_UNITS.map((id) => ({
      id,
      files: adapter.files.filter((sourcePath) => owner(sourcePath) === id),
      requires: [
        ...new Set(
          crossUnitDependencies
            .filter(
              (edge) =>
                edge.fromUnit === id &&
                edge.kind !== "native-build" &&
                edge.kind !== "native-registration" &&
                !(TABLE_COMPOSITION_FILES as readonly string[]).includes(edge.from),
            )
            .map((edge) => edge.toUnit),
        ),
      ].sort(),
    })),
    selectedUnits,
    retainedFiles,
    excludedFiles,
    registrationClaims,
    crossUnitDependencies,
    tableBoundaries,
    findings,
    status: findings.length ? "blocked" : "source-complete",
    selectiveInstallValidated: false,
  }
}
