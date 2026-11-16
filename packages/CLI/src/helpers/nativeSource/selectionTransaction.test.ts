import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  defineNativeConsumerSnapshot,
  defineNativeSelectionState,
  planNativeSelection,
  type TExternalNativeIdentity,
} from "./selectionLifecycle"
import { buildNativeSelection, nativePathSchema } from "./selectionManifest"
import {
  defineNativeTransactionView,
  executeNativeSelectionTransaction,
  type TNativeTransactionChange,
  type TNativeTransactionExchange,
  type TNativeTransactionGuard,
  type TNativeTransactionImage,
  type TNativeTransactionStore,
  type TNativeTransactionView,
} from "./selectionTransaction"
import { hashSource } from "./sourceFiles"

const sourceRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const full = await buildNativeSelection({ sourceRoot, requests: [{ component: "owner", features: ["table"] }] })
const core = await buildNativeSelection({ sourceRoot, requests: [{ component: "owner" }] })
const empty = await buildNativeSelection({ sourceRoot: "/not-read", requests: [] })
const root = "/tmp/codon-native-transaction-model"
type TModelEntry = { kind: "file"; content: Buffer; token: string } | { kind: "directory" | "symlink"; token: string }

/** Executable atomic-store contract model. It is deliberately not a filesystem adapter. */
class NativeStoreModel implements TNativeTransactionStore {
  entries = new Map<string, TModelEntry>()
  absences = new Map<string, string>()
  watched = new Set<string>()
  rootKind: "directory" | "missing" = "directory"
  rootToken = "v0"
  version = 0
  attempts = 0
  observations = 0
  effects: (string | null)[] = []
  beforeExchange?: (change: TNativeTransactionChange, count: number) => TNativeTransactionExchange | void
  afterExchange?: (change: TNativeTransactionChange, count: number) => TNativeTransactionExchange | void
  beforeObserve?: (count: number) => void
  corruptRead = false

