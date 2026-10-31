import { act, screen } from "@testing-library/react-native"

const host = (testID = "host") => screen.getByTestId(testID).props
let eventId = 0
export const acknowledgeToasterKeyboard = async (windowId = "toaster-window", epoch = 1, testID = "host") => {
  for (const ready of [false, true]) {
    await act(() => {
      const props = host(testID)
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId,
          epoch,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      })
      props.onNativeObservationStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId,
          epoch,
          observationRevision: props.observationRevision,
          ready,
          windowActive: true,
        },
      })
    })
  }
}
export const observeToasterKey = async (extra: Record<string, unknown> = {}, targetTag = 0, testID = "host") => {
  const props = host(testID)
  const event = {
    nativeEvent: {
      ownerId: props.ownerId,
      windowId: props.acceptedWindowId,
      epoch: props.acceptedEpoch,
      observationRevision: props.observationRevision,
      eventId: ++eventId,
      observerIds: props.observations
        .filter((entry: { targetTag: number }) => entry.targetTag === targetTag)
        .map((entry: { id: string }) => entry.id),
      target: targetTag || 17,
      focusedTarget: 17,
      key: "q",
      code: "KeyE",
      nativeCode: 8,
      legacyKeyCode: 69,
      location: 0,
      repeat: false,
      cancelled: false,
      isComposing: false,
      shiftKey: false,
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      defaultCaptured: false,
      timestamp: 100,
      ...extra,
    },
  }
  await act(() => props.onNativeObservedKey(event))
  return event
}
