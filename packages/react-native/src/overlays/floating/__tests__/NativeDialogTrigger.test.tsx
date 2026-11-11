import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useContext, type ContextType } from "react"
import { Pressable, type GestureResponderEvent } from "react-native"

import { Button } from "../../../components/Button/Button"
import { ClickPopover } from "../../../components/ClickPopover/ClickPopover"
import { NativeDialogContext, NativeOverlayTriggerStateContext } from "../../../components/ClickPopover/context"
import { NativeRootMenuTriggerStateContext } from "../../../components/Menu/context"
import { Text } from "../../../components/Text/Text"
import {
  NativeDialogTrigger,
  type TNativeDialogTriggerProps,
  type TNativeDialogTriggerRenderState,
} from "../NativeDialogTrigger"
import { NativeFloatingLayerHost } from "../NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../scope"

const trigger = ({ triggerProps }: TNativeDialogTriggerRenderState) => <Button {...triggerProps}>Open</Button>
const children = ({ isOpen }: TNativeDialogTriggerRenderState) => <Text testID="state">{String(isOpen)}</Text>
const fixture = (props: Partial<TNativeDialogTriggerProps> = {}) => (
  <NativeDialogTrigger trigger={trigger} {...props}>
    {props.children ?? children}
  </NativeDialogTrigger>
)

it("preserves inherited popup focus strategy and expanded keys during batched requests", async () => {
  let shared: ContextType<typeof NativeRootMenuTriggerStateContext>
  const Probe = () => {
    shared = useContext(NativeRootMenuTriggerStateContext)
    return null
  }
  const onOpenChange = jest.fn()
  await render(fixture({ onOpenChange, children: <Probe /> }))
  await act(() => {
    shared!.openSubmenu("held", 0)
    shared!.open("first")
    shared!.toggle("last")
  })
  expect(shared!.isOpen).toBe(false)
  expect(shared!.focusStrategy).toBe("last")
  expect(shared!.expandedKeysStack).toEqual(["held"])
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  await act(() => shared!.close())
  expect(shared!.expandedKeysStack).toEqual([])
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it.each([
  ["toggle", false],
  ["toggle", true],
  ["explicit", false],
  ["explicit", true],
  ["setOpen", false],
  ["setOpen", true],
] as const)("composes shared popup %s then toggle from %s", async (action, defaultOpen) => {
  let state: TNativeDialogTriggerRenderState | undefined
  let shared: ContextType<typeof NativeOverlayTriggerStateContext>
  const Probe = () => {
    shared = useContext(NativeOverlayTriggerStateContext)
    return null
  }
  const onOpenChange = jest.fn()
  await render(
    fixture({
      defaultOpen,
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
      children: <Probe />,
    }),
  )
  await act(() => {
    if (action === "toggle") shared!.toggle()
    else if (action === "setOpen") shared!.setOpen(!defaultOpen)
    else if (defaultOpen) shared!.close()
    else shared!.open()
    shared!.toggle()
  })
  expect(state!.isOpen).toBe(defaultOpen)
  expect(onOpenChange.mock.calls).toEqual([[!defaultOpen], [defaultOpen]])
})

it.each(["open", "close", "setOpen(true)", "setOpen(false)", "toggle"] as const)(
  "composes shared popup %s with a retained dialog toggle",
  async (action) => {
    let state: TNativeDialogTriggerRenderState | undefined
    let shared: ContextType<typeof NativeOverlayTriggerStateContext>
    const Probe = () => {
      shared = useContext(NativeOverlayTriggerStateContext)
      return null
    }
    const onOpenChange = jest.fn()
    const defaultOpen = action === "close" || action === "setOpen(false)"
    await render(
      fixture({
        defaultOpen,
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
        children: <Probe />,
      }),
    )
    const retained = state!
    await act(() => {
      if (action === "open") shared!.open()
      else if (action === "close") shared!.close()
      else if (action === "toggle") shared!.toggle()
      else shared!.setOpen(!defaultOpen)
      retained.toggle()
    })
    expect(state!.isOpen).toBe(defaultOpen)
    expect(onOpenChange.mock.calls).toEqual([[!defaultOpen], [defaultOpen]])
  },
)

it.each([false, true])(
  "retains controlled popup context owner %s when followed by a trigger toggle",
  async (isOpen) => {
    let state: TNativeDialogTriggerRenderState | undefined
    let shared: ContextType<typeof NativeOverlayTriggerStateContext>
    const Probe = () => {
      shared = useContext(NativeOverlayTriggerStateContext)
      return null
    }
    const onOpenChange = jest.fn()
    await render(
      fixture({
        isOpen,
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
        children: <Probe />,
      }),
    )
    await act(() => {
      if (isOpen) shared!.close()
      else shared!.open()
      shared!.toggle()
      shared!.toggle()
      state!.toggle()
    })
    expect(state!.isOpen).toBe(isOpen)
    expect(onOpenChange.mock.calls).toEqual([[!isOpen]])
  },
)

it("composes a dialog child close with its retained trigger toggle", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  let closeDialog: (() => void) | undefined
  const onOpenChange = jest.fn()
  await render(
    <NativeFloatingLayerHost>
      {fixture({
        defaultOpen: true,
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
        children: (
          <NativeDialogContext.Provider
            value={{
              children: ({ close }) => {
                closeDialog = close
                return null
              },
            }}
          >
            <ClickPopover />
          </NativeDialogContext.Provider>
        ),
      })}
    </NativeFloatingLayerHost>,
  )
  const retained = state!
  await act(() => {
    closeDialog!()
    retained.toggle()
  })
  expect(state!.isOpen).toBe(true)
  expect(onOpenChange.mock.calls).toEqual([[false], [true]])
})

it.each([false, true])("composes uncontrolled dialog trigger toggles in one batch from %s", async (defaultOpen) => {
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    fixture({
      defaultOpen,
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
    }),
  )
  await act(() => {
    state!.toggle()
    state!.toggle()
  })
  expect(screen.getByTestId("state")).toHaveTextContent(String(defaultOpen))
  expect(onOpenChange.mock.calls).toEqual([[!defaultOpen], [defaultOpen]])
})