  constructor(payloads: readonly { path: string; content: Uint8Array }[] = []) {
    for (const payload of payloads) this.consumerFile(payload.path, payload.content)
  }
  token = () => `v${++this.version}`
  consumerFile = (file: string, content: Uint8Array) => {
    const parts = file.split("/")
    for (let count = 1; count < parts.length; count++) {
      const directory = parts.slice(0, count).join("/")
      if (!this.entries.has(directory)) this.entries.set(directory, { kind: "directory", token: this.token() })
    }
    this.entries.set(file, { kind: "file", content: Buffer.from(content), token: this.token() })
  }
  consumerLink = (directory: string) => {
    for (const file of this.entries.keys())
      if (file === directory || file.startsWith(`${directory}/`)) this.consumerDelete(file)
    this.entries.set(directory, { kind: "symlink", token: this.token() })
  }
  consumerDelete = (file: string) => {
    this.entries.delete(file)
    this.absences.set(file, this.token())
  }
  view = (): TNativeTransactionView =>
    defineNativeTransactionView({
      snapshot: defineNativeConsumerSnapshot({
        schemaVersion: 1,
        root,
        rootKind: this.rootKind,
        entries: [...this.entries].map(([file, entry]) =>
          entry.kind === "file"
            ? { path: file, kind: "file" as const, contentHash: hashSource(entry.content) }
            : { path: file, kind: entry.kind },
        ),
      }),
      rootToken: this.rootToken,
      entries: [...new Set([...this.entries.keys(), ...this.watched])].map((file) => {
        if (!this.entries.has(file) && !this.absences.has(file)) this.absences.set(file, this.token())
        return { path: file, token: this.entries.get(file)?.token ?? this.absences.get(file)! }
      }),
    })
  observe = async (paths: readonly string[]) => {
    paths.forEach((file) => this.watched.add(file))
    this.beforeObserve?.(++this.observations)
    return this.view()
  }
  check = (guard: TNativeTransactionGuard, target: string | null) => {
    if (guard.root !== root || guard.rootKind !== this.rootKind || guard.rootToken !== this.rootToken)
      throw new Error("root guard changed")
    if (target !== null) {
      nativePathSchema.parse(target)
      const parts = target.split("/")
      assert.equal(guard.entries.length, parts.length)
      for (let count = 1; count <= parts.length; count++) {
        const file = parts.slice(0, count).join("/")
        const expected = guard.entries[count - 1]
        const entry = this.entries.get(file)
        if (
          expected.path !== file ||
          [...this.entries.keys()].some((name) => name.toLowerCase() === file.toLowerCase() && name !== file)
        )
          throw new Error("path casing guard changed")
        if (
          (entry?.token ?? this.absences.get(file) ?? null) !== expected.token ||
          (entry?.kind ?? null) !== expected.kind ||
          (entry?.kind === "file" ? hashSource(entry.content) : null) !== expected.contentHash
        )
          throw new Error("entry guard changed")
        if (entry?.kind === "symlink" || (count < parts.length && entry?.kind !== "directory"))
          throw new Error("unsafe parent or target")
      }
    }
  }
  read = async ({ path: file, guard }: { path: string; guard: TNativeTransactionGuard }) => {
    this.check(guard, file)
    const entry = this.entries.get(file)
    if (entry?.kind !== "file") throw new Error("missing preimage")
    return this.corruptRead ? Buffer.from("invalid read") : Buffer.from(entry.content)
  }
  exchange = async (change: TNativeTransactionChange): Promise<TNativeTransactionExchange> => {
    const call = ++this.attempts
    const injected = this.beforeExchange?.(change, call)
    if (injected) return injected
    try {
      this.check(change.guard, change.path)
      if (change.path === null) {
        if (change.after?.kind === "file" || this.entries.size) throw new Error("root must be empty")
        if ((this.rootKind === "directory") === Boolean(change.after)) throw new Error("root state unchanged")
        this.rootKind = change.after ? "directory" : "missing"
        this.rootToken = this.token()
      } else {
        if (this.rootKind !== "directory") throw new Error("missing root")
        const current = this.entries.get(change.path)
        if (
          current?.kind === "directory" &&
          (change.after || [...this.entries.keys()].some((file) => file.startsWith(`${change.path}/`)))
        )
          throw new Error("directory is nonempty or would be replaced")
        if (change.after?.kind === "directory" && current) throw new Error("directory already exists")
        if (!change.after) this.consumerDelete(change.path)
        else
          this.entries.set(
            change.path,
            change.after.kind === "file"
              ? { kind: "file", content: Buffer.from(change.after.content), token: this.token() }
              : { kind: "directory", token: this.token() },
          )
      }
    } catch (error) {
      return { status: "rejected", reason: (error as Error).message }
    }
    this.effects.push(change.path)
    return this.afterExchange?.(change, call) ?? { status: "applied", view: this.view() }
  }
}

const setup = (initial = full, desired = core, model = new NativeStoreModel(initial.payloads)) => {
  const previous = defineNativeSelectionState(root, initial.manifest)
  const context: { previous: typeof previous | null; externalIdentities: TExternalNativeIdentity[] } = {
    previous,
    externalIdentities: [],
  }
  const plan = planNativeSelection({ desired: desired.manifest, ...context, snapshot: model.view().snapshot })
  assert.equal(plan.status, "ready")
  const input: Parameters<typeof executeNativeSelectionTransaction>[0] = {
    plan,
    desired: desired.manifest,
    payloads: desired.payloads,
    getCurrentContext: async () => context,
    store: model,
  }
  return { model, context, input }
}
const contents = (model: NativeStoreModel) => model.view().snapshot.snapshotId
const assertNoState = (result: Awaited<ReturnType<typeof executeNativeSelectionTransaction>>) => {
  assert.equal(result.nextState, null)
  assert.equal(result.effects.writesState, false)
}

test("full/core native transitions apply and return proposed state without persisting any lockfile", async () => {
  const { model, input } = setup()
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "applied")
  assert.equal(result.appliedCount, 18)
  assert.equal(result.nextState?.manifest.manifestId, core.manifest.manifestId)
  assert.equal(result.effects.writesState, false)
  assert.deepEqual(
    [...model.entries]
      .filter(([, entry]) => entry.kind === "file")
      .map(([file]) => file)
      .sort(),
    core.manifest.files.map((file) => file.path).sort(),
  )
  for (const payload of core.payloads)
    assert.deepEqual(
      (model.entries.get(payload.path) as Extract<TModelEntry, { kind: "file" }>).content,
      payload.content,
    )
})

