import { createRef, useContext } from "react"
import type { View } from "react-native"

import {
  Button,
  NativeFocusView,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuSection,
  MenuHeader,
  SubmenuTrigger,
  NativeMenuTrigger,
  MenuText,
  MenuKeyboardShortcut,
  NativeMenuListContext,
  NativeMenuSeparatorContext,
  NativeMenuHeaderContext,
  NativeMenuStateContext,
  NativeMenuSelectionManagerContext,
  NativeRootMenuTriggerStateContext,
  type TNativeMenuListProps,
  // @ts-expect-error Private action admission is not a public family API.
  NativeMenuActionsContext,
} from "../src"
const ref = createRef<View>()
export const menu = (
  <NativeMenuTrigger trigger={(state) => <Button {...state.triggerProps}>Open</Button>}>
    <Menu
      ref={ref}
      selectionMode="multiple"
      selectedKeys={new Set([0, ""])}
      onSelectionChange={(value) => {
        if (value !== "all") value.has(0)
      }}
    >
      <MenuItem
        ref={ref}
        id={0}
        icon={null}
        onPress={(e) => {
          if ("kind" in e.nativeEvent) e.nativeEvent.kind.toUpperCase()
        }}
        style={(state) => ({ opacity: state.isSelected ? 1 : 0, ...state.defaultStyle })}
      >
        Zero
      </MenuItem>
      <MenuSeparator style={{ height: 0 }} />
    </Menu>
  </NativeMenuTrigger>
)
// @ts-expect-error Menu IDs retain native typed-key semantics.
export const badId = <MenuItem id={false}>Invalid</MenuItem>
// @ts-expect-error No DOM class strings are advertised as native styling.
export const domClass = <Menu className="ignored" />
// @ts-expect-error Native refs remain actual View instances.
export const domRef = <Menu ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Public Button cannot override its owned role through the private adapter.
export const role = <Button nativeRole="menuitem">Invalid</Button>

export const section = (
  <MenuSection
    ref={ref}
    id={0}
    selectionMode="multiple"
    selectedKeys={new Set([0, "0"])}
    items={[{ id: "item", label: "Item" }]}
    style={{ fontSize: 18 }}
  >
    {(item) => <MenuItem id={item.id}>{item.label}</MenuItem>}
  </MenuSection>
)
export const header = <MenuHeader ref={ref} nativeID="header" style={{ fontWeight: "bold" }} />
// @ts-expect-error Section keys retain the same string/number identity as item keys.
export const invalidSection = <MenuSection id={false} />
// @ts-expect-error Section refs expose the original native view.
export const invalidSectionRef = <MenuSection ref={createRef<HTMLElement>()} />
// @ts-expect-error Header styles are native values.
export const invalidHeaderStyles = <MenuHeader style={{ fontSize: "18px" }} />
export const submenu = (
  <SubmenuTrigger ref={ref} delay={0}>
    <MenuItem id={0}>More</MenuItem>
    <Menu>
      <MenuItem id="child">Child</MenuItem>
    </Menu>
  </SubmenuTrigger>
)
export const missingSubmenu = (
  // @ts-expect-error Submenu authoring requires both its original trigger and its separate child overlay.
  <SubmenuTrigger>
    <MenuItem id="trigger">More</MenuItem>
  </SubmenuTrigger>
)
export const domSubmenuRef = (
  // @ts-expect-error Submenu refs remain the actual native trigger view.
  <SubmenuTrigger ref={createRef<HTMLDivElement>()}>
    <MenuItem id="trigger">More</MenuItem>
    <Menu />
  </SubmenuTrigger>
)
type TActionValue = { id: string; label: string }
const listDefaults: TNativeMenuListProps<TActionValue> = {
  items: [{ id: "a", label: "Alpha" }],
  children: (item) => <MenuItem id={item.id}>{item.label}</MenuItem>,
  selectionMode: "multiple",
  disabledBehavior: "selection",
  defaultSelectedKeys: [0, "0"],
  shouldUseVirtualFocus: true,
  render: (props, state) => {
    state.isEmpty.valueOf()
    return <NativeFocusView {...props} />
  },
}
export const inheritedList = (
  <NativeMenuListContext.Provider value={listDefaults}>
    <Menu menuListSlot={null} />
  </NativeMenuListContext.Provider>
)
export const contentSlots = (
  <>
    <MenuText ref={createRef<import("react-native").Text>()} slot="description">
      Description
    </MenuText>
    <MenuKeyboardShortcut slot={null}>⌘K</MenuKeyboardShortcut>
  </>
)
// @ts-expect-error Native list style callbacks return actual native typography values.
export const invalidListStyle: TNativeMenuListProps = { style: () => ({ fontSize: "18px" }) }
// @ts-expect-error Original native text refs cannot be DOM spans.
export const invalidContentRef = <MenuText ref={createRef<HTMLSpanElement>()} />

export const customItem = (
  <MenuItem
    id="custom"
    value={{ id: "custom" }}
    ref={ref}
    render={(props, state) => (
      <NativeFocusView {...props} accessibilityHint={state.isFocusVisible ? "Keyboard focus" : state.selectionMode} />
    )}
  />
)
export const domCustomItem = (
  // @ts-expect-error Native item rendering exposes an actual View ref.
  <MenuItem render={(props) => <NativeFocusView {...props} ref={createRef<HTMLDivElement>()} />} />
)

export const longPressTrigger = (
  <NativeMenuTrigger
    triggerMode="longPress"
    locale="fr-FR"
    longPressDescription=""
    trigger={(state) => <Button {...state.triggerProps}>Open</Button>}
  >
    <Menu>
      <MenuItem id="a">Alpha</MenuItem>
    </Menu>
  </NativeMenuTrigger>
)
// @ts-expect-error Trigger interaction modes are explicitly bounded.
export const invalidTriggerMode = <NativeMenuTrigger triggerMode="hover" trigger={() => null} />
// @ts-expect-error Rich host rendering remains private to the native component adapters.
export const privateButtonRender = <Button nativeRender={() => <NativeFocusView />} />

export const separatorDefaults = (
  <NativeMenuSeparatorContext.Provider
    value={{ ref, render: (props) => <NativeFocusView {...props} />, style: { opacity: 0.5 } }}
  >
    <MenuSeparator slot={null} />
  </NativeMenuSeparatorContext.Provider>
)

export const nativeHeader = (
  <MenuHeader
    ref={ref}
    render={(props, state) => {
      const expected: undefined = state
      void expected
      return <NativeFocusView {...props} />
    }}
  />
)
export const headerDefaults = (
  <NativeMenuHeaderContext.Provider value={{ ref, style: { opacity: 0.5 } }}>
    <MenuHeader slot={null} />
  </NativeMenuHeaderContext.Provider>
)
export const FullNativeMenuState = () => {
  const state = useContext(NativeMenuStateContext)
  const manager = useContext(NativeMenuSelectionManagerContext)
  const trigger = useContext(NativeRootMenuTriggerStateContext)
  state?.toggleKey(0)
  state?.collection.getChildren?.(0)
  state?.selectionManager.selectAll()
  manager?.setFocusedKey(0, "last")
  trigger?.openSubmenu(0, 0)
  return null
}
// @ts-expect-error Separator axis semantics have no public native implementation yet; the inherited capability remains OPEN.
export const pendingSeparatorAxis = <MenuSeparator orientation="vertical" />
// @ts-expect-error Header custom roots retain actual native refs.
export const invalidHeaderRoot = <MenuHeader render={() => <NativeFocusView ref={createRef<HTMLElement>()} />} />
void NativeMenuActionsContext
