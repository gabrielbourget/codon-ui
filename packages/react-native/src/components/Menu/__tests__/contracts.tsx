import { createRef } from "react"
import type { View } from "react-native"

import { Button } from "../../.."
import { Menu, NativeMenuTrigger } from "../Menu"
import { MenuHeader } from "../MenuHeader"
import { MenuItem } from "../MenuItem"
import { MenuSection } from "../MenuSection"
import { MenuSeparator } from "../MenuSeparator"
import { SubmenuTrigger } from "../SubmenuTrigger"
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
