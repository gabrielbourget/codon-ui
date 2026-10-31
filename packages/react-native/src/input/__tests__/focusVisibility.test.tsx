import { act, render, screen } from "@testing-library/react-native"
import { Linking } from "react-native"

import { Button, Link, NativeFloatingLayerHost } from "../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it.each(["button", "link"] as const)(
  "keeps actual %s focus separate from keyboard-visible rings and preserves owner overrides",
  async (role) => {
    const onFocus = jest.fn(),
      onBlur = jest.fn(),
      states: boolean[] = []
    const shared = {
      onFocus,
      onBlur,
      onPress: (event: { preventDefault: () => void }) => event.preventDefault(),
      style: (state: { isFocused: boolean }) => {
        states.push(state.isFocused)
        return {}
      },
    }
    await render(
      role === "button" ? (
        <Button {...shared}>Target</Button>
      ) : (
        <Link {...shared} href="">
          Target
        </Link>
      ),
    )
    const root = () => screen.getByRole(role)
    const focus = {
      nativeEvent: {
        ownerId: root().props.ownerId,
        target: 17,
        isFocused: true,
        isFocusVisible: false,
        origin: "programmatic",
        timestamp: 0,
      },
    }
    await act(() => root().props.onNativeFocusChange(focus))
    expect(states.at(-1)).toBe(true)
    expect(root()).not.toHaveStyle({ outlineWidth: 1.5 })
    expect(onFocus.mock.calls).toEqual([[focus]])
    const key = {
      persist: jest.fn(),
      nativeEvent: {
        kind: "keyboard",
        ownerId: root().props.ownerId,
        target: 17,
        key: "Shift",
        nativeCode: 225,
        phase: "down",
        nativeDefaultHandled: false,
        timestamp: 0,
      },
    }
    await act(() => root().props.onNativeKey(key))
    expect(root()).toHaveStyle({ outlineWidth: 1.5 })
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(focus.nativeEvent.isFocusVisible).toBe(false)
    let prevented = false
    const touch = {
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
      persist: jest.fn(),
      currentTarget: 17,
      target: 17,
      nativeEvent: { target: 17, identifier: 0, timestamp: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
    }
    await act(() => root().props.onResponderGrant(touch))
    expect(root()).not.toHaveStyle({ outlineWidth: 1.5 })
    expect(states.at(-1)).toBe(true)
    await act(() => root().props.onResponderRelease(touch))
    await act(() => jest.runOnlyPendingTimers())
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).not.toHaveBeenCalled()
    const override = { ...shared, style: { outlineWidth: 3, outlineColor: "red" } }
    await screen.rerender(
      role === "button" ? (
        <Button {...override}>Target</Button>
      ) : (
        <Link {...override} href="">
          Target
        </Link>
      ),
    )
    expect(root()).toHaveStyle({ outlineWidth: 3, outlineColor: "red" })
  },
)

it.each(["button", "link"] as const)(
  "observes same-window input changes for a focused %s without extra focus callbacks or key-policy changes",
  async (role) => {
    const onFocus = jest.fn()
    await render(
      <NativeFloatingLayerHost testID="window">
        {role === "button" ? (
          <Button onFocus={onFocus}>Target</Button>
        ) : (
          <Link href="" onFocus={onFocus}>
            Target
          </Link>
        )}
      </NativeFloatingLayerHost>,
    )
    const host = () => screen.getByTestId("window").props
    const status = async (ready: boolean) =>
      act(() =>
        host().onNativeScopeStatus({
          nativeEvent: {
            ownerId: host().ownerId,
            windowId: "actual-window",
            epoch: 1,
            policyRevision: host().policyRevision,
            windowActive: true,
            ready,
          },
        }),
      )
    await status(false)
    await status(true)
    const revision = host().policyRevision
    const input = async (origin: "keyboard" | "pointer", timestamp: number, ownerId = host().ownerId) =>
      act(() =>
        host().onNativeInputModality({
          nativeEvent: { ownerId, windowId: "actual-window", epoch: 1, origin, timestamp },
        }),
      )
    await input("keyboard", 0)
    const root = () => screen.getByRole(role)
    const focus = {
      nativeEvent: {
        ownerId: root().props.ownerId,
        target: 17,
        isFocused: true,
        isFocusVisible: true,
        origin: "keyboard",
        timestamp: 0,
      },
    }
    await act(() => root().props.onNativeFocusChange(focus))
    expect(root()).toHaveStyle({ outlineWidth: 1.5 })
    await input("pointer", 1)
    expect(root()).not.toHaveStyle({ outlineWidth: 1.5 })
    await input("keyboard", 2, "foreign-owner")
    expect(root()).not.toHaveStyle({ outlineWidth: 1.5 })
    await input("keyboard", 2)
    expect(root()).toHaveStyle({ outlineWidth: 1.5 })
    expect(onFocus.mock.calls).toEqual([[focus]])
    expect(host().policyRevision).toBe(revision)
  },
)