test("every Table file-mutation failure boundary reverses all acknowledged effects", async () => {
  for (let failureAt = 1; failureAt <= 18; failureAt++) {
    const { model, input } = setup()
    const original = contents(model)
    model.beforeExchange = (_, call) =>
      call === failureAt ? { status: "rejected", reason: `failure ${failureAt}` } : undefined
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(
      result.status,
      failureAt === 1 ? "rejected" : "rolled-back",
      `boundary ${failureAt}: ${JSON.stringify(result.recovery)}`,
    )
    assert.equal(result.appliedCount, failureAt - 1)
    assert.equal(result.rollbackCount, failureAt - 1)
    assert.deepEqual(result.recovery, [])
    assert.equal(contents(model), original, `boundary ${failureAt}`)
    assertNoState(result)
  }
})

test("new-root directory creation participates in application and conditional rollback", async () => {
  const model = new NativeStoreModel()
  model.rootKind = "missing"
  const { input } = setup(empty, core, model)
  const complete = await executeNativeSelectionTransaction(input)
  assert.equal(complete.status, "applied")
  assert.equal(model.rootKind, "directory")
  assert.equal(model.effects[0], null)
  for (const stop of [2, 5, 25]) {
    const fresh = new NativeStoreModel()
    fresh.rootKind = "missing"
    const { input: freshInput } = setup(empty, core, fresh)
    fresh.beforeExchange = (_, call) =>
      call === stop ? { status: "rejected", reason: "directory/file failure" } : undefined
    const failed = await executeNativeSelectionTransaction(freshInput)
    assert.equal(failed.status, "rolled-back", JSON.stringify(failed.recovery))
    assert.equal(fresh.rootKind, "missing")
    assert.equal(fresh.entries.size, 0)
    assertNoState(failed)
  }
})

test("payload/plan traversal, stale snapshots and corrupt before-images reject before any write", async () => {
  for (const scenario of ["payload", "traversal", "stale", "read"] as const) {
    const { model, input } = setup()
    if (scenario === "payload") input.payloads = input.payloads.slice(1)
    if (scenario === "traversal") input.plan.operations[0].path = "../escape"
    if (scenario === "stale")
      model.consumerFile(input.plan.operations[0].path, Buffer.from("edited before transaction"))
    if (scenario === "read") model.corruptRead = true
    const before = contents(model)
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "rejected", scenario)
    assert.equal(model.attempts, 0, scenario)
    assert.equal(contents(model), before, scenario)
    assertNoState(result)
  }
})

test("changed root identities during preflight reject even when file bytes are unchanged", async () => {
  const { model, input } = setup()
  model.beforeObserve = (call) => {
    if (call === 2) model.rootToken = model.token()
  }
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "rejected")
  assert.match(result.reason!, /changed during preflight/)
  assert.equal(model.attempts, 0)
})

