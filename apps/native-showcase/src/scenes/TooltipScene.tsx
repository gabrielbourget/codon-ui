import { createContext, useContext, useRef, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  HoverPopover,
  NativeTooltipTrigger,
  Text,
  Tooltip,
} from "@codon-ui/react-native"

const DescriptionContext = createContext("Caller context")
const Description = () => <Text testID="tooltip-context">{useContext(DescriptionContext)}</Text>

export const TooltipScene = () => {
  const [open, setOpen] = useState(false)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [echo, setEcho] = useState(true)
  const [requests, setRequests] = useState(0)
  const [actions, setActions] = useState(0)
  const [draft, setDraft] = useState("")
  const [styled, setStyled] = useState(false)
  const [orthogonal, setOrthogonal] = useState(false)
  const [arrow, setArrow] = useState(true)
  const [orderIndex, setOrderIndex] = useState(0)
  const [mounted, setMounted] = useState(true)
  const editor = useRef<TextInput>(null)
  const request = (next: boolean, set: (value: boolean) => void) => {
    setRequests((value) => value + 1)
    if (echo) set(next)
  }
  const reset = () => {
    setOpen(false)
    setHoverOpen(false)
    setEcho(true)
    setRequests(0)
    setActions(0)
    setDraft("")
    setStyled(false)
    setOrthogonal(false)
    setArrow(true)
    setOrderIndex(0)
    setMounted(true)
  }
  const shared = {
    order: AVAILABLE_THEMING_ORDER_CODES[orderIndex],
    geometry: orthogonal ? ("orthogonal" as const) : ("rounded" as const),
    customStyles: styled ? { borderWidth: 2, padding: 0 } : undefined,
    style: styled ? { borderWidth: 3 } : undefined,
    customOverlayArrowStyles: styled ? { fill: "orange", width: 0 } : undefined,
  }
  return (
    <DescriptionContext.Provider value="Live caller description context">
      <View style={{ gap: 12 }}>
        <Text elementType="h2">Tooltip and hover descriptions</Text>
        <Text testID="tooltip-scene-state">
          Tooltip: {String(open)}. Hover: {String(hoverOpen)}. Requests: {requests}. Actions: {actions}. Owner{" "}
          {echo ? "echoes" : "declines"}. Draft: {draft || "empty"}.
        </Text>
        <Button onPress={() => setOpen(true)}>Show tooltip explicitly</Button>
        <Button onPress={() => setHoverOpen(true)}>Show editor description explicitly</Button>
        <Button onPress={() => setEcho((value) => !value)}>Toggle description echo</Button>
        <Button onPress={() => setStyled((value) => !value)}>Toggle description styles</Button>
        <Button onPress={() => setOrthogonal((value) => !value)}>Toggle description geometry</Button>
        <Button onPress={() => setArrow((value) => !value)}>Toggle description arrow</Button>
        <Button onPress={() => setOrderIndex((value) => (value + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
          Next description order
        </Button>
        <Button onPress={() => setMounted((value) => !value)}>Toggle description owner</Button>
        <Button onPress={reset}>Reset descriptions</Button>
        {mounted && (
          <>
            <ScrollView testID="tooltip-anchor-scroll" style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 12 }}>
              <NativeTooltipTrigger
                isOpen={open}
                onOpenChange={(next) => request(next, setOpen)}
                trigger={(state) => (
                  <Button
                    {...state.triggerProps}
                    testID="tooltip-scene-trigger"
                    onPress={() => setActions((value) => value + 1)}
                  >
                    Described action
                  </Button>
                )}
              >
                <Tooltip
                  {...shared}
                  testID="tooltip-scene-surface"
                  showOverlayArrow={arrow}
                  descriptionLabel="Action details"
                >
                  <Description />
                  <Text>Hover or keyboard focus describes the action. The action remains available.</Text>
                </Tooltip>
              </NativeTooltipTrigger>
              <TextInput
                ref={editor}
                testID="tooltip-scene-editor"
                accessibilityLabel="Raw described editor"
                accessibilityHint="Retained editor hint"
                value={draft}
                onChangeText={setDraft}
                style={{ minHeight: 44, borderWidth: 1 }}
              />
              <Text>{"Scroll this anchor owner to request closure. ".repeat(10)}</Text>
            </ScrollView>
            <HoverPopover
              {...shared}
              testID="hover-scene-surface"
              isOpen={hoverOpen}
              onOpenChange={(next) => request(next, setHoverOpen)}
              triggerRef={editor}
              descriptionLabel="Editor details"
              showOverlayArrow={!arrow}
            >
              <Description />
              <ScrollView testID="tooltip-internal-scroll" style={{ maxHeight: 120 }}>
                <Text>{"This content scrolls independently from the anchor. ".repeat(12)}</Text>
              </ScrollView>
            </HoverPopover>
          </>
        )}
      </View>
    </DescriptionContext.Provider>
  )
}
