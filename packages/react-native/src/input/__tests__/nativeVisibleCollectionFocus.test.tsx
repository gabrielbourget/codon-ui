import { render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { focusNativeTarget } from "../focus"
import { NativeFocusView } from "../NativeFocusView"
import { createNativeVisibleCollectionAdmission } from "../nativeVisibleCollectionAdmission"
import { Commands } from "../specs/CUIFocusViewNativeComponent"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestCollectionFocus: jest.fn(), requestKeyboardBlur: jest.fn() },
}))
jest.mock("../specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

it("sends the current exact lease with an owned focus command and refuses unacknowledged originals", async () => {
  const ref = createRef<View>()
  await render(<NativeFocusView ref={ref} testID="receiver" />)
  const original = ref.current!
  const root = {}
  const state = createNativeVisibleCollectionAdmission((value) =>
    value === root ? 10 : value === original ? 20 : null,
  )
  const scope = {
    ownerId: "owner",
    generation: "generation",
    revision: "revision",
    itemId: "item",
    itemRevision: "revision",
  }
  const releaseRoot = state.adapter.registerOwner(JSON.stringify({ ...scope, items: [scope] }), root)
  const releaseReceiver = state.adapter.registerReceiver(scope, original)
  expect(focusNativeTarget(original)).toBe(false)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(Commands.requestCollectionFocus).not.toHaveBeenCalled()
  const publication = JSON.parse(state.publication())
  state.receiveCommit(
    JSON.stringify({
      intent: publication.intent,
      publisher: "native",
      instance: 1,
      sequence: 1,
      lifetime: "root-lease",
      registrations: [publication.root, ...publication.receivers].map((entry: { id: string; tag: number }) => ({
        ...entry,
        binding: `lease:${entry.id}`,
      })),
    }),
  )
  expect(focusNativeTarget(original)).toBe(true)
  expect(Commands.requestCollectionFocus).toHaveBeenLastCalledWith(
    original,
    screen.getByTestId("receiver").props.ownerId,
    state.adapter.bindingFor(scope),
    false,
  )
  state.setActive(false)
  expect(focusNativeTarget(original)).toBe(false)
  releaseReceiver()
  releaseRoot()
  await screen.unmount()
})