test("atomic guards reject target edits, same-byte rewrites and ancestor links appearing after preflight", async () => {
  for (const scenario of ["edit", "same-byte", "link"] as const) {
    const { model, input } = setup()
    const target = input.plan.operations[0].path
    model.beforeExchange = (_, call) => {
      if (call !== 1) return
      if (scenario === "link") model.consumerLink(target.split("/")[0])
      else
        model.consumerFile(
          target,
          scenario === "edit"
            ? Buffer.from("consumer")
            : (model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content,
        )
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "rejected", scenario)
    assert.equal(model.effects.length, 0, scenario)
    assertNoState(result)
  }
})

test("rollback preserves consumer edits, including same-byte new identities, with before-images for recovery", async () => {
  for (const sameBytes of [false, true]) {
    const { model, input } = setup()
    const target = input.plan.operations.find((operation) => operation.action === "replace")!.path
    const index = input.plan.operations.findIndex((operation) => operation.path === target)
    const old = Buffer.from((model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content)
    let consumerBytes: Buffer
    model.beforeExchange = (_, call) => {
      if (call !== index + 2) return
      consumerBytes = sameBytes
        ? Buffer.from((model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content)
        : Buffer.from("new consumer edit")
      model.consumerFile(target, consumerBytes)
      return { status: "rejected", reason: "later file failed" }
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "recovery-required")
    assert.deepEqual((model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content, consumerBytes!)
    const recovery = result.recovery.find((item) => item.path === target)!
    assert.equal(recovery.phase, "rollback")
    assert.deepEqual((recovery.before as Extract<TNativeTransactionImage, { kind: "file" }>).content, old)
    assert.equal(result.rollbackCount, result.appliedCount - 1)
    assertNoState(result)
  }
})

test("rollback respects consumer recreation and create/delete ABA changes at a deleted path", async () => {
  for (const removeAgain of [false, true]) {
    const { model, input } = setup()
    const first = input.plan.operations.findIndex((operation) => operation.action === "delete")
    const target = input.plan.operations[first].path
    const recreated = Buffer.from("recreated consumer file")
    model.beforeExchange = (_, call) => {
      if (call !== first + 2) return
      model.consumerFile(target, recreated)
      if (removeAgain) model.consumerDelete(target)
      return { status: "rejected", reason: "failure after delete" }
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "recovery-required")
    if (removeAgain) assert.equal(model.entries.has(target), false)
    else assert.deepEqual((model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content, recreated)
    assert.ok(result.recovery.some((item) => item.path === target))
  }
})

test("rollback does not follow replaced root or parent identities", async () => {
  for (const replaceRoot of [false, true]) {
    const { model, input } = setup()
    const target = input.plan.operations[0].path
    let replacementSnapshot: string
    model.beforeExchange = (_, call) => {
      if (call !== 2) return
      if (replaceRoot) model.rootToken = model.token()
      else {
        const parent = target.split("/").slice(0, -1).join("/")
        model.entries.set(parent, { kind: "directory", token: model.token() })
      }
      replacementSnapshot = contents(model)
      return { status: "rejected", reason: "scope replaced" }
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "recovery-required")
    assert.equal(result.rollbackCount, 0)
    assert.equal(contents(model), replacementSnapshot!)
    assert.ok(result.recovery.some((entry) => entry.path === target))
    assertNoState(result)
  }
})

test("rollback faults preserve recovery evidence and do not stop remaining safe compensation", async () => {
  for (const uncertain of [false, true]) {
    const { model, input } = setup()
    model.beforeExchange = (_, call) => {
      if (call === 3) return { status: "rejected", reason: "forward failure" }
      if (call === 4 && !uncertain) return { status: "rejected", reason: "rollback failure" }
    }
    model.afterExchange = (_, call) =>
      call === 4 && uncertain ? { status: "uncertain", reason: "rollback acknowledgement lost" } : undefined
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "recovery-required")
    assert.equal(result.appliedCount, 2)
    assert.equal(result.rollbackCount, 1)
    assert.equal(result.recovery.length, 1)
    assert.equal(result.recovery[0].path, input.plan.operations[1].path)
    assert.equal(result.recovery[0].phase, "rollback")
    assert.equal(model.effects.at(-1), input.plan.operations[0].path)
    assertNoState(result)
  }
})

test("unrelated edits after an acknowledged mutation are preserved while transaction effects roll back", async () => {
  const { model, input } = setup()
  const foreign = "ios/Consumer.mm"
  const bytes = Buffer.from("new source")
  model.afterExchange = (_, call) => {
    if (call === 1) model.consumerFile(foreign, bytes)
  }
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "rolled-back")
  assert.match(result.reason!, /domain changed during mutation/)
  assert.deepEqual((model.entries.get(foreign) as Extract<TModelEntry, { kind: "file" }>).content, bytes)
  assert.equal(result.appliedCount, result.rollbackCount)
  assertNoState(result)
})

test("new consumer files prevent cleanup of transaction-created directories and roots", async () => {
  const model = new NativeStoreModel()
  model.rootKind = "missing"
  const { input } = setup(empty, core, model)
  model.beforeExchange = (_, call) => {
    if (call !== 3) return
    model.consumerFile("android/Consumer.java", Buffer.from("consumer"))
    return { status: "rejected", reason: "creation interrupted" }
  }
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "recovery-required")
  assert.equal(model.rootKind, "directory")
  assert.ok(model.entries.has("android/Consumer.java"))
  assert.ok(result.recovery.some((entry) => entry.path === null))
})

test("ambiguous thrown or explicit outcomes keep the uncertain step for recovery and undo only acknowledged effects", async () => {
  for (const thrown of [false, true]) {
    const { model, input } = setup()
    model.afterExchange = (_, call) => {
      if (call !== 2) return
      if (thrown) throw new Error("lost acknowledgement")
      return { status: "uncertain", reason: "unknown outcome" }
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "recovery-required")
    assert.equal(result.appliedCount, 1)
    assert.equal(result.rollbackCount, 1)
    assert.equal(result.recovery[0].phase, "apply")
    assert.equal(result.recovery[0].path, input.plan.operations[1].path)
    assertNoState(result)
  }
})

test("invalid post-image receipts cannot advance ownership or authorize blind rollback", async () => {
  const { model, input } = setup()
  const original = model.view()
  model.afterExchange = (_, call) => (call === 1 ? { status: "applied", view: original } : undefined)
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "recovery-required")
  assert.equal(result.appliedCount, 0)
  assert.equal(result.rollbackCount, 0)
  assert.equal(result.recovery[0].phase, "apply")
  assertNoState(result)
})

test("completion rechecks the domain and metadata context before returning proposed ownership", async () => {
  for (const scenario of ["source", "context"] as const) {
    const { model, input, context } = setup()
    if (scenario === "source")
      model.beforeObserve = (call) => {
        if (call === 3) model.consumerFile("README.md", Buffer.from("consumer"))
      }
    else {
      let reads = 0
      input.getCurrentContext = async () => {
        if (++reads === 3)
          context.externalIdentities = [
            { scope: "native-package", identity: "@codon-ui/react-native", owner: "other-package" },
          ]
        return context
      }
    }
    const result = await executeNativeSelectionTransaction(input)
    assert.equal(result.status, "rolled-back", scenario)
    assert.equal(result.appliedCount, result.rollbackCount)
    assertNoState(result)
  }
})

test("caller mutation after the first await cannot change validated plan/payload bytes", async () => {
  const { model, input } = setup()
  const file = input.plan.operations.find((operation) => operation.action === "replace")!.path
  const payloadIndex = input.payloads.findIndex((payload) => payload.path === file)
  const expected = Buffer.from(input.payloads[payloadIndex].content)
  input.payloads = input.payloads.map((payload) => ({ path: payload.path, content: Buffer.from(payload.content) }))
  model.beforeObserve = (call) => {
    if (call !== 1) return
    input.payloads[payloadIndex].content.fill(0)
    input.plan.operations[0].path = "../escape"
    input.desired.files[0].contentHash = hashSource(Buffer.from("changed caller manifest"))
  }
  // Keep globally shared test selections immutable.
  input.desired = structuredClone(input.desired)
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "applied")
  assert.deepEqual((model.entries.get(file) as Extract<TModelEntry, { kind: "file" }>).content, expected)
})

