import { useRef, useState } from "react"
import { Modal, TextInput, View } from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

import {
  Button,
  NativeFocusView,
  NativeFloatingLayerHost,
  NativeThemeProvider,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  SelectionIndicator,
  NativeToggleButtonGroupKeyboardScope,
  type TNativeToggleGroupKey,
} from "@codon-ui/react-native"

const keyName = (key: TNativeToggleGroupKey) =>
  typeof key === "number" ? `number:${key}` : `string:${JSON.stringify(key)}`
const keysName = (keys: Iterable<TNativeToggleGroupKey>) => [...keys].map(keyName).join(" | ") || "none"
const HeldEditor = () => {
  const [draft, setDraft] = useState("initial draft")
  return (
    <TextInput
      testID="composition-editor"
      accessibilityLabel="Independent held editor"
      value={draft}
      onChangeText={setDraft}
    />
  )
}

// The installed window owner supplies its existing native-window control; source fixtures never simulate a window.
export const ToggleCompositionScene = ({ onRequestWindow }: { onRequestWindow?: () => void }) => {
  const ancestor = useRef<View>(null)
  const [windowOpen, setWindowOpen] = useState(false)
  const [selected, setSelected] = useState<Set<TNativeToggleGroupKey>>(() => new Set([0]))
  const [requested, setRequested] = useState<Set<TNativeToggleGroupKey>>()
  const [requests, setRequests] = useState(0)
  const [veto, setVeto] = useState(false)
  const [controlled, setControlled] = useState(true)
  const [multiple, setMultiple] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [memberDisabled, setMemberDisabled] = useState(false)
  const [vertical, setVertical] = useState(false)
  const [custom, setCustom] = useState(false)
  const [transitions, setTransitions] = useState(false)
  const [large, setLarge] = useState(false)
  const [dark, setDark] = useState(false)
  const [portal, setPortal] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [replacement, setReplacement] = useState(0)
  const [keyPhases, setKeyPhases] = useState<string[]>([])
  const member = (key: TNativeToggleGroupKey, name: string) => (
    <ToggleButton
      key={keyName(key)}
      id={key}
      accessibilityLabel={name}
      isDisabled={memberDisabled && key === "0"}
      preventFocusOnPress={custom}
      customStyles={{ fontSize: large ? 24 : 14, minHeight: large ? 60 : 44 }}
      style={({ isSelected, defaultStyle }) =>
        custom ? { ...defaultStyle, borderRadius: 0, opacity: isSelected ? 0.8 : 1 } : defaultStyle
      }
      render={custom ? (props) => <NativeFocusView {...props} /> : undefined}
    >
      {({ isSelected }) => (
        <>
          <Text>
            {name}: {String(isSelected)}
          </Text>
          <SelectionIndicator
            testID={`indicator-${keyName(key)}`}
            transitionProperties={transitions ? ["translate", "color"] : ["none"]}
            transition={{ duration: transitions ? 0.25 : 0 }}
            customStyles={{ width: 8, height: 8, backgroundColor: "#2563eb" }}
            style={({ isEntering, isExiting, defaultStyle }) => ({
              ...defaultStyle,
              opacity: isEntering || isExiting ? 0.5 : 1,
            })}
          />
        </>
      )}
    </ToggleButton>
  )
  return (
    <PortalProvider>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <View>
          <Text elementType="h2">Complete toggle composition</Text>
          <Text testID="composition-owner">
            Owner: {keysName(selected)}. Request: {requested ? keysName(requested) : "none"}. Requests: {requests}.
            Veto: {String(veto)}.
          </Text>
          <View>
            <Button onPress={() => setVeto(!veto)}>Toggle composition veto</Button>
            <Button onPress={() => requested && setSelected(new Set(requested))}>Echo composition request</Button>
            <Button onPress={() => setControlled(!controlled)}>Toggle composition control</Button>
            <Button onPress={() => setMultiple(!multiple)}>Toggle composition selection mode</Button>
            <Button onPress={() => setDisabled(!disabled)}>Toggle composition group guard</Button>
            <Button onPress={() => setMemberDisabled(!memberDisabled)}>Toggle composition member guard</Button>
            <Button onPress={() => setVertical(!vertical)}>Toggle composition orientation</Button>
            <Button onPress={() => setCustom(!custom)}>Toggle composition render and styles</Button>
            <Button onPress={() => setTransitions(!transitions)}>Toggle composition transitions</Button>
            <Button onPress={() => setLarge(!large)}>Toggle composition large text</Button>
            <Button onPress={() => setDark(!dark)}>Toggle composition theme</Button>
            <Button onPress={() => setPortal(!portal)}>Toggle composition portal</Button>
            <Button onPress={() => setRemoved(!removed)}>Toggle composition member removal</Button>
            <Button onPress={() => setReplacement(replacement + 1)}>Replace composition owner</Button>
            <Button onPress={() => (onRequestWindow ? onRequestWindow() : setWindowOpen(true))}>
              Open composition window
            </Button>
            <Button
              onPress={() => {
                setSelected(new Set([0]))
                setRequested(undefined)
                setRequests(0)
                setVeto(false)
                setReplacement(replacement + 1)
              }}
            >
              Reset composition
            </Button>
          </View>
          <NativeToggleButtonGroupKeyboardScope
            containerRef={ancestor}
            onKeyDownCapture={(event) => setKeyPhases((old) => [...old.slice(-5), `capture:${event.nativeEvent.key}`])}
            onKeyDown={(event) => setKeyPhases((old) => [...old.slice(-5), `bubble:${event.nativeEvent.key}`])}
          >
            {(listeners) => (
              <View {...listeners} ref={ancestor} testID="composition-ancestor">
                <ToggleButtonGroup
                  key={replacement}
                  testID="composition-group"
                  aria-label="Typed formatting options"
                  selectionMode={multiple ? "multiple" : "single"}
                  orientation={vertical ? "vertical" : "horizontal"}
                  selectedKeys={controlled ? selected : undefined}
                  defaultSelectedKeys={[""]}
                  isDisabled={disabled}
                  onSelectionChange={(keys) => {
                    setRequested(new Set(keys))
                    setRequests((count) => count + 1)
                    if (!veto) setSelected(new Set(keys))
                  }}
                  customStyles={custom ? { padding: 7, gap: 9 } : undefined}
                  style={({ defaultStyle }) => ({ ...defaultStyle, flexDirection: vertical ? "column" : "row" })}
                  render={custom ? (props) => <View {...props} /> : undefined}
                >
                  {({ state }) => (
                    <>
                      <Text testID="composition-current">
                        Actual: {keysName(state.selectedKeys)}. Mode: {state.selectionMode}.
                      </Text>
                      {member(0, "Numeric zero")}
                      {!removed && member("0", "String zero")}
                      {member("", "Empty key")}
                      <HeldEditor />
                      <ToggleButton aria-label="Independent toggle">Independent toggle</ToggleButton>
                      <ToggleButtonGroup aria-label="Nested group" defaultSelectedKeys={["nested"]}>
                        <ToggleButton id="nested" aria-label="Nested member">
                          Nested member
                          <SelectionIndicator testID="nested-indicator" />
                        </ToggleButton>
                      </ToggleButtonGroup>
                      {portal && (
                        <Portal hostName="toggle-composition-portal">{member("portal", "Portalled member")}</Portal>
                      )}
                    </>
                  )}
                </ToggleButtonGroup>
              </View>
            )}
          </NativeToggleButtonGroupKeyboardScope>
          <Text testID="composition-phases">{keyPhases.join(" | ") || "No key phases observed"}</Text>
          <PortalHost name="toggle-composition-portal" />
          <Modal visible={windowOpen} onRequestClose={() => setWindowOpen(false)} testID="composition-window">
            <NativeFloatingLayerHost>
              <Text>Independent native window</Text>
              <ToggleButtonGroup aria-label="Separate window group" defaultSelectedKeys={["window"]}>
                <ToggleButton id="window" aria-label="Separate window member">
                  Window member
                  <SelectionIndicator />
                </ToggleButton>
              </ToggleButtonGroup>
              <Button onPress={() => setWindowOpen(false)}>Close composition window</Button>
            </NativeFloatingLayerHost>
          </Modal>
        </View>
      </NativeThemeProvider>
    </PortalProvider>
  )
}
