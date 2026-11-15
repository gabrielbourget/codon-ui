import { lstat, readFile, readdir } from "node:fs/promises"
import path from "node:path"

import { z } from "zod"

import {
  canonicalNativeJson,
  compareNativeKeys,
  nativeDataHash,
  nativeHashSchema,
  nativeIdentityScopeSchema,
  nativePathSchema,
  parseNativeSelectionManifest,
  type TNativeSelectionManifest,
} from "./selectionManifest"
import { hashSource } from "./sourceFiles"

const rootSchema = z
  .string()
  .refine((value) => path.isAbsolute(value) && path.resolve(value) === value && value !== path.parse(value).root)
const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    root: rootSchema,
    manifest: z.unknown(),
    managedPaths: z.array(nativePathSchema),
    stateId: nativeHashSchema,
  })
  .strict()
export type TNativeSelectionState = Omit<z.infer<typeof stateSchema>, "manifest"> & {
  manifest: TNativeSelectionManifest
}

export const defineNativeSelectionState = (
  root: string,
  manifest: TNativeSelectionManifest,
  managedPaths = manifest.files.map((file) => file.path),
): TNativeSelectionState => {
  rootSchema.parse(root)
  const selected = parseNativeSelectionManifest(manifest)
  const paths = [...managedPaths].sort(compareNativeKeys)
  if (
    new Set(paths).size !== paths.length ||
    paths.some((file) => !selected.files.some((input) => input.path === file))
  )
    throw new Error("Invalid managed native paths")
  const body = { schemaVersion: 1 as const, root, manifest: selected, managedPaths: paths }
  return { ...body, stateId: nativeDataHash(body) }
}

export const parseNativeSelectionState = (input: unknown): TNativeSelectionState => {
  const parsed = stateSchema.parse(input)
  const normalized = defineNativeSelectionState(
    parsed.root,
    parseNativeSelectionManifest(parsed.manifest),
    parsed.managedPaths,
  )
  if (normalized.stateId !== parsed.stateId) throw new Error("Native state content ID mismatch")
  return normalized
}

// Only known generated trees are excluded. Unknown source/configuration inputs must stay visible.
export const NATIVE_SNAPSHOT_IGNORED_TREES = [
  ".git",
  "node_modules",
  "build",
  "dist",
  "android/.gradle",
  "android/.cxx",
  "android/build",
  "ios/Pods",
] as const
const ignored = (file: string) =>
  NATIVE_SNAPSHOT_IGNORED_TREES.some((directory) => file === directory || file.startsWith(`${directory}/`))
const entrySchema = z.discriminatedUnion("kind", [
  z.object({ path: nativePathSchema, kind: z.literal("file"), contentHash: nativeHashSchema }).strict(),
  z.object({ path: nativePathSchema, kind: z.enum(["directory", "symlink", "other"]) }).strict(),
])
const snapshotBodySchema = z
  .object({
    schemaVersion: z.literal(1),
    root: rootSchema,
    rootKind: z.enum(["missing", "directory", "symlink", "other"]),
    entries: z.array(entrySchema),
  })
  .strict()
const snapshotSchema = snapshotBodySchema.extend({ snapshotId: nativeHashSchema }).strict()
export type TNativeConsumerSnapshot = z.infer<typeof snapshotSchema>

export const defineNativeConsumerSnapshot = (input: z.input<typeof snapshotBodySchema>): TNativeConsumerSnapshot => {
  const body = snapshotBodySchema.parse(input)
  body.entries.sort((a, b) => compareNativeKeys(a.path, b.path))
  const entries = new Map(body.entries.map((entry) => [entry.path.toLowerCase(), entry]))
  if (entries.size !== body.entries.length) throw new Error("Duplicate or case-colliding native snapshot paths")
  if (body.rootKind !== "directory" && body.entries.length) throw new Error("Non-directory native root has entries")
  for (const entry of body.entries) {
    if (ignored(entry.path)) throw new Error(`Generated native path cannot enter snapshot: ${entry.path}`)
    const segments = entry.path.split("/")
    for (let count = 1; count < segments.length; count++) {
      const parent = entries.get(segments.slice(0, count).join("/").toLowerCase())
      if (!parent || parent.kind !== "directory" || parent.path !== segments.slice(0, count).join("/"))
        throw new Error(`Invalid native snapshot parent: ${entry.path}`)
    }
  }
  return { ...body, snapshotId: nativeDataHash(body) }
}

export const parseNativeConsumerSnapshot = (input: unknown): TNativeConsumerSnapshot => {
  const { snapshotId, ...body } = snapshotSchema.parse(input)
  const normalized = defineNativeConsumerSnapshot(body)
  if (normalized.snapshotId !== snapshotId) throw new Error("Native snapshot content ID mismatch")
  return normalized
}