it("composes explicit dialog trigger requests and retained native presses in call order", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    fixture({
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
    }),
  )
  const retained = state!
  const event = { nativeEvent: {} } as GestureResponderEvent
  await act(() => {
    retained.open()
    retained.close()
    retained.triggerProps.onPress(event)
    retained.triggerProps.onPress(event)
  })
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]])
})

it.each([false, true])(
  "retains dialog trigger owner %s through same-batch toggles and explicit requests",
  async (isOpen) => {
    let state: TNativeDialogTriggerRenderState | undefined
    const onOpenChange = jest.fn()
    await render(
      fixture({
        isOpen,
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
      }),
    )
    for (let batch = 0; batch < 2; batch++) {
      await act(() => {
        state!.toggle()
        state!.toggle()
        state!.open()
        state!.close()
      })
      expect(screen.getByTestId("state")).toHaveTextContent(String(isOpen))
      expect(onOpenChange.mock.calls).toEqual(Array.from({ length: batch + 1 }, () => [!isOpen]))
    }
  },
)

it("keeps retained dialog owner actions current after callback replacement", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const first = jest.fn()
  const latest = jest.fn()
  const renderTrigger = (value: TNativeDialogTriggerRenderState) => {
    state = value
    return trigger(value)
  }
  const result = await render(fixture({ onOpenChange: first, trigger: renderTrigger }))
  const retained = state!
  await result.rerender(fixture({ onOpenChange: latest, trigger: renderTrigger }))
  await act(() => {
    retained.toggle()
    retained.toggle()
  })
  expect(first).not.toHaveBeenCalled()
  expect(latest.mock.calls).toEqual([[true], [false]])
  expect(screen.getByTestId("state")).toHaveTextContent("false")
})

