import {
  defineNativeConsumerSnapshot,
  parseNativeConsumerSnapshot,
  validateNativeSelectionPlan,
  type TExternalNativeIdentity,
  type TNativeConsumerSnapshot,
  type TNativeSelectionPlan,
  type TNativeSelectionState,
} from "./selectionLifecycle"
import {
  compareNativeKeys,
  nativeDataHash,
  nativePathSchema,
  parseNativeSelectionManifest,
  validateNativeSelectionPayloads,
  type TNativeSelectionManifest,
} from "./selectionManifest"
import { hashSource } from "./sourceFiles"

export type TNativeTransactionView = {
  snapshot: TNativeConsumerSnapshot
  rootToken: string
  entries: { path: string; token: string }[]
  viewId: string
}
export type TNativeTransactionImage = { kind: "file"; content: Uint8Array } | { kind: "directory" } | null
export type TNativeTransactionGuard = {
  root: string
  rootKind: TNativeConsumerSnapshot["rootKind"]
  rootToken: string
  entries: {
    path: string
    token: string
    kind: "file" | "directory" | "symlink" | "other" | null
    contentHash: string | null
  }[]
}
export type TNativeTransactionChange = {
  path: string | null
  after: TNativeTransactionImage
  guard: TNativeTransactionGuard
}
export type TNativeTransactionExchange =
  | { status: "applied"; view: TNativeTransactionView }
  | { status: "rejected" | "uncertain"; reason: string }

/** No filesystem implementation is supplied. These atomic guarantees are required, not inferred from Node path checks. */
export type TNativeTransactionStore = {
  // Include version evidence for requested absent paths too. Absence is a versioned state, not an unguarded null.
  observe: (paths: readonly string[]) => Promise<TNativeTransactionView>
  read: (input: { path: string; guard: TNativeTransactionGuard }) => Promise<Uint8Array>
  // Atomically compare the root, every ancestor and target token/kind/hash; never follow links or case aliases.
  // An absent target must be created exclusively; directory removal requires emptiness. Affect only this target.
  // Tokens must change on file writes/relinks/deletions (including same-byte and create/delete ABA edits) and never be reused. Directory tokens identify the directory, not its children.
  // "rejected" guarantees no effect. Any ambiguous outcome, including an exception, is treated as "uncertain".
  exchange: (input: TNativeTransactionChange) => Promise<TNativeTransactionExchange>
}
type TNativeTransactionContext = {
  previous: TNativeSelectionState | null
  externalIdentities?: readonly TExternalNativeIdentity[]
}
type TNativeRecovery = {
  path: string | null
  before: TNativeTransactionImage
  attemptedAfter: { kind: "file"; contentHash: string } | { kind: "directory" } | null
  guard: TNativeTransactionGuard
  reason: string
  phase: "apply" | "rollback"
}
export type TNativeTransactionResult = {
  status: "applied" | "rejected" | "rolled-back" | "recovery-required"
  transactionId: string | null
  reason: string | null
  appliedCount: number
  rollbackCount: number
  recovery: TNativeRecovery[]
  nextState: TNativeSelectionState | null
  effects: { fileMutationAttempted: boolean; writesState: false }
}

