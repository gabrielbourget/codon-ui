import { useRef, useState, type Ref, type RefObject } from "react"
import { View, type TextInput, type ViewStyle } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import {
  Button,
  Input,
  NativeBackdropHost,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type TNativeBackdropAdapter,
} from "../../../.."
import { Panel } from "../../Panel"

export const PanelFixture = ({
  adapter,
  inputRef,
  openerRef,
}: {
  adapter?: TNativeBackdropAdapter
  inputRef?: Ref<TextInput>
  openerRef?: RefObject<View | null>
}) => {
  const [open, setOpen] = useState(false)
  const [veto, setVeto] = useState(true)
  const [right, setRight] = useState(false)
  const [blur, setBlur] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<"light" | "dark">("light")
  const [requests, setRequests] = useState(0)
  const [focused, setFocused] = useState("None observed")
  const [sourcePose, setSourcePose] = useState(0)
  const sourceTransform: ViewStyle["transform"] =
    sourcePose === 0
      ? undefined
      : sourcePose === 1
        ? [{ scale: 0.85 }, { rotate: "8deg" }]
        : sourcePose === 2
          ? [{ perspective: 700 }, { rotateY: "18deg" }, { rotateZ: "6deg" }]
          : [{ scaleX: -1 }]
  const localOpener = useRef<View>(null)
  const opener = openerRef ?? localOpener
  const closeTarget = useRef<View>(null)
  const request = (next: boolean) => {
    setRequests((value) => value + 1)
    if (!veto) setOpen(next)
  }
  const Root = adapter ? NativeBackdropHost : View
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={mode}>
        <NativeOverlayProvider backdropAdapter={adapter}>
          <Root testID="panel-scene-root" style={{ flex: 1, transform: sourceTransform }}>
            <NativeFloatingLayerHost testID="panel-scene-window">
              <Button
                ref={opener}
                testID="panel-opener"
                onFocus={() => setFocused("Opener")}
                onPress={() => setOpen(true)}
              >
                Open panel
              </Button>
              <Button
                onPress={() => {
                  setOpen(false)
                  setVeto(true)
                  setRight(false)
                  setBlur(false)
                  setExpanded(false)
                  setRequests(0)
                  setFocused("None observed")
                  setSourcePose(0)
                }}
              >
                Reset panel scene
              </Button>
              <Text>Owner open: {String(open)}</Text>
              <Text>Close requests: {requests}</Text>
              <Text>Observed focus: {focused}</Text>
              <Panel
                aria-label="Scene panel"
                isOpen={open}
                onOpenChange={request}
                initialFocusRef={closeTarget}
                restoreFocusRef={opener}
                position={right ? "right" : "left"}
                horizontalGap={expanded ? 12 : 0}
                width={expanded ? 360 : undefined}
                backgroundColor={expanded ? "lavender" : undefined}
                panelGeometry="rounded"
                overlayBlur={blur}
                customStyles={{
                  color: expanded ? "teal" : "navy",
                  borderRadius: expanded ? 20 : undefined,
                  padding: expanded ? 20 : 0,
                  gap: expanded ? "4%" : 2,
                  borderWidth: expanded ? 2 : 0,
                  borderColor: expanded ? "teal" : "navy",
                  fontSize: expanded ? 22 : 16,
                  letterSpacing: expanded ? 1 : 0,
                }}
                raised={expanded}
              >
                <Text>Arbitrary panel content</Text>
                <Input ref={inputRef} accessibilityLabel="Held query" value="" onChange={() => {}} />
                <Text>Owner veto: {String(veto)}</Text>
                <Button onPress={() => setVeto(!veto)}>Toggle veto</Button>
                <Button onPress={() => setRight(!right)}>Toggle physical side</Button>
                <Button onPress={() => setExpanded(!expanded)}>Toggle panel appearance</Button>
                <Button onPress={() => setMode(mode === "light" ? "dark" : "light")}>Toggle scene theme</Button>
                {adapter && <Button onPress={() => setBlur(!blur)}>Toggle configured blur</Button>}
                {adapter && (
                  <>
                    <Text>Backdrop source pose: {sourcePose}</Text>
                    <Button onPress={() => setSourcePose((value) => (value + 1) % 4)}>
                      Cycle backdrop source transform
                    </Button>
                  </>
                )}
                <Button
                  ref={closeTarget}
                  testID="panel-close"
                  onFocus={() => setFocused("Close action")}
                  onPress={() => request(false)}
                >
                  Request close
                </Button>
              </Panel>
            </NativeFloatingLayerHost>
          </Root>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
