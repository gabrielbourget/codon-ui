import path from "node:path"

import { z } from "zod"

import { DATE_SEGMENT_CANDIDATE_FILES } from "./dateSegmentOwnership"
import { inspectNativeAdapter } from "./nativeAdapter"
import { inspectTableNativeOwnership, TABLE_NATIVE_FILES } from "./ownership"
import { createSourceReader, hashSource, stripSourceComments, type TSourceReader } from "./sourceFiles"
import { projectNativeTableSources } from "./tableProjection"

export const compareNativeKeys = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)
export const nativeHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const nativePathSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_./+-]+$/)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      value
        .split("/")
        .every(
          (part) =>
            part !== "" &&
            part !== "." &&
            part !== ".." &&
            !part.endsWith(".") &&
            !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
        ),
    "Expected a portable package-relative file path",
  )
const ownerSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value && !value.includes("\0"))
const unitSchema = z.enum(["shared", "table"])
export const nativeIdentityScopeSchema = z.enum([
  "native-package",
  "codegen-library",
  "codegen-binding",
  "ios-provider",
  "android-provider",
  "android-descriptor",
  "android-package",
  "ios-pod",
  "cmake-target",
  "jni-entry",
  "prefab-package",
  "android-class",
  "objc-runtime-class",
])
const requestSchema = z.object({ component: ownerSchema, features: z.array(z.literal("table")).default([]) }).strict()
const unitDefinitionSchema = z
  .object({ id: unitSchema, requires: z.array(unitSchema), owners: z.array(ownerSchema).min(1) })
  .strict()
const fileSchema = z
  .object({
    path: nativePathSchema,
    unit: unitSchema,
    owners: z.array(ownerSchema).min(1),
    sourceHash: nativeHashSchema,
    contentHash: nativeHashSchema,
  })
  .strict()
const identitySchema = z
  .object({
    scope: nativeIdentityScopeSchema,
    identity: z.string().min(1),
    unit: unitSchema,
    sourcePath: nativePathSchema,
  })
  .strict()
const manifestBodySchema = z
  .object({
    schemaVersion: z.literal(1),
    sourcePackage: z.literal("@codon-ui/react-native"),
    sourceInputHash: nativeHashSchema.nullable(),
    requests: z.array(requestSchema),
    baselineFeatures: z.array(z.literal("date-segment")),
    units: z.array(unitDefinitionSchema),
    files: z.array(fileSchema),
    identities: z.array(identitySchema),
    selectiveInstallValidated: z.literal(false),
  })
  .strict()
const manifestSchema = manifestBodySchema.extend({ manifestId: nativeHashSchema }).strict()
export type TNativeSelectionRequest = z.input<typeof requestSchema>
export type TNativeSelectionManifest = z.infer<typeof manifestSchema>
export type TNativeManifestIdentity = z.infer<typeof identitySchema>

