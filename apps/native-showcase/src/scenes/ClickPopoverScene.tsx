import { createContext, useContext, useRef, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { AVAILABLE_THEMING_ORDER_CODES, Button, ClickPopover, NativeDialogTrigger, Text } from "@codon-ui/react-native"

const CallerContext = createContext("Caller content")
const Content = () => <Text testID="popover-caller-context">{useContext(CallerContext)}</Text>

export const ClickPopoverScene = () => {
  const [open, setOpen] = useState(false)
  const [echo, setEcho] = useState(true)
  const [veto, setVeto] = useState(false)
  const [requests, setRequests] = useState(0)
  const [outside, setOutside] = useState(0)
  const [actions, setActions] = useState(0)
  const [nonmodal, setNonmodal] = useState(false)
  const [dialog, setDialog] = useState(true)
  const [mounted, setMounted] = useState(true)
  const [draft, setDraft] = useState("")
  const [height, setHeight] = useState(180)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [styled, setStyled] = useState(false)
  const [orthogonal, setOrthogonal] = useState(false)
  const [order, setOrder] = useState(0)
  const scroll = useRef<ScrollView>(null)
  const editor = useRef<TextInput>(null)
  const request = (next: boolean) => {
    setRequests((value) => value + 1)
    if (echo) setOpen(next)
  }
  const reset = () => {
    setOpen(false)
    setEcho(true)
    setVeto(false)
    setRequests(0)
    setOutside(0)
    setActions(0)
    setNonmodal(false)
    setDialog(true)
    setMounted(true)
    setDraft("")
    setHeight(180)
    setScrollOffset(0)
    setStyled(false)
    setOrthogonal(false)
    setOrder(0)
  }
  return (
    <CallerContext.Provider value="Live popover caller context">
      <View style={{ gap: 12 }}>
        <Text elementType="h2">Click popover</Text>
        <Text testID="popover-scene-state">
          Open: {String(open)}. Requests: {requests}. Outside: {outside}. Actions: {actions}. Owner{" "}
          {echo ? "echoes" : "declines"}. Draft: {draft || "empty"}. Scroll: {scrollOffset}.
        </Text>
        <Button onPress={() => setEcho((value) => !value)}>Toggle popover echo</Button>
        <Button onPress={() => setVeto((value) => !value)}>Toggle outside veto</Button>
        <Button onPress={() => setNonmodal((value) => !value)}>Toggle nonmodal popover</Button>
        <Button onPress={() => setDialog((value) => !value)}>Toggle child dialog</Button>
        <Button onPress={() => setStyled((value) => !value)}>Toggle popover styles</Button>
        <Button onPress={() => setOrthogonal((value) => !value)}>Toggle popover geometry</Button>
        <Button onPress={() => setOrder((value) => (value + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
          Next popover order
        </Button>
        <Button onPress={() => setActions((value) => value + 1)}>Background popover action</Button>
        <Button onPress={() => setMounted((value) => !value)}>Toggle popover owner</Button>
        <Button onPress={reset}>Reset popover</Button>
        <Text nativeID="popover-scene-description">An anchored editor with caller-owned content.</Text>
        <NativeDialogTrigger
          isOpen={open}
          onOpenChange={request}
          trigger={(state) => (
            <Button {...state.triggerProps} testID="popover-scene-trigger">
              Open click popover
            </Button>
          )}
        >
          {mounted && (
            <ClickPopover
              testID="popover-scene-surface"
              accessibilityLabel="Popover editor"
              aria-describedby="popover-scene-description"
              isNonModal={nonmodal}
              childIsDialog={dialog}
              scrollRef={scroll}
              initialFocusRef={editor}
              showOverlayArrow
              geometry={orthogonal ? "orthogonal" : "rounded"}
              order={AVAILABLE_THEMING_ORDER_CODES[order]}
              customStyles={styled ? { borderWidth: 2, padding: 0 } : undefined}
              style={styled ? { borderWidth: 3 } : undefined}
              customDialogStyles={styled ? { gap: 0, color: "purple" } : undefined}
              customOverlayArrowStyles={styled ? { fill: "orange" } : undefined}
              shouldCloseOnInteractOutside={() => {
                setOutside((value) => value + 1)
                return !veto
              }}
            >
              <Content />
              <ScrollView
                ref={scroll}
                testID="popover-scene-scroll"
                style={{ height, width: 220 }}
                onScroll={({ nativeEvent }) => setScrollOffset(nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
              >
                <Text>{"Scroll the content before resizing. ".repeat(10)}</Text>
                <TextInput
                  ref={editor}
                  testID="popover-scene-editor"
                  accessibilityLabel="Raw popover draft"
                  value={draft}
                  onChangeText={setDraft}
                  style={{ minHeight: 44, borderWidth: 1 }}
                />
                <Text>{"The same focused native editor remains mounted. ".repeat(10)}</Text>
              </ScrollView>
              <Button onPress={() => setHeight((value) => (value === 180 ? 100 : 180))}>Resize popover content</Button>
              <Button onPress={() => request(false)}>Request popover close</Button>
              <Button onPress={() => setMounted(false)}>Unmount open popover</Button>
            </ClickPopover>
          )}
        </NativeDialogTrigger>
      </View>
    </CallerContext.Provider>
  )
}
