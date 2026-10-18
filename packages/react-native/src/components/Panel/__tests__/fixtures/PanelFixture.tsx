import { useState, type Ref } from "react"
import { View, type TextInput } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import {
  Button,
  Input,
  NativeBackdropHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type TNativeBackdropAdapter,
} from "../../../.."
import { Panel } from "../../Panel"

export const PanelFixture = ({
  adapter,
  inputRef,
}: {
  adapter?: TNativeBackdropAdapter
  inputRef?: Ref<TextInput>
}) => {
  const [open, setOpen] = useState(false)
  const [veto, setVeto] = useState(true)
  const [right, setRight] = useState(false)
  const [blur, setBlur] = useState(false)
  const Root = adapter ? NativeBackdropHost : View
  return (
    <SafeAreaProvider>
      <NativeThemeProvider>
        <NativeOverlayProvider backdropAdapter={adapter}>
          <Root testID="panel-scene-root" style={{ flex: 1 }}>
            <Button onPress={() => setOpen(true)}>Open panel</Button>
            <Text>Owner open: {String(open)}</Text>
            <Panel
              aria-label="Scene panel"
              isOpen={open}
              onOpenChange={(next) => {
                if (!veto) setOpen(next)
              }}
              position={right ? "right" : "left"}
              horizontalGap={0}
              panelGeometry="rounded"
              overlayBlur={blur}
              customStyles={{ color: "navy" }}
            >
              <Text>Arbitrary panel content</Text>
              <Input ref={inputRef} accessibilityLabel="Held query" value="" onChange={() => {}} />
              <Text>Owner veto: {String(veto)}</Text>
              <Button onPress={() => setVeto(!veto)}>Toggle veto</Button>
              <Button onPress={() => setRight(!right)}>Toggle physical side</Button>
              {adapter && <Button onPress={() => setBlur(!blur)}>Toggle configured blur</Button>}
              <Button
                onPress={() => {
                  if (!veto) setOpen(false)
                }}
              >
                Request close
              </Button>
            </Panel>
          </Root>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
