import "../../../collection/__tests__/visiblePublisher"

import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ReactElement } from "react"

import type { TSourcePublication } from "../../../collection/__tests__/visiblePublisher"

export { fireEvent, screen, userEvent } from "@testing-library/react-native"

jest.mock("../../../input/specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

type TView = Awaited<ReturnType<typeof render>>
const signatures = new Map<string, string>()
const sequences = new Map<string, number>()
const publisherIdentity = (publication: TSourcePublication) => `source-test-publisher:${publication.model.ownerId}`

// Source-only transport events exercise the production adapter. They prove no native mount/window/AX behavior.
export const confirmNativeCollections = async (view: Pick<TView, "container"> = screen) => {
  let published = 0
  for (const host of view.container.queryAll((node) => typeof node.props.publication === "string")) {
    const publication = JSON.parse(host.props.publication) as TSourcePublication
    if (!publication.model || !publication.root) continue
    const owner = publication.model.ownerId
    if (signatures.get(owner) === host.props.publication) continue
    signatures.set(owner, host.props.publication)
    const sequence = (sequences.get(owner) ?? 0) + 1
    sequences.set(owner, sequence)
    published++
    await act(() =>
      host.props.onNativeCollectionCommit({
        nativeEvent: {
          data: JSON.stringify({
            intent: publication.intent,
            publisher: publisherIdentity(publication),
            instance: 1,
            sequence,
            lifetime: `source-test-lifetime:${publication.root.id}`,
            registrations: [publication.root, ...publication.receivers].map(({ id, tag }) => ({
              id,
              tag,
              binding: `source-test-lease:${id}`,
            })),
          }),
        },
      }),
    )
  }
  return published
}

export const pendingNativeCollectionActions = () =>
  screen.container
    .queryAll((node) => typeof node.props.publication === "string")
    .flatMap((host) => {
      const publication = JSON.parse(host.props.publication) as TSourcePublication
      const actions = JSON.parse(host.props.actionRequests) as { id: string; binding: string; target: number }[]
      return actions.map((request) => ({
        ...request,
        respond: (accepted = true) =>
          host.props.onNativeCollectionAction({
            nativeEvent: {
              data: JSON.stringify({
                id: request.id,
                binding: request.binding,
                publisher: publisherIdentity(publication),
                accepted,
              }),
            },
          }),
      }))
    })
export const flushNativeCollectionActions = async () => {
  const pending = pendingNativeCollectionActions()
  for (const request of pending) await act(() => request.respond())
  return pending.length
}
export const actWithNativeCollections = async <T,>(callback: () => T | Promise<T>): Promise<T> => {
  const result = await act(callback)
  for (let turn = 0; turn < 8; turn++) {
    const actions = await flushNativeCollectionActions()
    const commits = await confirmNativeCollections()
    if (!actions && !commits) return result
  }
  throw new Error("Explicit source collection transport did not settle")
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
  await confirmNativeCollections(view)
  const rerender = view.rerender
  view.rerender = async (next) => {
    await rerender(next)
    await confirmNativeCollections(view)
  }
  return view
}
afterEach(() => {
  signatures.clear()
  sequences.clear()
})