/** Observes a quiescent tree without traversing observed symlinks. Not a filesystem transaction. */
export const captureNativeConsumerSnapshot = async (root: string): Promise<TNativeConsumerSnapshot> => {
  rootSchema.parse(root)
  const parts = root.slice(path.parse(root).root.length).split(path.sep).filter(Boolean)
  let ancestor = path.parse(root).root
  for (const part of parts) {
    ancestor = path.join(ancestor, part)
    try {
      const info = await lstat(ancestor)
      if (info.isSymbolicLink())
        return defineNativeConsumerSnapshot({ schemaVersion: 1, root, rootKind: "symlink", entries: [] })
      if (!info.isDirectory())
        return defineNativeConsumerSnapshot({ schemaVersion: 1, root, rootKind: "other", entries: [] })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      return defineNativeConsumerSnapshot({ schemaVersion: 1, root, rootKind: "missing", entries: [] })
    }
  }
  const entries: TNativeConsumerSnapshot["entries"] = []
  const walk = async (directory: string) => {
    for (const name of (await readdir(path.join(root, directory))).sort(compareNativeKeys)) {
      const relative = directory ? `${directory}/${name}` : name
      if (ignored(relative)) continue
      nativePathSchema.parse(relative)
      const absolute = path.join(root, relative)
      const info = await lstat(absolute)
      if (info.isSymbolicLink()) entries.push({ path: relative, kind: "symlink" })
      else if (info.isDirectory()) {
        entries.push({ path: relative, kind: "directory" })
        await walk(relative)
      } else if (info.isFile())
        entries.push({ path: relative, kind: "file", contentHash: hashSource(await readFile(absolute)) })
      else entries.push({ path: relative, kind: "other" })
    }
  }
  await walk("")
  return defineNativeConsumerSnapshot({ schemaVersion: 1, root, rootKind: "directory", entries })
}

const externalIdentitySchema = z
  .object({ scope: nativeIdentityScopeSchema, identity: z.string().min(1), owner: z.string().min(1) })
  .strict()
export type TExternalNativeIdentity = z.infer<typeof externalIdentitySchema>
type TNativeOperation = {
  path: string
  action: "create" | "replace" | "delete"
  beforeHash: string | null
  afterHash: string | null
}
type TNativeConflict = { code: string; path?: string; message: string }
type TNativeDecision = { path: string; action: string }
export type TNativeSelectionPlan = {
  schemaVersion: 1
  status: "ready" | "blocked"
  root: string
  desiredManifestId: string
  previousStateId: string | null
  snapshotId: string
  externalIdentityHash: string
  operations: TNativeOperation[]
  decisions: TNativeDecision[]
  conflicts: TNativeConflict[]
  nextState: TNativeSelectionState | null
  effects: { writesFiles: false; writesState: false }
  planId: string
}
type TNativePlanInput = {
  desired: TNativeSelectionManifest
  previous: TNativeSelectionState | null
  snapshot: TNativeConsumerSnapshot
  externalIdentities?: readonly TExternalNativeIdentity[]
}
const inertInput = (file: string) =>
  /(?:^|\/)(?:LICENSE(?:\.[\w-]+)?|NOTICE(?:\.[\w-]+)?|UPSTREAM(?:\.[\w-]+)?|\.DS_Store)$/i.test(file) ||
  /\.(?:md|txt)$/i.test(file)

