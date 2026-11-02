import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useState } from "react"
import type { View } from "react-native"
import { StyleSheet, TextInput } from "react-native"

import { NativeSelectionIndicatorContext } from "../../../collection/context"
import { geometryPacket, geometrySnapshot } from "../../../input/__tests__/motionGeometry.fixture"
import * as Geometry from "../../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../../input/motionGeometry"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeMotionConfig } from "../../../motion/config"
import { frameData, MotionGlobalConfig, time } from "../../../motion/kernel"
import * as InitialValue from "../../../motion/measurement/initialValue"
import { SharedElementTransition } from "../../SharedElementTransition/SharedElementTransition"
import { ToggleButton } from "../../ToggleButton/ToggleButton"
import { renderWithToggleKeyboard } from "../../ToggleButtonGroup/__tests__/keyboard-fixture"
import { ToggleButtonGroup } from "../../ToggleButtonGroup/ToggleButtonGroup"
import { NativeSelectionIndicatorPropsContext } from "../context"
import { SelectionIndicator } from "../SelectionIndicator"
import type { TNativeSelectionIndicatorProps } from "../types"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
let nextX = 10
let epoch = 2
let records = new WeakMap<View, TNativeMotionGeometryRecord>()
let geometryListeners = new Map<View, (record: TNativeMotionGeometryRecord) => void>()
const record = (view: View) => {
  let current = records.get(view)
  if (!current) {
    const snapshot = geometrySnapshot()
    const box = { box: [nextX, 20, 100, 50], quad: [nextX, 20, nextX + 100, 20, nextX + 100, 70, nextX, 70] }
    current = {
      ...geometryPacket({ epoch }),
      snapshot: Geometry.decodeNativeMotionGeometry(JSON.stringify({ ...snapshot, model: box, presentation: box })),
    }
    records.set(view, current)
  }
  return current
}
const settle = async () =>
  act(async () => {
    for (let index = 0; index < 12; index++) await Promise.resolve()
  })
const flush = async (timestamp: number) =>
  act(async () => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
    for (let index = 0; index < 12; index++) await Promise.resolve()
  })
