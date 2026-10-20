import { screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import { Button, NativeThemeProvider, Text } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"
import type { TNativeTagGroupEmptyState, TNativeTagGroupProps } from "../types"
import type { TNativeGroupedTagState } from "../visualTypes"

const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
const node = (
  props: TNativeTagGroupProps = {},
  children: ReactNode = (
    <Tag id={0} testID="zero">
      Zero
    </Tag>
  ),
  mode: "light" | "dark" = "light",
) => (
  <NativeThemeProvider mode={mode}>
    <TagGroup {...props}>{children}</TagGroup>
  </NativeThemeProvider>
)
const gesture = () => {
  let prevented = false
  return {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
    nativeEvent: { target: 17, timestamp: 100, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
}
const press = async (id: string) => {
  const target = row(id),
    event = gesture()
  await act(() => target.props.onResponderGrant(event))
  await act(() => target.props.onResponderRelease(event))
  return event
}

it("binds an authored remove-slot button to the current tag and preserves the original caller event", async () => {
  const remove = jest.fn(),
    caller = jest.fn()
  await render(
    node(
      { onRemove: remove },
      <Tag id="a" textValue="Alpha">
        <Button slot="remove" testID="custom-remove" onPress={caller}>
          Custom removal
        </Button>
      </Tag>,
    ),
  )
  expect(row("custom-remove").props.accessibilityLabel).toBe("Remove Alpha")
  const event = await press("custom-remove")
  expect(remove.mock.calls).toEqual([[new Set(["a"])]])
  expect(caller).toHaveBeenCalledTimes(1)
  expect(caller.mock.calls[0][0]).toBe(event)
})

it("retains a null-slot button's own action independently of tag removal", async () => {
  const remove = jest.fn(),
    caller = jest.fn()
  await render(
    node(
      { onRemove: remove },
      <Tag id="a" textValue="Alpha">
        <Button slot={null} testID="independent-action" onPress={caller}>
          Independent
        </Button>
      </Tag>,
    ),
  )
  await press("independent-action")
  expect(caller).toHaveBeenCalledTimes(1)
  expect(remove).not.toHaveBeenCalled()
})
const key = async (id: string, value: string, phase: "down" | "up", extra: Record<string, unknown> = {}) => {
  const target = row(id)
  let prevented = false
  const event = {
    preventDefault: jest.fn(() => {
      prevented = true
    }),
    isDefaultPrevented: () => prevented,
    nativeEvent: {
      kind: "keyboard",
      ownerId: target.props.ownerId,
      target: 17,
      key: value,
      phase,
      repeat: false,
      cancelled: false,
      nativeDefaultHandled: true,
      nativeCode: 66,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      timestamp: 100,
      ...extra,
    },
  }
  await act(() => target.props.onNativeKey(event))
  return event
}
const focus = async (id: string, isFocused: boolean, isFocusVisible = true) => {
  const target = row(id)
  const event = {
    nativeEvent: {
      ownerId: target.props.ownerId,
      target: 17,
      isFocused,
      isFocusVisible,
      origin: "keyboard",
      timestamp: 100,
    },
  }
  await act(() => target.props.onNativeFocusChange(event))
  return event
}
beforeEach(() => {
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
})

it("retains the actual native item ref across passive and selectable modes", async () => {
  const ref = createRef<RN.View>()
  const item = (
    <Tag id="a" ref={ref}>
      Alpha
    </Tag>
  )
  const view = await render(node({ selectionMode: "none" }, item))
  const original = ref.current
  await view.rerender(node({ selectionMode: "multiple" }, item))
  expect(ref.current === original).toBe(true)
  await view.rerender(node({ selectionMode: "none" }, item))
  expect(ref.current === original).toBe(true)
})
it("cancels a held press when the same native row becomes passive", async () => {
  const ref = createRef<RN.View>(),
    change = jest.fn(),
    end = jest.fn()
  const item = (
    <Tag id={0} testID="zero" ref={ref} onPressEnd={end}>
      Zero
    </Tag>
  )
  const view = await render(node({ selectionMode: "multiple", selectedKeys: [], onSelectionChange: change }, item))
  const original = ref.current
  const active = row("zero").props
  const event = gesture()
  await act(() => active.onResponderGrant(event))
  await view.rerender(node({ selectionMode: "none", selectedKeys: [], onSelectionChange: change }, item))
  await act(() => active.onResponderRelease(event))
  expect(ref.current === original).toBe(true)
  expect(change).not.toHaveBeenCalled()
  expect(end).toHaveBeenCalledTimes(1)
  expect(end.mock.calls[0][0] === event).toBe(true)
  expect(row("zero").props.onResponderGrant).toBeUndefined()
})

it("retains explicit text values on composed items and their removal labels after collection reception", async () => {
  const remove = jest.fn()
  await render(
    node(
      { onRemove: remove },
      <Tag id={0} testID="composed" textValue="Alpha">
        <Text>Visual content</Text>
      </Tag>,
    ),
  )
  expect(row("composed").props.accessibilityLabel).toBe("Alpha")
  expect(row("tag-remove-button").props.accessibilityLabel).toBe("Remove Alpha")
  expect(screen.getByText("Visual content")).toBeOnTheScreen()
  await press("tag-remove-button")
  expect([...remove.mock.calls[0][0]]).toEqual([0])
  expect(row("composed")).toBeOnTheScreen()
})

it("CAP.tag-group.001 and item.001 forwards actual root and grouped-item native refs", async () => {
  const root = createRef<RN.View>(),
    item = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <TagGroup ref={root}>
        <Tag ref={item} id={0}>
          Zero
        </Tag>
      </TagGroup>
    </NativeThemeProvider>,
  )
  expect(root.current).not.toBeNull()
  expect(item.current).not.toBeNull()
  expect(root.current === item.current).toBe(false)
  expect(row("tag-list").props.role).toBe("grid")
  expect(row("tag").props.role).toBe("row")
  expect(row("tag").props.nativePressable).toBeUndefined()
  expect(screen.getByText("Zero")).toBeOnTheScreen()
})
it("CAP.tag-group.002–.005 and item.002/.009/.010 retains each rendered style owner", async () => {
  await render(
    node(
      {
        width: 0,
        height: "50%",
        orientation: "vertical",
        customStyles: { width: 22, backgroundColor: "red" },
        style: { width: 33 },
        customTagListStyles: { gap: 0 },
      },
      <Tag
        id={0}
        testID="zero"
        width={0}
        height={0}
        customStyles={{ color: "orange", padding: 0 }}
        style={{ width: 7, color: "purple" }}
      >
        Zero
      </Tag>,
    ),
  )
  expect(RN.StyleSheet.flatten(row("tag-group").props.style)).toMatchObject({
    width: 33,
    height: "50%",
    backgroundColor: "red",
  })
  expect(RN.StyleSheet.flatten(row("tag-list").props.style)).toMatchObject({
    width: 0,
    height: "50%",
    gap: 0,
    flexDirection: "column",
    flexWrap: "wrap",
  })
  expect(RN.StyleSheet.flatten(row("zero").props.style)).toMatchObject({ width: 7, height: 0, padding: 0 })
  expect(RN.StyleSheet.flatten(screen.getByText("Zero").props.style).color).toBe("purple")
})
it("CAP.tag-group.006 keeps explicit empty renderer precedence, including null and empty message", async () => {
  const empty = jest.fn<ReactNode, [TNativeTagGroupEmptyState]>(() => <Text>Explicit empty</Text>)
  const view = await render(node({ renderEmptyState: empty, emptyListMessage: "Fallback" }, null))
  expect(screen.getByText("Explicit empty")).toBeOnTheScreen()
  expect(screen.queryByText("Fallback")).toBeNull()
  const emptyState = empty.mock.calls.at(-1)![0]
  expect(emptyState.isEmpty).toBe(true)
  expect(emptyState.isFocused).toBe(false)
  expect(emptyState.isFocusVisible).toBe(false)
  expect(emptyState.state.collection.size).toBe(0)
  expect(emptyState.state.selectionManager.focusedKey).toBeNull()
  expect(emptyState.state.selectionManager.selectionMode).toBe("none")
  expect(emptyState.state.selectionManager.selectionBehavior).toBe("toggle")

  await view.rerender(node({ renderEmptyState: () => null, emptyListMessage: "Fallback" }, null))
  expect(screen.queryByText("Fallback")).toBeNull()
  await view.rerender(node({ emptyListMessage: "Fallback" }, null))
  expect(screen.getByText("Fallback")).toBeOnTheScreen()
  await view.rerender(node({ emptyListMessage: "" }, null))
  expect(screen.queryByText("Fallback")).toBeNull()
})
it("CAP.tag-group.007 and item.011 consume family props on actual hosts", async () => {
  await render(
    node(
      {
        selectionMode: "multiple",
        selectedKeys: [],
        disabledKeys: [],
        orientation: "vertical",
        labels: {},
        onRemove: jest.fn(),
      },
      <Tag id={0} testID="zero" textValue="Zero" transparent raised={false} order="primary" closeIcon={<Text>X</Text>}>
        Zero
      </Tag>,
    ),
  )
  for (const field of ["selectedKeys", "disabledKeys", "selectionMode", "orientation", "labels", "onRemove"])
    expect(row("tag-group").props[field]).toBeUndefined()
  for (const field of ["id", "textValue", "transparent", "raised", "order", "closeIcon", "customStyles"])
    expect(row("zero").props[field]).toBeUndefined()
})
it("requests copied typed keys repeatedly under owner veto and paints only owner echoes", async () => {
  const owner = new Set<string | number>([0, "missing"]),
    change = jest.fn()
  const children = (
    <>
      <Tag id={0} testID="zero">
        Zero
      </Tag>
      <Tag id="0" testID="string">
        String zero
      </Tag>
      <Tag id="" testID="empty">
        Empty
      </Tag>
    </>
  )
  const view = await render(
    node({ selectionMode: "multiple", selectedKeys: owner, onSelectionChange: change }, children),
  )
  await press("empty")
  await press("empty")
  expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([
    [0, "missing", ""],
    [0, "missing", ""],
  ])
  expect(change.mock.calls[0][0] === owner).toBe(false)
  expect([...owner]).toEqual([0, "missing"])
  expect(row("empty").props.accessibilityState.selected).toBe(false)
  expect(row("zero").props.accessibilityState.selected).toBe(true)
  expect(row("string").props.accessibilityState.selected).toBe(false)
  await view.rerender(
    node({ selectionMode: "multiple", selectedKeys: new Set([""]), onSelectionChange: change }, children),
  )
  expect(row("empty").props.accessibilityState.selected).toBe(true)
  expect(row("zero").props.accessibilityState.selected).toBe(false)
  expect(change).toHaveBeenCalledTimes(2)
})
it("protects passive row ownership from untyped accessibility-state aliases", async () => {
  const aliases: object = {
    "aria-selected": true,
    "aria-checked": true,
    "aria-expanded": true,
    "aria-disabled": false,
    "aria-busy": true,
  }
  await render(
    node(
      { selectedKeys: [0], disabledKeys: [0] },
      <Tag {...aliases} id={0} testID="zero">
        Zero
      </Tag>,
    ),
  )
  expect(row("zero").props.accessibilityState.selected).toBeUndefined()
  expect(row("zero").props.accessibilityState.checked).toBeUndefined()
  expect(row("zero").props.accessibilityState.expanded).toBeUndefined()
  expect(row("zero").props.accessibilityState.disabled).toBe(true)
  expect(row("zero").props.accessibilityState.busy).toBeUndefined()
})
it("caches one-shot selected/disabled iterables by owner identity across internal renders", async () => {
  const selectedKeys = [0, "missing"][Symbol.iterator](),
    disabledKeys = [""][Symbol.iterator](),
    change = jest.fn()
  const children = (
    <>
      <Tag id={0} testID="zero">
        Zero
      </Tag>
      <Tag id="" testID="empty" isDisabled={false}>
        Empty
      </Tag>
    </>
  )
  const props = { selectionMode: "multiple" as const, selectedKeys, disabledKeys, onSelectionChange: change }
  const view = await render(node(props, children))
  await view.rerender(node(props, children, "dark"))
  expect(row("zero").props.accessibilityState.selected).toBe(true)
  expect(row("empty").props.accessibilityState.disabled).toBe(true)
  expect(row("empty").props.onResponderGrant).toBeUndefined()
  await press("zero")
  expect([...change.mock.calls[0][0]]).toEqual(["missing"])
  expect(row("zero").props.accessibilityState.selected).toBe(true)
})
it("samples default selection once and changes only local uncontrolled membership", async () => {
  const change = jest.fn(),
    children = (
      <>
        <Tag id={0} testID="zero">
          Zero
        </Tag>
        <Tag id="" testID="empty">
          Empty
        </Tag>
      </>
    )
  const view = await render(
    node({ selectionMode: "single", defaultSelectedKeys: [0], onSelectionChange: change }, children),
  )
  await view.rerender(node({ selectionMode: "single", defaultSelectedKeys: [""], onSelectionChange: change }, children))
  expect(row("zero").props.accessibilityState.selected).toBe(true)
  await press("empty")
  expect(row("empty").props.accessibilityState.selected).toBe(true)
  expect([...change.mock.calls[0][0]]).toEqual([""])
})
it("CAP.tag-group.item.012 passes live controlled/action/removal/disabled flags to children and style", async () => {
  const child = jest.fn((state) => <Text>{state.isSelected ? "Selected" : "Unselected"}</Text>),
    style = jest.fn<RN.TextStyle, [TNativeGroupedTagState & { defaultStyle: RN.TextStyle }]>(() => ({}))
  const view = await render(
    node(
      { selectionMode: "multiple", selectedKeys: [0], onRemove: jest.fn() },
      <Tag id={0} testID="zero" style={style}>
        {child}
      </Tag>,
    ),
  )
  expect(child.mock.calls.at(-1)?.[0]).toMatchObject({
    isSelected: true,
    isDisabled: false,
    allowsRemoving: true,
    allowsSelection: true,
    selectionMode: "multiple",
  })
  await view.rerender(
    node(
      { selectionMode: "multiple", selectedKeys: [], onRemove: jest.fn() },
      <Tag id={0} testID="zero" isDisabled style={style}>
        {child}
      </Tag>,
    ),
  )
  expect(child.mock.calls.at(-1)?.[0]).toMatchObject({ isSelected: false, isDisabled: true, allowsSelection: false })
  expect(style.mock.calls.at(-1)?.[0]).toMatchObject({
    isSelected: false,
    isDisabled: true,
    defaultStyle: expect.any(Object),
  })
  await view.rerender(
    node(
      { selectionMode: "multiple", selectedKeys: [] },
      <Tag id={0} testID="zero" isDisabled={false}>
        {child}
      </Tag>,
    ),
  )
  expect(child.mock.calls.at(-1)?.[0]).toMatchObject({
    isDisabled: false,
    allowsSelection: true,
    allowsRemoving: false,
  })
})
it("CAP.tag-group.item.013/.014 keeps the default close icon, falsy fallback and authored icon", async () => {
  const remove = jest.fn(),
    view = await render(
      node(
        { onRemove: remove },
        <Tag id={0} closeIcon={false}>
          Zero
        </Tag>,
      ),
    )
  expect(row("tag-default-close-icon").props).toMatchObject({ width: 15, height: 15, accessible: false })
  await view.rerender(
    node(
      { onRemove: remove },
      <Tag id={0} closeIcon={<Text testID="custom-icon">X</Text>}>
        Zero
      </Tag>,
    ),
  )
  expect(row("custom-icon")).toBeOnTheScreen()
  expect(screen.queryByTestId("tag-default-close-icon", hidden)).toBeNull()
})
it("remove button requests only its item, preserves the caller collection and supports empty localized labels", async () => {
  const remove = jest.fn(),
    owner = new Set([0, "missing"])
  await render(
    node({ selectionMode: "multiple", selectedKeys: owner, onRemove: remove, labels: { removeButtonAriaLabel: "" } }),
  )
  expect(row("tag-remove-button").props.accessibilityLabel).toBe("")
  await press("tag-remove-button")
  expect([...remove.mock.calls[0][0]]).toEqual([0])
  expect([...owner]).toEqual([0, "missing"])
  expect(screen.getByText("Zero")).toBeOnTheScreen()
})
it("uses item → group → URL callback order without selecting links", async () => {
  const order: unknown[] = [],
    change = jest.fn(),
    navigate = jest.fn((href) => order.push(href))
  await render(
    node(
      { selectionMode: "multiple", selectedKeys: [], onSelectionChange: change, onAction: (id) => order.push(id) },
      <Tag
        id={0}
        testID="zero"
        href="https://example.test/zero"
        onAction={() => order.push("item")}
        onNavigate={navigate}
      >
        Zero
      </Tag>,
    ),
  )
  await press("zero")
  expect(order).toEqual(["item", 0, "https://example.test/zero"])
  expect(change).not.toHaveBeenCalled()
})
it("uses current callbacks and retires captured host callbacks after item replacement", async () => {
  const old = jest.fn(),
    current = jest.fn(),
    view = await render(node({ onAction: old }))
  await view.rerender(node({ onAction: current }))
  await press("zero")
  expect(old).not.toHaveBeenCalled()
  expect(current.mock.calls).toEqual([[0]])
  const retired = row("zero").props.onNativeActivation,
    ownerId = row("zero").props.ownerId
  await view.rerender(
    node(
      { onAction: current },
      <Tag key="other" id="other">
        Other
      </Tag>,
    ),
  )
  await act(() =>
    retired({
      nativeEvent: {
        kind: "activation",
        ownerId,
        target: 17,
        source: "android-click",
        activationId: 1,
        timestamp: 100,
      },
    }),
  )
  expect(current).toHaveBeenCalledTimes(1)
})
it("selects Space on key-down and acts on Enter release, preserving raw event identity", async () => {
  const change = jest.fn(),
    action = jest.fn(),
    down = jest.fn(),
    up = jest.fn(),
    start = jest.fn(),
    release = jest.fn()
  await render(
    node(
      {
        selectionMode: "multiple",
        selectedKeys: [],
        selectionBehavior: "replace",
        onSelectionChange: change,
        onAction: action,
      },
      <Tag id={0} testID="zero" onKeyDown={down} onKeyUp={up} onPressStart={start} onPress={release}>
        Zero
      </Tag>,
    ),
  )
  const space = await key("zero", " ", "down")
  expect([...change.mock.calls[0][0]]).toEqual([0])
  expect(down.mock.calls[0][0] === space).toBe(true)
  expect(start.mock.calls[0][0] === space).toBe(true)
  await key("zero", " ", "up")
  expect(action).not.toHaveBeenCalled()
  await key("zero", "Enter", "down")
  expect(action).not.toHaveBeenCalled()
  const enter = await key("zero", "Enter", "up")
  expect(action.mock.calls).toEqual([[0]])
  expect(up.mock.calls.at(-1)?.[0] === enter).toBe(true)
  expect(release.mock.calls.at(-1)?.[0] === enter).toBe(true)
})
it("preserves original focus packets and clears empty focus flags on blur", async () => {
  const empty = jest.fn<ReactNode, [TNativeTagGroupEmptyState]>(() => <Text>Empty</Text>),
    onFocus = jest.fn(),
    onBlur = jest.fn()
  const view = await render(
    node(
      {},
      <Tag id={0} testID="zero" onFocus={onFocus} onBlur={onBlur}>
        Zero
      </Tag>,
    ),
  )
  const gained = await focus("zero", true),
    lost = await focus("zero", false)
  expect(onFocus.mock.calls[0][0] === gained).toBe(true)
  expect(onBlur.mock.calls[0][0] === lost).toBe(true)
  await view.rerender(node({ renderEmptyState: empty }, null))
  await focus("tag-list", true)
  expect(empty.mock.calls.at(-1)?.[0]).toMatchObject({ isFocused: true, isFocusVisible: true })
  await focus("tag-list", false)
  expect(empty.mock.calls.at(-1)?.[0]).toMatchObject({ isFocused: false, isFocusVisible: false })
})
it("accepts dynamic one-shot item iterables and typed key zero/empty without a local data mirror", async () => {
  const items = [
    { id: 0, label: "Zero" },
    { id: "", label: "Empty" },
  ][Symbol.iterator]()
  const view = await render(
    <NativeThemeProvider>
      <TagGroup items={items}>{(item) => <Tag testID={`item-${item.id}`}>{item.label}</Tag>}</TagGroup>
    </NativeThemeProvider>,
  )
  expect(row("item-0")).toBeOnTheScreen()
  expect(row("item-")).toBeOnTheScreen()
  await view.rerender(
    <NativeThemeProvider>
      <TagGroup items={items}>{(item) => <Tag testID={`item-${item.id}`}>{item.label} again</Tag>}</TagGroup>
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Zero")).toBeOnTheScreen()
  expect(screen.queryByText("Zero again")).toBeNull()
  expect(screen.getByText("Empty")).toBeOnTheScreen()
  expect(screen.queryByText("Empty again")).toBeNull()
})
it("matches pinned default text buffering and captures Space before selection with the original raw event", async () => {
  jest.useFakeTimers()
  try {
    const change = jest.fn(),
      raw = jest.fn()
    await render(
      node(
        { selectionMode: "multiple", selectedKeys: [], onSelectionChange: change },
        <Tag id={0} testID="zero" onKeyDown={raw}>
          Zero
        </Tag>,
      ),
    )
    await key("zero", "z", "down", { nativeDefaultHandled: false })
    const space = await key("zero", " ", "down")
    await key("zero", " ", "up")
    expect(space.preventDefault).toHaveBeenCalledTimes(1)
    expect(raw.mock.calls.at(-1)?.[0] === space).toBe(true)
    expect(change).not.toHaveBeenCalled()
    await act(() => jest.advanceTimersByTime(1000))
    await key("zero", " ", "down")
    expect([...change.mock.calls[0][0]]).toEqual([0])
    await key("zero", " ", "up")
  } finally {
    jest.useRealTimers()
  }
})
it("retires the text buffer timer on unmount", async () => {
  jest.useFakeTimers()
  try {
    const schedule = jest.spyOn(globalThis, "setTimeout"),
      cancel = jest.spyOn(globalThis, "clearTimeout")
    const view = await render(node())
    await key("zero", "z", "down", { nativeDefaultHandled: false })
    const index = schedule.mock.calls.findLastIndex(([, delay]) => delay === 1000)
    expect(index).toBeGreaterThanOrEqual(0)
    const handle = schedule.mock.results[index].value
    await view.unmount()
    expect(cancel.mock.calls.some(([value]) => value === handle)).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})