export const canonicalNativeJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalNativeJson).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => compareNativeKeys(a, b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalNativeJson(item)}`)
      .join(",")}}`
  const result = JSON.stringify(value)
  if (result === undefined) throw new Error("Native data must be JSON-serializable")
  return result
}
export const nativeDataHash = (value: unknown) => hashSource(Buffer.from(canonicalNativeJson(value)))
const same = (left: unknown, right: unknown) => canonicalNativeJson(left) === canonicalNativeJson(right)
const unique = (values: readonly string[], label: string) => {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate native ${label}`)
}

export const validateNativeFilePaths = (paths: readonly string[]) => {
  paths.forEach((value) => nativePathSchema.parse(value))
  unique(paths, "file path")
  unique(
    paths.map((value) => value.toLowerCase()),
    "case-folded file path",
  )
  const entries = new Set(paths.map((value) => value.toLowerCase()))
  const casing = new Map<string, string>()
  for (const file of entries) {
    const parts = file.split("/")
    for (let count = 1; count < parts.length; count++)
      if (entries.has(parts.slice(0, count).join("/"))) throw new Error(`Native file/directory collision: ${file}`)
  }
  for (const file of paths) {
    const parts = file.split("/")
    for (let count = 1; count <= parts.length; count++) {
      const prefix = parts.slice(0, count).join("/")
      const observed = casing.get(prefix.toLowerCase())
      if (observed && observed !== prefix) throw new Error(`Native path casing collision: ${prefix}`)
      casing.set(prefix.toLowerCase(), prefix)
    }
  }
}

/** Validated content addressing, not a signature or install permission. This schema is internal. */
export const defineNativeSelectionManifest = (input: unknown): TNativeSelectionManifest => {
  const body = manifestBodySchema.parse(input)
  unique(
    body.requests.map((item) => item.component),
    "component request",
  )
  body.requests.forEach((item) => unique(item.features, "feature request"))
  body.requests = body.requests
    .map((item) => ({ ...item, features: [...item.features].sort(compareNativeKeys) }))
    .sort((a, b) => compareNativeKeys(a.component, b.component))
  body.units = body.units
    .map((unit) => ({
      ...unit,
      requires: [...unit.requires].sort(compareNativeKeys),
      owners: [...unit.owners].sort(compareNativeKeys),
    }))
    .sort((a, b) => compareNativeKeys(a.id, b.id))
  body.files = body.files
    .map((file) => ({ ...file, owners: [...file.owners].sort(compareNativeKeys) }))
    .sort((a, b) => compareNativeKeys(a.path, b.path))
  body.identities = [...body.identities].sort((a, b) =>
    compareNativeKeys(canonicalNativeJson(a), canonicalNativeJson(b)),
  )
  unique(
    body.units.map((item) => item.id),
    "unit",
  )
  validateNativeFilePaths(body.files.map((item) => item.path))
  unique(
    body.identities.map((item) => canonicalNativeJson([item.scope, item.identity])),
    "identity",
  )
  const owners = body.requests.map((item) => item.component)
  const tableOwners = body.requests.filter((item) => item.features.includes("table")).map((item) => item.component)
  const expectedUnits = [
    ...(owners.length ? [{ id: "shared", requires: [], owners }] : []),
    ...(tableOwners.length ? [{ id: "table", requires: ["shared"], owners: tableOwners }] : []),
  ]
  if (!same(body.units, expectedUnits)) throw new Error("Native units/owners do not match request dependency closure")
  if (!same(body.baselineFeatures, owners.length ? ["date-segment"] : []))
    throw new Error("Date segment must remain in the shared baseline")
  if (Boolean(body.sourceInputHash) !== Boolean(owners.length))
    throw new Error("Native source identity does not match selection")
  if (!owners.length && (body.files.length || body.identities.length))
    throw new Error("Empty native selection must have no artifacts or identities")
  for (const file of body.files) {
    const unit = body.units.find((item) => item.id === file.unit)
    if (!unit || !same(file.owners, unit.owners)) throw new Error(`Native file owner mismatch: ${file.path}`)
    if (((TABLE_NATIVE_FILES as readonly string[]).includes(file.path) ? "table" : "shared") !== file.unit)
      throw new Error(`Native file unit mismatch: ${file.path}`)
  }
  if (tableOwners.length)
    for (const sourcePath of TABLE_NATIVE_FILES)
      if (!body.files.some((file) => file.path === sourcePath && file.unit === "table"))
        throw new Error(`Missing Table input: ${sourcePath}`)
  if (owners.length)
    for (const sourcePath of DATE_SEGMENT_CANDIDATE_FILES) {
      if (!body.files.some((file) => file.path === sourcePath && file.unit === "shared"))
        throw new Error(`Missing shared date input: ${sourcePath}`)
    }
  for (const identity of body.identities)
    if (!body.files.some((file) => file.path === identity.sourcePath && file.unit === identity.unit))
      throw new Error(`Native identity has no owning file: ${identity.identity}`)
  return { ...body, manifestId: nativeDataHash(body) }
}

export const parseNativeSelectionManifest = (input: unknown) => {
  const { manifestId, ...body } = manifestSchema.parse(input)
  const normalized = defineNativeSelectionManifest(body)
  if (normalized.manifestId !== manifestId) throw new Error("Native manifest content ID mismatch")
  return normalized
}
export const serializeNativeSelectionManifest = (input: TNativeSelectionManifest) =>
  `${canonicalNativeJson(parseNativeSelectionManifest(input))}\n`

export const validateNativeSelectionPayloads = (
  input: TNativeSelectionManifest,
  payloads: readonly { path: string; content: Uint8Array }[],
) => {
  const manifest = parseNativeSelectionManifest(input)
  validateNativeFilePaths(payloads.map((payload) => payload.path))
  const selected = new Map(manifest.files.map((file) => [file.path, file.contentHash]))
  if (selected.size !== payloads.length) throw new Error("Native payload set does not match manifest")
  for (const payload of payloads)
    if (selected.get(payload.path) !== hashSource(payload.content))
      throw new Error(`Native payload hash mismatch: ${payload.path}`)
}

/** Supported source-profile identities, not a replacement for compiler/linker symbol validation. */
export const inspectNativeRuntimeIdentities = (
  payloads: readonly { path: string; content: Uint8Array }[],
): TNativeManifestIdentity[] => {
  const identities: TNativeManifestIdentity[] = []
  for (const payload of payloads) {
    const source = stripSourceComments(Buffer.from(payload.content).toString("utf8")).replace(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      (literal) => literal.replace(/[^\n]/g, " "),
    )
    const unit = (TABLE_NATIVE_FILES as readonly string[]).includes(payload.path) ? "table" : "shared"
    if (payload.path.endsWith(".java")) {
      const namespace = source.match(/\bpackage\s+([\w.]+)\s*;/)?.[1]
      const names: string[] = []
      let depth = 0
      for (const match of source.matchAll(/[{}]|\b(?:class|interface|enum|record)\s+(\w+)\b/g)) {
        if (match[0] === "{") depth++
        else if (match[0] === "}") depth--
        else if (depth === 0) names.push(match[1])
        if (depth < 0) throw new Error(`Unsupported Java identity source: ${payload.path}`)
      }
      if (!namespace || depth || !names.includes(path.posix.basename(payload.path, ".java")))
        throw new Error(`Unsupported Java identity source: ${payload.path}`)
      for (const name of names)
        identities.push({ scope: "android-class", identity: `${namespace}.${name}`, unit, sourcePath: payload.path })
    }
    if (/\.mm?$/.test(payload.path))
      for (const match of source.matchAll(/@implementation\s+(\w+)(\s*\([^)]*\))?/g)) {
        if (match[2]) throw new Error(`Objective-C categories require an explicit identity profile: ${payload.path}`)
        identities.push({ scope: "objc-runtime-class", identity: match[1], unit, sourcePath: payload.path })
      }
    if (payload.path.endsWith(".swift"))
      for (const match of source.matchAll(
        /@objc\((\w+)\)\s*(?:(?:public|private|internal|final|open)\s+)*class\s+\w+/g,
      ))
        identities.push({ scope: "objc-runtime-class", identity: match[1], unit, sourcePath: payload.path })
  }
  return identities
}

/** Explicit native clients only; routing and component-feature inference remain with the caller. */
export const buildNativeSelection = async ({
  sourceRoot,
  requests,
}: {
  sourceRoot: string
  requests: readonly TNativeSelectionRequest[]
}) => {
  const requested = new Map<string, Set<"table">>()
  for (const request of requests) {
    const parsed = requestSchema.parse(request)
    const features = requested.get(parsed.component) ?? new Set<"table">()
    parsed.features.forEach((feature) => features.add(feature))
    requested.set(parsed.component, features)
  }
  const normalizedRequests = [...requested]
    .map(([component, features]) => ({ component, features: [...features] }))
    .sort((a, b) => compareNativeKeys(a.component, b.component))
  const owners = normalizedRequests.map((item) => item.component)
  const tableOwners = normalizedRequests.filter((item) => item.features.includes("table")).map((item) => item.component)
  if (!owners.length)
    return {
      manifest: defineNativeSelectionManifest({
        schemaVersion: 1,
        sourcePackage: "@codon-ui/react-native",
        sourceInputHash: null,
        requests: [],
        baselineFeatures: [],
        units: [],
        files: [],
        identities: [],
        selectiveInstallValidated: false,
      }),
      payloads: [] as { path: string; content: Buffer }[],
    }
  const disk = await createSourceReader(sourceRoot)
  const packageJson = JSON.parse((await disk.read("package.json")).toString("utf8"))
  const discovered = await inspectNativeAdapter(disk, packageJson.name, packageJson.codegenConfig)
  if (discovered.findings.length)
    throw new Error(`Invalid native source profile: ${canonicalNativeJson(discovered.findings)}`)
  const bytes = new Map(await Promise.all(discovered.files.map(async (file) => [file, await disk.read(file)] as const)))
  const reader: TSourceReader = {
    read: async (file) => {
      const content = bytes.get(file)
      if (!content) throw new Error(`Native input not captured: ${file}`)
      return content
    },
    list: async (directory) =>
      [...bytes.keys()].filter((file) => file.startsWith(`${directory}/`)).sort(compareNativeKeys),
    isFile: async (file) => bytes.has(file),
    references: async () => [],
  }
  const capturedPackage = JSON.parse((await reader.read("package.json")).toString("utf8"))
  const adapter = await inspectNativeAdapter(reader, capturedPackage.name, capturedPackage.codegenConfig)
  const ownership = await inspectTableNativeOwnership(reader, adapter, tableOwners.length > 0)
  const projection = await projectNativeTableSources(reader, adapter, tableOwners.length > 0)
  const replacements = new Map(projection.replacements.map((item) => [item.sourcePath, item]))
  const isTable = (file: string) => (TABLE_NATIVE_FILES as readonly string[]).includes(file)
  const payloads = projection.retainedFiles.sort(compareNativeKeys).map((file) => ({
    path: file,
    content: replacements.has(file) ? Buffer.from(replacements.get(file)!.content) : Buffer.from(bytes.get(file)!),
  }))
  const files = payloads.map((payload) => ({
    path: payload.path,
    unit: isTable(payload.path) ? ("table" as const) : ("shared" as const),
    owners: isTable(payload.path) ? tableOwners : owners,
    sourceHash: hashSource(bytes.get(payload.path)!),
    contentHash: hashSource(payload.content),
  }))
  const identities: TNativeManifestIdentity[] = ownership.registrationClaims.map((claim) => ({
    ...claim,
    scope: nativeIdentityScopeSchema.parse(claim.scope),
  }))
  identities.push(
    { scope: "native-package", identity: capturedPackage.name, unit: "shared", sourcePath: "package.json" },
    { scope: "codegen-library", identity: adapter.identity, unit: "shared", sourcePath: "package.json" },
  )
  identities.push(...inspectNativeRuntimeIdentities(payloads))
  return {
    manifest: defineNativeSelectionManifest({
      schemaVersion: 1,
      sourcePackage: capturedPackage.name,
      sourceInputHash: nativeDataHash(
        [...bytes].map(([file, content]) => [file, hashSource(content)]).sort(([a], [b]) => compareNativeKeys(a, b)),
      ),
      requests: normalizedRequests,
      baselineFeatures: ["date-segment"],
      units: [
        { id: "shared", requires: [], owners },
        ...(tableOwners.length ? [{ id: "table", requires: ["shared"], owners: tableOwners }] : []),
      ],
      files,
      identities,
      selectiveInstallValidated: false,
    }),
    payloads,
  }
}