const style = (id = "indicator") => StyleSheet.flatten(screen.getByTestId(id).props.style)
const example = (props: TNativeSelectionIndicatorProps) => (
  <SharedElementTransition>
    <SelectionIndicator testID="indicator" {...props} />
  </SharedElementTransition>
)
beforeEach(() => {
  nextX = 10
  epoch = 2
  records = new WeakMap()
  geometryListeners = new Map()
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (typeof id === "number") frames.delete(id)
  })
  jest.spyOn(Geometry, "observeNativeMotionGeometry").mockImplementation((view, callback) => {
    if (view) {
      geometryListeners.set(view, callback)
      callback(record(view))
    }
    return () => {
      if (view) geometryListeners.delete(view)
    }
  })
  jest.spyOn(Geometry, "readNativeMotionGeometry").mockImplementation(async (view) => {
    if (!view) throw new Error("Expected original view")
    return record(view)
  })
})
afterEach(async () => {
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("requires a scope even when the indicator is hidden", async () => {
  await expect(render(<SelectionIndicator isSelected={false} />)).rejects.toThrow(
    "SharedElementTransition scope is required",
  )
})

it("renders no host for an initially unselected indicator", async () => {
  await render(example({ isSelected: false }))
  expect(screen.queryByTestId("indicator")).toBeNull()
})

it("uses a headless group scope and independent selected indicators for multiple selection", async () => {
  await renderWithToggleKeyboard(
    <ToggleButtonGroup selectionMode="multiple" defaultSelectedKeys={[0, "0"]}>
      <ToggleButton id={0} aria-label="First">
        <SelectionIndicator testID="first" />
      </ToggleButton>
      <ToggleButton id="0" aria-label="Second">
        <SelectionIndicator testID="second" />
      </ToggleButton>
      <ToggleButton id="" aria-label="Third">
        <SelectionIndicator testID="third" />
      </ToggleButton>
    </ToggleButtonGroup>,
  )
  expect(screen.getByTestId("first")).toBeOnTheScreen()
  expect(screen.getByTestId("second")).toBeOnTheScreen()
  expect(screen.queryByTestId("third")).toBeNull()
  const group = screen.getAllByTestId("toggle-button-group")
  expect(group).toHaveLength(1)
  expect(group[0].props).toMatchObject({ role: "toolbar", accessible: false })
})

it("merges default named and null props/ref slots while explicit selection wins", async () => {
  const inherited = createRef<View>(),
    own = createRef<View>()
  const { unmount } = await render(
    <SharedElementTransition>
      <NativeSelectionIndicatorPropsContext.Provider
        value={{ slots: { named: { isSelected: true, ref: inherited, style: { opacity: 0.4 } } } }}
      >
        <SelectionIndicator ref={own} slot="named" testID="named" style={{ opacity: 0.7 }} />
        <SelectionIndicator slot="named" isSelected={false} testID="explicit-hidden" />
        <SelectionIndicator slot={null} testID="unslotted" />
      </NativeSelectionIndicatorPropsContext.Provider>
    </SharedElementTransition>,
  )
  expect(style("named").opacity).toBe(0.7)
  expect(inherited.current).not.toBeNull()
  expect(own.current).toBe(inherited.current)
  expect(screen.queryByTestId("explicit-hidden")).toBeNull()
  expect(screen.queryByTestId("unslotted")).toBeNull()
  await unmount()
  expect(own.current).toBeNull()
  expect(inherited.current).toBeNull()
})

it("retains the legacy boolean selection context and explicit false override", async () => {
  await render(
    <SharedElementTransition>
      <NativeSelectionIndicatorContext.Provider value={{ isSelected: true }}>
        <SelectionIndicator testID="legacy" />
        <SelectionIndicator isSelected={false} testID="override" />
      </NativeSelectionIndicatorContext.Provider>
    </SharedElementTransition>,
  )
  expect(screen.getByTestId("legacy")).toBeOnTheScreen()
  expect(screen.queryByTestId("override")).toBeNull()
})

it("keeps its original root editor and current renderer through enter and ordinary style updates", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    requests = jest.fn()
  const node = (opacity: number) => (
    <SharedElementTransition>
      <SelectionIndicator
        ref={root}
        testID="indicator"
        isSelected
        style={{ opacity }}
        render={(props) => <NativeFocusHost {...props} />}
      >
        <TextInput ref={editor} testID="editor" value="held" onChangeText={requests} />
      </SelectionIndicator>
    </SharedElementTransition>
  )
  await render(node(1))
  await settle()
  const original = root.current,
    originalEditor = editor.current
  expect(original).not.toBeNull()
  await flush(1016)
  await screen.rerender(node(0.5))
  expect(root.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("editor")).toHaveDisplayValue("held")
  expect(requests).not.toHaveBeenCalled()
})

it("exposes entering for one frame without inventing an animation or spring", async () => {
  await render(example({ isSelected: true, children: ({ isEntering, isExiting }) => `${isEntering}/${isExiting}` }))
  await settle()
  expect(screen.getByText("true/false")).toBeOnTheScreen()
  await flush(1016)
  expect(screen.getByText("false/false")).toBeOnTheScreen()
})

it("does not expand all into opacity transitions", async () => {
  await render(example({ isSelected: true, transition: { duration: 1 }, style: { opacity: 0.2 } }))
  await flush(1016)
  await screen.rerender(example({ isSelected: true, transition: { duration: 1 }, style: { opacity: 0.8 } }))
  expect(style().opacity).toBe(0.8)
})

it("waits for actual authored exit playback before hiding and retires it when reselected", async () => {
  const props = (selected: boolean): TNativeSelectionIndicatorProps => ({
    isSelected: selected,
    transitionProperties: ["opacity"],
    transition: { duration: 0.2, ease: "linear" },
    style: ({ isExiting }) => ({ opacity: isExiting ? 0 : 1 }),
  })
  await render(example(props(true)))
  await flush(1016)
  await screen.rerender(example(props(false)))
  await settle()
  expect(screen.getByTestId("indicator")).toBeOnTheScreen()
  await flush(1116)
  expect(style().opacity).toBeGreaterThan(0)
  expect(style().opacity).toBeLessThan(1)
  await screen.rerender(example(props(true)))
  await flush(1416)
  expect(screen.getByTestId("indicator")).toBeOnTheScreen()
  expect(style().opacity).toBe(1)
})

it("hides after the actual zero-duration exit and clears the original ref", async () => {
  const ref = createRef<View>()
  const node = (selected: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator ref={ref} isSelected={selected} testID="indicator" />
    </SharedElementTransition>
  )
  await render(node(true))
  await flush(1016)
  expect(ref.current).not.toBeNull()
  await screen.rerender(node(false))
  await settle()
  await flush(1032)
  expect(screen.queryByTestId("indicator")).toBeNull()
  expect(ref.current).toBeNull()
})

it("hands off only authored values and explicit translate from actual original rectangles", async () => {
  const node = (second: boolean) => (
    <SharedElementTransition>
      {second ? (
        <SelectionIndicator
          key="b"
          testID="indicator"
          isSelected
          transitionProperties={["opacity", "translate"]}
          transition={{ duration: 1, ease: "linear" }}
          style={{ opacity: 0.8 }}
        />
      ) : (
        <SelectionIndicator
          key="a"
          testID="indicator"
          isSelected
          transitionProperties={["opacity", "translate"]}
          transition={{ duration: 1, ease: "linear" }}
          style={{ opacity: 0.2 }}
        />
      )}
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  nextX = 50
  await screen.rerender(node(true))
  await settle()
  expect(Geometry.readNativeMotionGeometry).toHaveBeenCalled()
  await flush(1032)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: -40 }]))
  await flush(1532)
  expect(style().opacity).toBeGreaterThan(0.2)
  expect(style().opacity).toBeLessThan(0.8)
})