export const defineNativeTransactionView = (input: Omit<TNativeTransactionView, "viewId">): TNativeTransactionView => {
  const snapshot = parseNativeConsumerSnapshot(input.snapshot)
  const entries = input.entries
    .map((entry) => ({ path: nativePathSchema.parse(entry.path), token: entry.token }))
    .sort((a, b) => compareNativeKeys(a.path, b.path))
  if (
    typeof input.rootToken !== "string" ||
    !input.rootToken ||
    entries.some((entry) => typeof entry.token !== "string" || !entry.token)
  )
    throw new Error("Missing native transaction identity tokens")
  if (
    new Set(entries.map((entry) => entry.path.toLowerCase())).size !== entries.length ||
    snapshot.entries.some((entry) => !entries.some((evidence) => evidence.path === entry.path))
  )
    throw new Error("Native transaction tokens do not match snapshot paths")
  if (new Set([input.rootToken, ...entries.map((entry) => entry.token)]).size !== entries.length + 1)
    throw new Error("Aliased native transaction identity tokens")
  const body = { snapshot, rootToken: input.rootToken, entries }
  return { ...body, viewId: nativeDataHash(body) }
}
const parseView = (input: TNativeTransactionView) => {
  const parsed = defineNativeTransactionView(input)
  if (parsed.viewId !== input.viewId) throw new Error("Native transaction view content ID mismatch")
  return parsed
}
const guardAt = (view: TNativeTransactionView, target: string | null): TNativeTransactionGuard => {
  const parts = target?.split("/") ?? []
  return {
    root: view.snapshot.root,
    rootKind: view.snapshot.rootKind,
    rootToken: view.rootToken,
    entries: parts.map((_, index) => {
      const entryPath = parts.slice(0, index + 1).join("/")
      const entry = view.snapshot.entries.find((item) => item.path === entryPath)
      const evidence = view.entries.find((item) => item.path === entryPath)
      if (!evidence) throw new Error(`Missing native presence/absence identity token: ${entryPath}`)
      return {
        path: entryPath,
        token: evidence.token,
        kind: entry?.kind ?? null,
        contentHash: entry?.kind === "file" ? entry.contentHash : null,
      }
    }),
  }
}
const copyImage = (image: TNativeTransactionImage): TNativeTransactionImage =>
  image?.kind === "file" ? { kind: "file", content: Buffer.from(image.content) } : image ? { kind: "directory" } : null
const describeImage = (image: TNativeTransactionImage): TNativeRecovery["attemptedAfter"] =>
  image?.kind === "file"
    ? { kind: "file", contentHash: hashSource(image.content) }
    : image
      ? { kind: "directory" }
      : null
const entryMatches = (view: TNativeTransactionView, target: string | null, image: TNativeTransactionImage) => {
  if (target === null) return view.snapshot.rootKind === (image ? "directory" : "missing")
  const entry = view.snapshot.entries.find((item) => item.path === target)
  if (!image) return !entry
  return (
    entry?.kind === image.kind &&
    (image.kind !== "file" || (entry.kind === "file" && entry.contentHash === hashSource(image.content)))
  )
}
const expectedSnapshot = (view: TNativeTransactionView, target: string | null, image: TNativeTransactionImage) => {
  if (target === null)
    return defineNativeConsumerSnapshot({
      schemaVersion: 1,
      root: view.snapshot.root,
      rootKind: image ? "directory" : "missing",
      entries: image ? view.snapshot.entries : [],
    })
  return defineNativeConsumerSnapshot({
    schemaVersion: 1,
    root: view.snapshot.root,
    rootKind: view.snapshot.rootKind,
    entries: [
      ...view.snapshot.entries.filter((entry) => entry.path !== target),
      ...(image
        ? ([
            {
              path: target,
              kind: image.kind,
              ...(image.kind === "file" ? { contentHash: hashSource(image.content) } : {}),
            },
          ] as TNativeConsumerSnapshot["entries"])
        : []),
    ],
  })
}
const validateExchangeView = (
  before: TNativeTransactionView,
  after: TNativeTransactionView,
  target: string | null,
  image: TNativeTransactionImage,
  seen: Set<string>,
) => {
  if (after.snapshot.root !== before.snapshot.root || !entryMatches(after, target, image))
    throw new Error("Native store did not return the expected target post-image")
  const changedToken = target === null ? after.rootToken : after.entries.find((entry) => entry.path === target)?.token
  if (!changedToken || seen.has(changedToken)) throw new Error("Native store reused a transaction identity token")
  if (target !== null && before.rootToken !== after.rootToken)
    throw new Error("Native root identity changed during entry mutation")
  if (expectedSnapshot(before, target, image).snapshotId !== after.snapshot.snapshotId)
    throw new Error("Native source domain changed during mutation")
  if (
    before.entries.length !== after.entries.length ||
    before.entries.some((entry, index) => entry.path !== after.entries[index].path)
  )
    throw new Error("Native identity evidence domain changed during mutation")
  for (const entry of before.entries)
    if (entry.path !== target && after.entries.find((item) => item.path === entry.path)?.token !== entry.token)
      throw new Error("Unrelated native input identity changed during mutation")
}

