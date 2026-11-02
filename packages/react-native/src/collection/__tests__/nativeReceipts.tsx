import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ReactElement } from "react"
import type * as RN from "react-native"
import type { TestInstance } from "test-renderer"

import { nativeCollectionFocusBinding } from "../../input/nativeVisibleCollectionAdmission"

export { fireEvent, screen, userEvent } from "@testing-library/react-native"

type TRegistration = { id: string; tag: number; itemId?: string; itemRevision?: string }
type TPublication = {
  intent: string
  model: {
    ownerId: string
    generation: string
    revision: string
    items: { itemId: string; itemRevision: string }[]
  } | null
  root: TRegistration | null
  receivers: TRegistration[]
}
type TSourceBinding = Readonly<{
  ownerId: string
  generation: string
  revision: string
  itemId: string
  itemRevision: string
  registrationId: string
  target: number
  publisher: string
  lifetime: string
}>
type TIssuer = {
  publisher: string
  instance: number
  sequence: number
  signature: string
  root: object
  lifetime: string
}
type TIssued = { description: TSourceBinding; original: object; intent: string }
type TView = Awaited<ReturnType<typeof render>>
let sourceTargets = new WeakMap<object, number>()
let originalTargets = new Map<number, object>()
let issuers = new Map<string, TIssuer>()
let issued = new Map<string, TIssued>()
let nextTarget = 1000000,
  nextPublisher = 0
let acknowledgeCommits = true,
  answerActions = true
let restoreFindNodeHandle: (() => void) | undefined

// This fixture drives the real JS adapter with explicitly synthetic transport responses.
// Original-ref tags are source-test identities, never evidence of native mounting, windows, visibility or focus.
beforeEach(() => {
  sourceTargets = new WeakMap()
  originalTargets = new Map()
  issuers = new Map()
  issued = new Map()
  acknowledgeCommits = true
  answerActions = true
  const native = jest.requireActual<typeof RN>("react-native")
  const original = native.findNodeHandle
  const spy = jest.spyOn(native, "findNodeHandle").mockImplementation((host) => {
    let tag: number | null
    try {
      tag = original(host)
    } catch (error) {
      if (error instanceof Error && error.message.includes("unmounted component")) {
        const retired = host && typeof host === "object" ? sourceTargets.get(host) : undefined
        if (retired !== undefined) originalTargets.delete(retired)
        return null
      }
      throw error
    }
    if (!host || typeof host !== "object") return tag
    if (!sourceTargets.has(host)) sourceTargets.set(host, tag && tag > 0 ? tag : ++nextTarget)
    const current = sourceTargets.get(host)!
    originalTargets.set(current, host)
    return current
  })
  restoreFindNodeHandle = () => spy.mockRestore()
})
afterEach(() => restoreFindNodeHandle?.())

export const setSourceCollectionAcknowledgements = (enabled: boolean) => {
  acknowledgeCommits = enabled
}
export const setSourceCollectionActionResponses = (enabled: boolean) => {
  answerActions = enabled
}
const publishers = (view: Pick<TView, "container">) =>
  view.container.queryAll(
    (host) => typeof host.props.publication === "string" && typeof host.props.onNativeCollectionCommit === "function",
  )
const publication = (host: TestInstance): TPublication => JSON.parse(host.props.publication)
const currentRegistration = (model: TPublication, registration: TRegistration) => {
  if (
    !model.model ||
    !model.root ||
    !Number.isSafeInteger(registration.tag) ||
    registration.tag <= 0 ||
    !originalTargets.has(registration.tag)
  )
    return false
  if (registration === model.root) return true
  return model.model.items.some(
    (item) => item.itemId === registration.itemId && item.itemRevision === registration.itemRevision,
  )
}
const ownerKey = (model: NonNullable<TPublication["model"]>) => JSON.stringify([model.ownerId, model.generation])

// Inspect fixture-issued records without treating the production opaque binding as a public serialization contract.
export const inspectSourceCollectionBinding = (binding: string): TSourceBinding | null => {
  const value = issued.get(binding)
  return value &&
    originalTargets.get(value.description.target) === value.original &&
    nativeCollectionFocusBinding(value.original) === binding
    ? value.description
    : null
}
export const sourceCollectionPublications = (view: Pick<TView, "container"> = screen) =>
  publishers(view).map(publication)

