import { act, screen } from "@testing-library/react-native"

// Core View test-renderer refs have no native tag. Map each original object only in this source fixture.
// This supplies identity for transport tests, not a native attachment/window acknowledgement.
let restoreSourceTags: (() => void) | undefined
beforeEach(() => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const original = native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let nextTag = 1000000
  const spy = jest.spyOn(native, "findNodeHandle").mockImplementation((host) => {
    const tag = original(host)
    if (tag || !host || typeof host !== "object") return tag
    if (!tags.has(host)) tags.set(host, ++nextTag)
    return tags.get(host)!
  })
  restoreSourceTags = () => spy.mockRestore()
})
afterEach(() => restoreSourceTags?.())

// Exercise the real JS publisher/adapter using explicit source-test transport events only.
// These receipts are not evidence of native mount/window/accessibility qualification.
export type TSourcePublication = {
  intent: string
  model: { ownerId: string; generation: string; revision: string; items: { itemId: string; itemRevision: string }[] }
  root: { id: string; tag: number }
  receivers: { id: string; tag: number; itemId: string; itemRevision: string }[]
}
export const sourcePublisher = () => {
  const publishers = screen.container.queryAll((host) => typeof host.props.publication === "string")
  expect(publishers).toHaveLength(1)
  return publishers[0]
}
export const sourcePublication = (): TSourcePublication => JSON.parse(sourcePublisher().props.publication)
export const sourceReceipt = (sequence: number, publication = sourcePublication()) => ({
  intent: publication.intent,
  publisher: "source-test-native-publisher",
  instance: 1,
  sequence,
  lifetime: "source-test-native-root-lifetime",
  registrations: [publication.root, ...publication.receivers].map(({ id, tag }) => ({
    id,
    tag,
    binding: `source-test-native-lease:${id}`,
  })),
})
export const deliverSourceReceipt = async (receipt: ReturnType<typeof sourceReceipt>) =>
  act(() => sourcePublisher().props.onNativeCollectionCommit({ nativeEvent: { data: JSON.stringify(receipt) } }))
export const answerSourceActions = async () => {
  for (let turn = 0; turn < 8; turn++) {
    const pending: { id: string; binding: string }[] = JSON.parse(sourcePublisher().props.actionRequests)
    if (!pending.length) return
    await act(() =>
      pending.forEach(({ id, binding }) =>
        sourcePublisher().props.onNativeCollectionAction({
          nativeEvent: {
            data: JSON.stringify({ id, binding, publisher: "source-test-native-publisher", accepted: true }),
          },
        }),
      ),
    )
  }
  throw new Error("Explicit source action responses did not settle")
}