/** The journal is in memory. No filesystem binding, CLI writer, lockfile or durable recovery journal is supplied. */
export const executeNativeSelectionTransaction = async (input: {
  plan: TNativeSelectionPlan
  desired: TNativeSelectionManifest
  payloads: readonly { path: string; content: Uint8Array }[]
  getCurrentContext: () => Promise<TNativeTransactionContext>
  store: TNativeTransactionStore
}): Promise<TNativeTransactionResult> => {
  const journal: { path: string | null; before: TNativeTransactionImage; afterView: TNativeTransactionView }[] = []
  const recovery: TNativeRecovery[] = []
  const seen = new Set<string>()
  let transactionId: string | null = null
  let fileMutationAttempted = false
  let rollbackCount = 0
  let watchedPaths: string[] = []
  const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
  const exchange = async (change: TNativeTransactionChange): Promise<TNativeTransactionExchange> => {
    try {
      const outcome = await input.store.exchange({
        path: change.path,
        after: copyImage(change.after),
        guard: structuredClone(change.guard),
      })
      if (
        !outcome ||
        !["applied", "rejected", "uncertain"].includes(outcome.status) ||
        (outcome.status !== "applied" && typeof outcome.reason !== "string")
      )
        return { status: "uncertain", reason: "Invalid native storage outcome" }
      return outcome
    } catch (error) {
      return { status: "uncertain", reason: reasonOf(error) }
    }
  }
  const result = (
    status: TNativeTransactionResult["status"],
    reason: string | null,
    nextState: TNativeSelectionState | null = null,
  ): TNativeTransactionResult => ({
    status,
    transactionId,
    reason,
    appliedCount: journal.length,
    rollbackCount,
    recovery,
    nextState,
    effects: { fileMutationAttempted, writesState: false },
  })
  const observe = async () => parseView(await input.store.observe(watchedPaths))
  const remember = (view: TNativeTransactionView) => {
    seen.add(view.rootToken)
    view.entries.forEach((entry) => seen.add(entry.token))
  }
  let failure: string
  try {
    // Clone all caller-owned data before the first await, including mutable byte payloads.
    const plan = structuredClone(input.plan)
    const desired = parseNativeSelectionManifest(input.desired)
    const payloads = input.payloads.map((payload) => ({ path: payload.path, content: Buffer.from(payload.content) }))
    validateNativeSelectionPayloads(desired, payloads)
    const content = new Map(payloads.map((payload) => [payload.path, payload.content]))
    const watched = new Set<string>()
    for (const operation of plan.operations) {
      const parts = nativePathSchema.parse(operation.path).split("/")
      for (let count = 1; count <= parts.length; count++) watched.add(parts.slice(0, count).join("/"))
    }
    watchedPaths = [...watched].sort(compareNativeKeys)
    const initial = await observe()
    watchedPaths.forEach((file) => guardAt(initial, file))
    const validateContext = async () =>
      validateNativeSelectionPlan(plan, { desired, ...(await input.getCurrentContext()), snapshot: initial.snapshot })
    await validateContext()
    transactionId = nativeDataHash({ planId: plan.planId, initialViewId: initial.viewId })
    remember(initial)
    const originals = new Map<string, Buffer>()
    for (const operation of plan.operations)
      if (operation.beforeHash) {
        const bytes = Buffer.from(
          await input.store.read({ path: operation.path, guard: guardAt(initial, operation.path) }),
        )
        if (hashSource(bytes) !== operation.beforeHash)
          throw new Error(`Native before-image hash mismatch: ${operation.path}`)
        originals.set(operation.path, bytes)
      }
    if ((await observe()).viewId !== initial.viewId) throw new Error("Native source domain changed during preflight")
    await validateContext()
    const changes: { path: string | null; before: TNativeTransactionImage; after: TNativeTransactionImage }[] = []
    if (plan.operations.length && initial.snapshot.rootKind === "missing")
      changes.push({ path: null, before: null, after: { kind: "directory" } })
    const directories = new Set<string>()
    for (const operation of plan.operations)
      if (operation.action === "create") {
        const parts = operation.path.split("/")
        for (let count = 1; count < parts.length; count++) {
          const directory = parts.slice(0, count).join("/")
          if (!initial.snapshot.entries.some((entry) => entry.path === directory)) directories.add(directory)
        }
      }
    for (const directory of [...directories].sort(
      (a, b) => a.split("/").length - b.split("/").length || compareNativeKeys(a, b),
    ))
      changes.push({ path: directory, before: null, after: { kind: "directory" } })
    changes.push(
      ...plan.operations.map((operation) => ({
        path: operation.path,
        before: operation.beforeHash ? { kind: "file" as const, content: originals.get(operation.path)! } : null,
        after: operation.afterHash ? { kind: "file" as const, content: content.get(operation.path)! } : null,
      })),
    )
    let current = initial
    for (const change of changes) {
      const guard = guardAt(current, change.path)
      fileMutationAttempted = true
      const outcome = await exchange({ path: change.path, after: change.after, guard })
      if (outcome.status !== "applied") {
        if (outcome.status === "uncertain")
          recovery.push({
            path: change.path,
            before: copyImage(change.before),
            attemptedAfter: describeImage(change.after),
            guard,
            reason: outcome.reason,
            phase: "apply",
          })
        throw new Error(outcome.reason)
      }
      let afterView: TNativeTransactionView
      try {
        afterView = parseView(outcome.view)
        if (afterView.snapshot.root !== initial.snapshot.root || !entryMatches(afterView, change.path, change.after))
          throw new Error("Invalid native post-image receipt")
        if (change.path !== null) {
          const afterGuard = guardAt(afterView, change.path)
          if (
            afterGuard.rootToken !== guard.rootToken ||
            afterGuard.rootKind !== guard.rootKind ||
            afterGuard.entries
              .slice(0, -1)
              .some((entry, index) => entry.token !== guard.entries[index].token || entry.kind !== "directory")
          )
            throw new Error("Native ancestor identity changed during mutation")
        }
        const targetToken =
          change.path === null
            ? afterView.rootToken
            : afterView.entries.find((entry) => entry.path === change.path)?.token
        if (!targetToken || seen.has(targetToken)) throw new Error("Reused native post-image token")
      } catch (error) {
        recovery.push({
          path: change.path,
          before: copyImage(change.before),
          attemptedAfter: describeImage(change.after),
          guard,
          reason: reasonOf(error),
          phase: "apply",
        })
        throw error
      }
      journal.push({ path: change.path, before: copyImage(change.before), afterView })
      validateExchangeView(current, afterView, change.path, change.after, seen)
      remember(afterView)
      current = afterView
    }
    if ((await observe()).viewId !== current.viewId) throw new Error("Native source domain changed before completion")
    await validateContext()
    return result("applied", null, plan.nextState)
  } catch (error) {
    failure = reasonOf(error)
  }
  for (const entry of [...journal].reverse()) {
    const guard = guardAt(entry.afterView, entry.path)
    try {
      const beforeRestore = await observe()
      const outcome = await exchange({ path: entry.path, after: entry.before, guard })
      if (outcome.status !== "applied") throw new Error(outcome.reason)
      const restored = parseView(outcome.view)
      validateExchangeView(beforeRestore, restored, entry.path, entry.before, seen)
      remember(restored)
      rollbackCount++
    } catch (error) {
      recovery.push({
        path: entry.path,
        before: copyImage(entry.before),
        attemptedAfter: describeImage(entry.before),
        guard,
        reason: reasonOf(error),
        phase: "rollback",
      })
    }
  }
  return result(recovery.length ? "recovery-required" : journal.length ? "rolled-back" : "rejected", failure)
}