/** Proposes operations only. Existing CLI ownership/lock semantics and all writers remain separate. */
export const planNativeSelection = (input: TNativePlanInput): TNativeSelectionPlan => {
  const desired = parseNativeSelectionManifest(input.desired)
  const previous = input.previous ? parseNativeSelectionState(input.previous) : null
  const snapshot = parseNativeConsumerSnapshot(input.snapshot)
  const external = (input.externalIdentities ?? [])
    .map((claim) => externalIdentitySchema.parse(claim))
    .sort((a, b) => compareNativeKeys(canonicalNativeJson(a), canonicalNativeJson(b)))
  const conflicts: TNativeConflict[] = []
  const operations: TNativeOperation[] = []
  const decisions: TNativeDecision[] = []
  const conflict = (code: string, message: string, file?: string) =>
    conflicts.push({ code, ...(file ? { path: file } : {}), message })
  if (previous && previous.root !== snapshot.root)
    conflict("root-mismatch", "Native state belongs to another consumer root")
  if (!["directory", "missing"].includes(snapshot.rootKind))
    conflict("unsafe-root", `Native root is ${snapshot.rootKind}`)
  for (const claim of desired.identities)
    for (const other of external)
      if (claim.scope === other.scope && claim.identity === other.identity)
        conflict(
          "duplicate-identity",
          `${claim.scope}:${claim.identity} is already owned by ${other.owner}`,
          claim.sourcePath,
        )
  const before = new Map(previous?.manifest.files.map((file) => [file.path, file]))
  const after = new Map(desired.files.map((file) => [file.path, file]))
  const managed = new Set(previous?.managedPaths ?? [])
  const entries = new Map(snapshot.entries.map((entry) => [entry.path, entry]))
  const foldedEntries = new Map(snapshot.entries.map((entry) => [entry.path.toLowerCase(), entry]))
  const selectedPaths = [...new Set([...before.keys(), ...after.keys()])].sort(compareNativeKeys)
  // A later integrator must assess/adopt unknown inputs explicitly before touching this build domain.
  if (selectedPaths.length)
    for (const entry of snapshot.entries)
      if (entry.kind !== "directory" && !before.has(entry.path) && !after.has(entry.path) && !inertInput(entry.path))
        conflict(
          "untracked-native-input",
          "Unknown native source/configuration may participate in build globs or registration",
          entry.path,
        )
  for (const file of selectedPaths) {
    if (ignored(file)) throw new Error(`Selected native input overlaps ignored generated tree: ${file}`)
    const parts = file.split("/")
    let unsafe = false
    for (let count = 1; count <= parts.length; count++) {
      const prefix = parts.slice(0, count).join("/")
      const entry = foldedEntries.get(prefix.toLowerCase())
      if (
        entry &&
        (entry.path !== prefix || (count < parts.length ? entry.kind !== "directory" : entry.kind !== "file"))
      ) {
        conflict("unsafe-path", `Native input collides with ${entry.kind} or path casing: ${entry.path}`, file)
        unsafe = true
        break
      }
    }
    if (unsafe) continue
    const old = before.get(file)
    const next = after.get(file)
    const observed = entries.get(file)
    const currentHash = observed?.kind === "file" ? observed.contentHash : null
    const decide = (action: string) => decisions.push({ path: file, action })
    const change = (action: TNativeOperation["action"], afterHash: string | null) => {
      operations.push({ path: file, action, beforeHash: currentHash, afterHash })
      decide(action)
    }
    if (!old) {
      if (currentHash !== null)
        conflict(
          "untracked-target",
          "Existing input has no recorded native ownership; matching bytes do not grant ownership",
          file,
        )
      else change("create", next!.contentHash)
    } else if (!managed.has(file)) {
      if (next && next.contentHash !== old.contentHash)
        conflict("released-input-update", "Incoming change requires an input whose ownership was released", file)
      else if (!next && currentHash !== null && !inertInput(file))
        conflict(
          "released-input-retained",
          "Retiring native dependencies would leave released source/configuration in this build domain",
          file,
        )
      else decide("preserve-released")
    } else if (!next) {
      if (currentHash === null) decide("release-missing")
      else if (currentHash === old.contentHash) change("delete", null)
      else conflict("edited-input-removal", "Removal would delete a consumer-edited native input", file)
    } else if (old.contentHash === next.contentHash)
      decide(
        currentHash === old.contentHash ? "unchanged" : currentHash === null ? "preserve-missing" : "preserve-edited",
      )
    else if (currentHash === next.contentHash) decide("already-current")
    else if (currentHash === old.contentHash) change("replace", next.contentHash)
    else conflict("edited-input-update", "Incoming change would overwrite a consumer edit or deletion", file)
  }
  const body = {
    schemaVersion: 1 as const,
    status: conflicts.length ? ("blocked" as const) : ("ready" as const),
    root: snapshot.root,
    desiredManifestId: desired.manifestId,
    previousStateId: previous?.stateId ?? null,
    snapshotId: snapshot.snapshotId,
    externalIdentityHash: nativeDataHash(external),
    operations: conflicts.length ? [] : operations,
    decisions,
    conflicts: conflicts.sort((a, b) => compareNativeKeys(canonicalNativeJson(a), canonicalNativeJson(b))),
    nextState: conflicts.length
      ? null
      : defineNativeSelectionState(
          snapshot.root,
          desired,
          desired.files.filter((file) => !before.has(file.path) || managed.has(file.path)).map((file) => file.path),
        ),
    effects: { writesFiles: false as const, writesState: false as const },
  }
  return { ...body, planId: nativeDataHash(body) }
}

/** Recompute against a fresh observation before a future writer applies anything. TOCTOU remains its responsibility. */
export const validateNativeSelectionPlan = (plan: TNativeSelectionPlan, current: TNativePlanInput) => {
  const { planId, ...body } = plan
  if (nativeDataHash(body) !== planId) throw new Error("Native plan content ID mismatch")
  const fresh = planNativeSelection(current)
  if (fresh.planId !== planId) throw new Error("Stale native selection plan")
  if (fresh.status !== "ready") throw new Error("Native selection plan is blocked")
  return fresh
}
