import type { TNativeSourceGraph } from "./graph"
import type { TNativeAdapter, TNativeDependency } from "./nativeAdapter"
import { hashSource, stripSourceComments, type TSourceFinding, type TSourceReader } from "./sourceFiles"

export const DATE_SEGMENT_SPEC = "src/input/specs/CUIDateSegmentNativeComponent.ts"
export const DATE_SEGMENT_CANDIDATE_FILES = [
  DATE_SEGMENT_SPEC,
  "cpp/input/DateSegmentKeyPolicy.h",
  "ios/CUIDateSegment.h",
  "ios/CUIDateSegment.mm",
  "ios/CUIOwnedDateField.h",
  "ios/CUIOwnedDateField.mm",
  "ios/CUIFieldCustomContent.h",
  "ios/CUIFieldCustomContent.mm",
  "android/src/main/java/com/codonui/input/CUIDateSegment.java",
  "android/src/main/java/com/codonui/input/CUIDateSegmentManager.java",
  "android/src/main/java/com/codonui/input/CUIDateSegmentKeyPolicy.java",
  "android/src/main/java/com/codonui/input/CUIOwnedDateField.java",
] as const

export type TDateSegmentOwnership = {
  identity: "CUIDateSegment"
  runtimeOwners: string[]
  typeOnlyImporters: string[]
  candidateFiles: { sourcePath: string; contentHash: string }[]
  references: TNativeDependency[]
  sharedReferences: TNativeDependency[]
  registrations: { scope: string; identity: string; sourcePath: string }[]
  prefabHeaders: string[]
  findings: TSourceFinding[]
  status: "shared-required" | "invalid-source"
  projectionAvailable: false
  selectiveInstallValidated: false
}

/** Dates share one native editor. Its concrete shared-input dependencies currently prohibit pruning. */
export const inspectDateSegmentOwnership = async (
  reader: TSourceReader,
  adapter: TNativeAdapter,
  graph?: TNativeSourceGraph,
): Promise<TDateSegmentOwnership> => {
  const findings = [...adapter.findings, ...(graph?.findings ?? [])]
  const candidates = new Set<string>(DATE_SEGMENT_CANDIDATE_FILES)
  const candidateFiles: TDateSegmentOwnership["candidateFiles"] = []
  const report = (sourcePath: string, message: string) =>
    findings.push({ code: "date-segment-profile", sourcePath, message })
  for (const sourcePath of candidates) {
    try {
      if (!adapter.files.includes(sourcePath)) report(sourcePath, "Expected date-segment input is absent")
      candidateFiles.push({ sourcePath, contentHash: hashSource(await reader.read(sourcePath)) })
    } catch (error) {
      report(sourcePath, String(error))
    }
  }
  const bindings = adapter.bindings.filter((binding) => binding.name === "CUIDateSegment")
  if (bindings.length !== 1 || bindings[0]?.kind !== "component" || bindings[0]?.sourcePath !== DATE_SEGMENT_SPEC)
    report(DATE_SEGMENT_SPEC, "Expected one native date-segment component binding")
  const binding = bindings[0]
  const registrations = [
    { scope: "codegen-component", identity: "CUIDateSegment", sourcePath: DATE_SEGMENT_SPEC },
    { scope: "ios-provider", identity: "CUIDateSegment", sourcePath: binding?.iosSourcePath ?? "package.json" },
    {
      scope: "android-manager",
      identity: "CUIDateSegment",
      sourcePath: binding?.androidSourcePath ?? "react-native.config.js",
    },
    {
      scope: "android-descriptor",
      identity: binding?.androidDescriptor ?? "CUIDateSegmentComponentDescriptor",
      sourcePath: "react-native.config.js",
    },
  ]
  const sharedReferences = adapter.dependencies.filter(
    (edge) =>
      !candidates.has(edge.from) && candidates.has(edge.to) && ["native-include", "native-java"].includes(edge.kind),
  )
  const prefabHeaders: string[] = []
  try {
    const gradle = stripSourceComments((await reader.read("android/build.gradle")).toString("utf8"))
    if (gradle.includes('codon_motion { headers "../cpp/input" }'))
      prefabHeaders.push("cpp/input/DateSegmentKeyPolicy.h")
    else report("android/build.gradle", "Date key-policy prefab header exposure changed")
  } catch (error) {
    report("android/build.gradle", String(error))
  }
  return {
    identity: "CUIDateSegment",
    runtimeOwners: [
      ...(graph?.nativeRuntimeOwners.find((item) => item.sourcePath === DATE_SEGMENT_SPEC)?.owners ?? []),
    ],
    typeOnlyImporters: [
      ...new Set(
        graph?.edges.filter((edge) => edge.to === DATE_SEGMENT_SPEC && edge.kind === "type").map((edge) => edge.from) ??
          [],
      ),
    ].sort(),
    candidateFiles,
    references: adapter.dependencies.filter((edge) => candidates.has(edge.to) && edge.kind !== "native-build"),
    sharedReferences,
    registrations,
    prefabHeaders,
    findings,
    status: findings.length ? "invalid-source" : "shared-required",
    projectionAvailable: false,
    selectiveInstallValidated: false,
  }
}

export const validateDateSegmentOmission = (
  ownership: TDateSegmentOwnership,
  omittedFiles: readonly string[],
): TSourceFinding[] => {
  const omitted = new Set(omittedFiles)
  const findings = [...ownership.findings]
  for (const edge of ownership.references)
    if (omitted.has(edge.to) && !omitted.has(edge.from))
      findings.push({
        code: "date-retained-reference",
        sourcePath: edge.from,
        message: `${edge.kind} still requires ${edge.to}`,
      })
  if (omitted.has(DATE_SEGMENT_SPEC)) {
    if (ownership.runtimeOwners.length)
      findings.push({
        code: "date-runtime-required",
        sourcePath: DATE_SEGMENT_SPEC,
        message: `Runtime component consumers require the date segment: ${ownership.runtimeOwners.join(", ")}`,
      })
    for (const sourcePath of ownership.typeOnlyImporters.filter((item) => !omitted.has(item)))
      findings.push({
        code: "date-types-required",
        sourcePath,
        message: `Shared wire types still come from ${DATE_SEGMENT_SPEC}; codegen/source separation needs a decision`,
      })
  }
  for (const sourcePath of ownership.prefabHeaders.filter((item) => omitted.has(item)))
    findings.push({
      code: "date-prefab-abi",
      sourcePath,
      message:
        "The codon_motion prefab exports this header; removing it requires an explicit native header-contract decision",
    })
  return findings
}