it("disables snapshot handoff with none", async () => {
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={["none"]}
        style={{ opacity: second ? 0.8 : 0.2 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  await screen.rerender(node(true))
  await settle()
  expect(style().opacity).toBe(0.8)
  expect(Geometry.readNativeMotionGeometry).not.toHaveBeenCalled()
})

it("rejects a snapshot from an old window epoch", async () => {
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={["opacity"]}
        transition={{ duration: 1 }}
        style={{ opacity: second ? 0.8 : 0.2 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  epoch = 3
  await screen.rerender(node(true))
  await settle()
  expect(style().opacity).toBe(0.8)
})

it("honors the existing always Reduce Motion policy without holding a hidden completion timer", async () => {
  const node = (selected: boolean) => (
    <NativeMotionConfig reducedMotion="always">
      <SharedElementTransition>
        <SelectionIndicator
          testID="indicator"
          isSelected={selected}
          transitionProperties={["opacity"]}
          transition={{ duration: 10 }}
          style={({ isExiting }) => ({ opacity: isExiting ? 0 : 1 })}
        />
      </SharedElementTransition>
    </NativeMotionConfig>
  )
  await render(node(true))
  await flush(1016)
  await screen.rerender(node(false))
  await settle()
  await flush(1032)
  expect(screen.queryByTestId("indicator")).toBeNull()
})

it("does not apply an incoming snapshot to a receiver declaring none", async () => {
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={second ? ["none"] : ["opacity"]}
        transition={{ duration: 1 }}
        style={{ opacity: second ? 0.8 : 0.2 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  await screen.rerender(node(true))
  await settle()
  expect(style().opacity).toBe(0.8)
  expect(Geometry.readNativeMotionGeometry).not.toHaveBeenCalled()
})

it("restores an absent authored property from the actual new native host and removes the temporary binding", async () => {
  const nativeRead = jest.spyOn(InitialValue, "readNativeMotionInitialValue").mockResolvedValue(0.6)
  const ref = createRef<View>()
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        ref={ref}
        testID="indicator"
        isSelected
        transitionProperties={["opacity"]}
        transition={{ duration: 0.2, ease: "linear" }}
        style={second ? {} : { opacity: 0.2 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  await screen.rerender(node(true))
  await settle()
  expect(nativeRead).toHaveBeenCalledWith(ref.current, "opacity", undefined, expect.any(Object))
  await flush(1032)
  await flush(1132)
  expect(style().opacity).toBeGreaterThan(0.2)
  expect(style().opacity).toBeLessThan(0.6)
  await flush(1332)
  await flush(1348)
  expect(style().opacity).toBeUndefined()
})

it("composes the handoff offset with caller transforms without mutating their original array", async () => {
  const transform = [{ scale: 2 }, { translateX: 5 }]
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={["translate"]}
        transition={{ duration: 1 }}
        style={{ transform }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  nextX = 50
  await screen.rerender(node(true))
  await settle()
  await flush(1032)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: -40 }, { scale: 2 }, { translateX: 5 }]))
  expect(transform).toEqual([{ scale: 2 }, { translateX: 5 }])
})

it("retires an in-flight original geometry read at unmount", async () => {
  let release!: (value: TNativeMotionGeometryRecord) => void
  const read = jest.spyOn(Geometry, "readNativeMotionGeometry").mockImplementation(
    (view) =>
      new Promise((resolve) => {
        release = () => resolve(record(view!))
      }),
  )
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator key={String(second)} testID="indicator" isSelected transitionProperties={["translate"]} />
    </SharedElementTransition>
  )
  const { unmount } = await render(node(false))
  await flush(1016)
  await screen.rerender(node(true))
  await settle()
  expect(read).toHaveBeenCalledTimes(1)
  await unmount()
  await act(() => release({} as TNativeMotionGeometryRecord))
  await flush(2000)
  expect(screen.queryByTestId("indicator")).toBeNull()
})

it("starts authored entering paint immediately before transitioning to the visible target", async () => {
  await render(
    example({
      isSelected: true,
      transitionProperties: ["opacity"],
      transition: { duration: 1, ease: "linear" },
      style: ({ isEntering }) => ({ opacity: isEntering ? 0 : 1 }),
    }),
  )
  await settle()
  expect(style().opacity).toBe(0)
  await flush(1016)
  await flush(1516)
  expect(style().opacity).toBeGreaterThan(0)
  expect(style().opacity).toBeLessThan(1)
})

it("removes a formerly authored property without retaining a stale motion override", async () => {
  const node = (authored: boolean) =>
    example({
      isSelected: true,
      transitionProperties: ["opacity"],
      transition: { duration: 1 },
      style: authored ? { opacity: 0.2 } : {},
    })
  await render(node(true))
  await flush(1016)
  await screen.rerender(node(false))
  await settle()
  expect(style().opacity).toBeUndefined()
})

it("does not invent a position handoff when the old indicator did not author translate", async () => {
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={second ? ["opacity", "translate"] : ["opacity"]}
        transition={{ duration: 1 }}
        style={{ opacity: second ? 0.8 : 0.2 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  nextX = 50
  await screen.rerender(node(true))
  await settle()
  await flush(1032)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: 0 }, { translateY: 0 }]))
})

it("clears an active temporary translation when none disables the transition", async () => {
  const node = (second: boolean, disabled = false) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        testID="indicator"
        isSelected
        transitionProperties={disabled ? ["none"] : ["translate"]}
        transition={{ duration: 1 }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  nextX = 50
  await screen.rerender(node(true))
  await settle()
  await flush(1032)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: -40 }]))
  await screen.rerender(node(true, true))
  await screen.rerender(node(true))
  await flush(1048)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: 0 }, { translateY: 0 }]))
})