test("unchanged upstream preserves edited inputs without performing storage exchanges", async () => {
  const model = new NativeStoreModel(full.payloads)
  const target = "ios/CUINativeFeatures.mm"
  const edit = Buffer.from("consumer edit")
  model.consumerFile(target, edit)
  const { input } = setup(full, full, model)
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "applied")
  assert.equal(model.attempts, 0)
  assert.equal(result.effects.fileMutationAttempted, false)
  assert.deepEqual((model.entries.get(target) as Extract<TModelEntry, { kind: "file" }>).content, edit)
  assert.equal(result.nextState?.manifest.manifestId, full.manifest.manifestId)
})

test("transaction views reject missing, aliased and tampered identity evidence", async () => {
  const { model, input } = setup()
  const view = model.view()
  assert.throws(() => defineNativeTransactionView({ ...view, entries: view.entries.slice(1) }), /tokens do not match/)
  assert.throws(
    () => defineNativeTransactionView({ ...view, entries: view.entries.map((entry) => ({ ...entry, token: "same" })) }),
    /Aliased/,
  )
  input.store = {
    ...model,
    observe: async () => ({ ...view, rootToken: "tampered" }),
    read: model.read,
    exchange: model.exchange,
  }
  const result = await executeNativeSelectionTransaction(input)
  assert.equal(result.status, "rejected")
  assert.match(result.reason!, /content ID mismatch/)
  assert.equal(model.attempts, 0)
})