it("retains accepted dialog state before a throwing owner callback", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const error = new Error("dialog callback")
  const onOpenChange = jest.fn((next: boolean) => {
    if (next) throw error
  })
  await render(
    fixture({
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
    }),
  )
  await act(() => {
    expect(() => state!.open()).toThrow(error)
    state!.close()
  })
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("preserves controlled false and repeated declined native requests", async () => {
  const onOpenChange = jest.fn()
  await render(fixture({ isOpen: false, defaultOpen: true, onOpenChange }))
  await fireEvent.press(screen.getByRole("button", { name: "Open" }))
  await fireEvent.press(screen.getByRole("button", { name: "Open" }))
  expect(onOpenChange.mock.calls).toEqual([[true], [true]])
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(screen.getByRole("button").props.accessibilityState.expanded).toBe(false)
})

it("preserves controlled true when a close is declined", async () => {
  const onOpenChange = jest.fn()
  await render(fixture({ isOpen: true, onOpenChange }))
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  expect(screen.getByRole("button").props.accessibilityState.expanded).toBe(true)
})

it("reads defaultOpen only at mount and owns subsequent uncontrolled changes", async () => {
  const onOpenChange = jest.fn()
  const result = await render(fixture({ defaultOpen: true, onOpenChange }))
  await result.rerender(fixture({ defaultOpen: false, onOpenChange }))
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  await fireEvent.press(screen.getByRole("button"))
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(onOpenChange.mock.calls).toEqual([[false]])
})

it("provides an actual View ref and preserves the original native trigger event", async () => {
  const onPress = jest.fn()
  let state: TNativeDialogTriggerRenderState | undefined
  await render(
    fixture({
      trigger: (value) => {
        state = value
        return (
          <Button
            {...value.triggerProps}
            onPress={(event) => {
              onPress(event)
              value.triggerProps.onPress(event)
            }}
          >
            Open
          </Button>
        )
      },
    }),
  )
  expect(state?.triggerRef.current?.measureInWindow).toEqual(expect.any(Function))
  const target = screen.getByRole("button")
  const event = {
    nativeEvent: {
      kind: "activation",
      source: "android-click",
      observedAt: 0,
      ownerId: target.props.ownerId,
      target: 17,
      activationId: 1,
      scopeOwnerId: "",
      windowId: "dialog-window",
      epoch: 0,
    },
  }
  await act(() => target.props.onNativeActivation(event))
  expect(onPress.mock.calls[0]?.[0]).toBe(event)
  expect(screen.getByTestId("state")).toHaveTextContent("true")
})

it("allows explicit bindings to core Pressable without rewriting authored children", async () => {
  const authored = <Text testID="authored">Caller-owned content</Text>
  await render(
    fixture({
      trigger: ({ triggerProps, triggerRef, isDisabled }) => (
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Core trigger"
          accessibilityState={triggerProps.accessibilityState}
          disabled={isDisabled}
          onPress={triggerProps.onPress}
        >
          {authored}
        </Pressable>
      ),
    }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Core trigger" }))
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  expect(screen.getByTestId("authored")).toHaveTextContent("Caller-owned content")
})

it("guards disabled native activation while keeping explicit owner actions available", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    fixture({
      isDisabled: true,
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
    }),
  )
  expect(screen.getByRole("button")).toBeDisabled()
  await fireEvent.press(screen.getByRole("button"))
  await act(() => state!.triggerProps.onPress({ nativeEvent: {} } as GestureResponderEvent))
  expect(onOpenChange).not.toHaveBeenCalled()
  await act(() => state!.open())
  expect(onOpenChange).toHaveBeenCalledWith(true)
})

it("checks current scope eligibility at native delivery without changing programmatic ownership", async () => {
  let eligible = false
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    <NativeFloatingScopeContext.Provider value={{ id: "parent", canAct: () => eligible }}>
      {fixture({
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
      })}
    </NativeFloatingScopeContext.Provider>,
  )
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).not.toHaveBeenCalled()
  eligible = true
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).toHaveBeenCalledWith(true)
  eligible = false
  await act(() => state!.close())
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("uses current props/callbacks even when an earlier native handler was retained", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const first = jest.fn()
  const next = jest.fn()
  const renderTrigger = (value: TNativeDialogTriggerRenderState) => {
    state = value
    return trigger(value)
  }
  const result = await render(fixture({ isOpen: false, onOpenChange: first, trigger: renderTrigger }))
  const retained = state!.triggerProps.onPress
  await result.rerender(fixture({ isOpen: true, onOpenChange: next, trigger: renderTrigger }))
  await act(() => retained({ nativeEvent: {} } as GestureResponderEvent))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith(false)
})

it("retires retained handlers and owner actions on keyed replacement and unmount", async () => {
  const states: TNativeDialogTriggerRenderState[] = []
  const onOpenChange = jest.fn()
  const make = (key: string) => (
    <NativeDialogTrigger
      key={key}
      onOpenChange={onOpenChange}
      trigger={(value) => {
        states.push(value)
        return trigger(value)
      }}
    />
  )
  const result = await render(make("first"))
  const old = states[0]!
  await result.rerender(make("replacement"))
  await act(() => {
    old.open()
    old.toggle()
    old.triggerProps.onPress({ nativeEvent: {} } as GestureResponderEvent)
  })
  expect(onOpenChange).not.toHaveBeenCalled()
  const current = states.at(-1)!
  expect(current.triggerProps.nativeID).not.toBe(old.triggerProps.nativeID)
  await result.unmount()
  await act(() => current.open())
  expect(onOpenChange).not.toHaveBeenCalled()
})

it.each([false, true])("rejects a controlled-ownership switch from %s", async (controlled) => {
  const result = await render(fixture({ isOpen: controlled ? false : undefined }))
  await expect(result.rerender(fixture({ isOpen: controlled ? undefined : false }))).rejects.toThrow(
    "changing controlled/uncontrolled ownership",
  )
})

it("checks live native-window eligibility before delivering a retained trigger press", async () => {
  let ready = false
  const onOpenChange = jest.fn()
  await render(
    <NativeFloatingWindowContext.Provider value={() => ready}>
      {fixture({ isOpen: false, onOpenChange })}
    </NativeFloatingWindowContext.Provider>,
  )
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).not.toHaveBeenCalled()
  ready = true
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange.mock.calls).toEqual([[true]])
  expect(screen.getByTestId("state")).toHaveTextContent("false")
})