it("retires an active original-window handoff on an epoch change without stale offset writes", async () => {
  const ref = createRef<View>()
  const node = (second: boolean) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(second)}
        ref={ref}
        testID="indicator"
        isSelected
        transitionProperties={["translate"]}
        transition={{ duration: 1, ease: "linear" }}
      />
    </SharedElementTransition>
  )
  await render(node(false))
  await flush(1016)
  nextX = 50
  await screen.rerender(node(true))
  await settle()
  await flush(1032)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: -40 }]))
  await act(() => {
    const previous = records.get(ref.current!)!
    const next = { ...previous, epoch: previous.epoch + 1 }
    records.set(ref.current!, next)
    geometryListeners.get(ref.current!)!(next)
  })
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: 0 }, { translateY: 0 }]))
  await flush(1532)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: 0 }, { translateY: 0 }]))
})

it("composes controlled typed selection veto and echo with the same group member editor and indicator roots", async () => {
  const root = createRef<View>(),
    member = createRef<View>(),
    editor = createRef<TextInput>(),
    indicator = createRef<View>(),
    requests = jest.fn(),
    presses = jest.fn()
  const Draft = () => {
    const [draft, setDraft] = useState("original")
    return <TextInput testID="draft" ref={editor} value={draft} onChangeText={setDraft} />
  }
  const node = (selected: readonly (string | number)[]) => (
    <ToggleButtonGroup ref={root} selectedKeys={selected} onSelectionChange={requests}>
      <ToggleButton id={0} aria-label="Number">
        <SelectionIndicator testID="first" transitionProperties={["translate"]} />
      </ToggleButton>
      <ToggleButton id="0" aria-label="String" ref={member} onPress={presses}>
        <SelectionIndicator
          ref={indicator}
          testID="second"
          transitionProperties={["translate"]}
          transition={{ duration: 0.2, ease: "linear" }}
        />
      </ToggleButton>
      <Draft />
    </ToggleButtonGroup>
  )
  await render(node([0]))
  await flush(1016)
  const originalRoot = root.current,
    originalMember = member.current,
    originalEditor = editor.current
  await fireEvent.changeText(screen.getByTestId("draft"), "kept draft")
  const activate = async (activationId: number) => {
    const button = screen.getByRole("button", { name: "String" })
    const event = {
      persist: jest.fn(),
      nativeEvent: {
        kind: "activation",
        ownerId: button.props.ownerId,
        target: 17,
        source: "android-click",
        observedAt: 10,
        activationId,
        scopeOwnerId: "",
        windowId: "group-window",
        epoch: 0,
      },
    }
    await act(() => button.props.onNativeActivation(event))
    expect(presses.mock.calls.at(-1)![0]).toBe(event)
  }
  await activate(1)
  await activate(2)
  expect(requests.mock.calls.map(([keys]) => [...keys])).toEqual([["0"], ["0"]])
  expect(screen.queryByTestId("second")).toBeNull()
  expect(screen.getByTestId("first")).toBeOnTheScreen()
  nextX = 50
  await screen.rerender(node(["0"]))
  await settle()
  await flush(1032)
  expect(screen.queryByTestId("first")).toBeNull()
  expect(style("second").transform).toEqual(expect.arrayContaining([{ translateX: -40 }]))
  const originalIndicator = indicator.current
  expect(originalIndicator).not.toBeNull()
  await flush(1332)
  await screen.rerender(node(["0"]))
  expect(root.current).toBe(originalRoot)
  expect(member.current).toBe(originalMember)
  expect(editor.current).toBe(originalEditor)
  expect(indicator.current).toBe(originalIndicator)
  expect(screen.getByTestId("draft")).toHaveDisplayValue("kept draft")
  expect(screen.getByRole("button", { name: "Number" }).props.accessibilityState.checked).toBe(false)
  expect(screen.getByRole("button", { name: "String" }).props.accessibilityState.checked).toBe(true)
})

