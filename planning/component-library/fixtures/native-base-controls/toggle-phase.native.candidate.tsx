import { fireEvent, render, screen } from "@testing-library/react-native"

import { NativeFocusView } from "../../../../packages/react-native/src/input/NativeFocusView"
import type { TNativeKeyboardData } from "../../../../packages/react-native/src/input/types"

it("reproduces the missing native ancestor capture and bubble path required by toggle composition", async () => {
  const trace: string[] = []
  const unsupportedCapture = { onKeyDownCapture: () => trace.push("capture") }
  await render(
    <NativeFocusView {...unsupportedCapture} testID="outer" onKeyDown={() => trace.push("bubble")}>
      <NativeFocusView testID="target" onKeyDown={() => trace.push("target")} />
    </NativeFocusView>,
  )
  const target = screen.getByTestId("target")
  const data: TNativeKeyboardData = {
    kind: "keyboard",
    ownerId: target.props.ownerId,
    target: 71,
    key: "Home",
    nativeCode: 74,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "0",
    nativeDefaultHandled: false,
    timestamp: 100,
  }
  await fireEvent(target, "nativeKey", { nativeEvent: data })
  expect(trace).toEqual(["capture", "target", "bubble"])
})
