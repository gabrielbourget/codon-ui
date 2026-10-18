import { createRef } from "react"
import type { View } from "react-native"

import { Button } from "../../.."
import { Menu, NativeMenuTrigger } from "../Menu"
import { MenuItem } from "../MenuItem"
import { MenuSeparator } from "../MenuSeparator"
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