it("retires an unconsumed snapshot after exit completes instead of handing off a long-hidden indicator", async () => {
  const node = (selected: boolean, replacement = false) => (
    <SharedElementTransition>
      <SelectionIndicator
        key={String(replacement)}
        testID="indicator"
        isSelected={selected}
        transitionProperties={["translate"]}
      />
    </SharedElementTransition>
  )
  await render(node(true))
  await flush(1016)
  await screen.rerender(node(false))
  await settle()
  await flush(1032)
  expect(screen.queryByTestId("indicator")).toBeNull()
  nextX = 50
  await screen.rerender(node(true, true))
  await settle()
  expect(Geometry.readNativeMotionGeometry).not.toHaveBeenCalled()
  await flush(1048)
  expect(style().transform).toEqual(expect.arrayContaining([{ translateX: 0 }, { translateY: 0 }]))
})

it("honors an authored spring without replacing it with the zero default timing", async () => {
  await render(
    example({
      isSelected: true,
      transitionProperties: ["opacity"],
      transition: { type: "spring", stiffness: 100, damping: 20 },
      style: ({ isEntering }) => ({ opacity: isEntering ? 0 : 1 }),
    }),
  )
  await settle()
  expect(style().opacity).toBe(0)
  await flush(1016)
  await flush(1116)
  expect(style().opacity).toBeGreaterThan(0)
  expect(style().opacity).toBeLessThan(1)
})

it("retires property-specific playback under the same always Reduce Motion policy", async () => {
  const node = (selected: boolean) => (
    <NativeMotionConfig reducedMotion="always">
      <SharedElementTransition>
        <SelectionIndicator
          testID="indicator"
          isSelected={selected}
          transitionProperties={["opacity"]}
          transition={{ opacity: { duration: 10 } }}
          style={({ isExiting }) => ({ opacity: isExiting ? 0 : 1 })}
        />
      </SharedElementTransition>
    </NativeMotionConfig>
  )
  await render(node(true))
  await flush(1016)
  await screen.rerender(node(false))
  await settle()
  await flush(1032)
  expect(screen.queryByTestId("indicator")).toBeNull()
})