export const confirmNativeCollections = async (view: Pick<TView, "container"> = screen) => {
  if (!acknowledgeCommits) return 0
  let published = 0
  for (const host of publishers(view)) {
    const model = publication(host)
    if (!model.model || !model.root || !currentRegistration(model, model.root)) continue
    const key = ownerKey(model.model),
      originalRoot = originalTargets.get(model.root.tag)!
    let issuer = issuers.get(key)
    if (!issuer || issuer.root !== originalRoot) {
      const instance = ++nextPublisher
      issuer = {
        publisher: `source-publisher:${instance}`,
        instance,
        sequence: 0,
        signature: "",
        root: originalRoot,
        lifetime: `source-window-lifetime:${instance}`,
      }
      issuers.set(key, issuer)
    }
    const registrations = [model.root, ...model.receivers]
    const counts = new Map<number, number>()
    for (const registration of registrations) counts.set(registration.tag, (counts.get(registration.tag) ?? 0) + 1)
    const accepted = registrations.filter((entry) => currentRegistration(model, entry) && counts.get(entry.tag) === 1)
    const signature = JSON.stringify([model.intent, accepted])
    if (issuer.signature === signature) continue
    issuer.signature = signature
    const receipts = accepted.map((entry) => {
      // Concrete private flat-native wire shape, with explicitly synthetic source-test identities.
      const binding = JSON.stringify({
        publisher: issuer!.publisher,
        lease: `${issuer!.publisher}:source-lease:${entry.id}`,
        ownerId: model.model!.ownerId,
        rootId: model.model!.generation,
        rootRevision: model.model!.revision,
        target: 2000000 + issuer!.instance,
        surfaceId: 1,
        windowId: "source-model-window",
        epoch: issuer!.instance,
        sequence: issuer!.instance,
        descriptorId: entry.itemId ?? "",
        descriptorRevision: entry.itemRevision ?? "",
      })
      const description: TSourceBinding = Object.freeze({
        ownerId: model.model!.ownerId,
        generation: model.model!.generation,
        revision: model.model!.revision,
        itemId: entry.itemId ?? "",
        itemRevision: entry.itemRevision ?? "",
        registrationId: entry.id,
        target: entry.tag,
        publisher: issuer!.publisher,
        lifetime: issuer!.lifetime,
      })
      issued.set(binding, { description, original: originalTargets.get(entry.tag)!, intent: model.intent })
      return { id: entry.id, tag: entry.tag, binding }
    })
    published++
    await act(() =>
      host.props.onNativeCollectionCommit({
        nativeEvent: {
          data: JSON.stringify({
            intent: model.intent,
            publisher: issuer!.publisher,
            instance: issuer!.instance,
            sequence: ++issuer!.sequence,
            lifetime: issuer!.lifetime,
            registrations: receipts,
          }),
        },
      }),
    )
  }
  return published
}

export const flushNativeCollectionActions = async () => {
  if (!answerActions) return 0
  let answered = 0
  for (const host of publishers(screen)) {
    const model = publication(host)
    const requests: { id: string; binding: string; target: number }[] = JSON.parse(host.props.actionRequests ?? "[]")
    for (const request of requests) {
      const entry = issued.get(request.binding)
      const current = inspectSourceCollectionBinding(request.binding)
      const accepted =
        !!entry &&
        !!current &&
        entry.intent === model.intent &&
        current.target === request.target &&
        [model.root, ...model.receivers].some(
          (registration) =>
            registration?.id === current.registrationId &&
            registration.tag === request.target &&
            currentRegistration(model, registration),
        )
      answered++
      await act(() =>
        host.props.onNativeCollectionAction({
          nativeEvent: {
            data: JSON.stringify({
              id: request.id,
              binding: request.binding,
              publisher: entry?.description.publisher ?? "unissued-source-publisher",
              accepted,
            }),
          },
        }),
      )
    }
  }
  return answered
}
const settleSourceCollections = async (view: Pick<TView, "container"> = screen) => {
  for (let turn = 0; turn < 16; turn++) {
    const actions = await flushNativeCollectionActions()
    const commits = await confirmNativeCollections(view)
    if (!actions && !commits) return
  }
  throw new Error("Explicit source collection publisher/actions did not settle")
}
export const actWithNativeCollections = async <T,>(callback: () => T | Promise<T>): Promise<T> => {
  const result = await act(callback)
  await settleSourceCollections()
  return result
}
export const fireEventWithNativeCollections: typeof fireEvent = Object.assign(
  (...args: Parameters<typeof fireEvent>) => actWithNativeCollections(() => fireEvent(...args)),
  {
    press: (...args: Parameters<typeof fireEvent.press>) => actWithNativeCollections(() => fireEvent.press(...args)),
    changeText: (...args: Parameters<typeof fireEvent.changeText>) =>
      actWithNativeCollections(() => fireEvent.changeText(...args)),
    scroll: (...args: Parameters<typeof fireEvent.scroll>) => actWithNativeCollections(() => fireEvent.scroll(...args)),
  },
)
export const rerenderWithNativeCollections = (...args: Parameters<typeof screen.rerender>) =>
  actWithNativeCollections(() => screen.rerender(...args))
export const renderWithNativeCollections: typeof render = async (element: ReactElement, options) => {
  const view = await render(element, options)
  await settleSourceCollections(view)
  const rerender = view.rerender
  view.rerender = async (next) => {
    await rerender(next)
    await settleSourceCollections(view)
  }
  return view
}
