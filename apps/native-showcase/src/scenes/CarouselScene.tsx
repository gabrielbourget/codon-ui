import { useCallback, useRef, useState } from "react"
import { TextInput, View } from "react-native"

import {
  Button,
  Carousel,
  CarouselCloseButton,
  CarouselCounter,
  CarouselDots,
  CarouselNextButton,
  CarouselPrevButton,
  Text,
  useNativeTheme,
  type TNativeCarouselContext,
} from "@codon-ui/react-native"

const initialItems = Array.from({ length: 9 }, (_, index) => ({ ID: `item-${index}`, label: `Item ${index + 1}` }))
export const CarouselScene = () => {
  const theme = useNativeTheme()
  const [items, setItems] = useState(initialItems)
  const [open, setOpen] = useState(true)
  const [loop, setLoop] = useState(true)
  const [vertical, setVertical] = useState(false)
  const [manual, setManual] = useState(false)
  const [interactive, setInteractive] = useState(true)
  const [overlay, setOverlay] = useState(true)
  const [selected, setSelected] = useState(0)
  const [requests, setRequests] = useState(0)
  const [initialIndex, setInitialIndex] = useState(0)
  const [viewport, setViewport] = useState(false)
  const context = useRef<TNativeCarouselContext | null>(null)
  const itemSerial = useRef(initialItems.length)
  const onIndexChange = useCallback((index: number) => {
    setSelected(index)
    setRequests((count) => count + 1)
  }, [])
  const onViewportRefChange = useCallback((node: View | null) => setViewport(!!node), [])
  return (
    <View style={{ gap: 10 }}>
      <Text elementType="h2" variant="h3">
        Carousel
      </Text>
      <Text testID="carousel-scene-state">
        Selected: {selected + 1}. Items: {items.length}. Selection reports: {requests}. Viewport:{" "}
        {viewport ? "attached" : "detached"}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        <Button onPress={() => setOpen((value) => !value)}>{open ? "Hide carousel" : "Show carousel"}</Button>
        <Button onPress={() => setLoop((value) => !value)}>Toggle loop</Button>
        <Button onPress={() => setVertical((value) => !value)}>Toggle axis</Button>
        <Button onPress={() => setManual((value) => !value)}>Toggle dot activation</Button>
        <Button onPress={() => setInteractive((value) => !value)}>Toggle passive dots</Button>
        <Button onPress={() => setOverlay((value) => !value)}>Toggle chrome overlay</Button>
        <Button onPress={() => setInitialIndex((value) => (value === 0 ? 4 : 0))}>Change requested index</Button>
        <Button onPress={() => setItems((value) => [...value].reverse())}>Reverse items</Button>
        <Button
          onPress={() => {
            const index = itemSerial.current++
            setItems((value) => [...value, { ID: `item-${index}`, label: `Item ${index + 1}` }])
          }}
        >
          Add item
        </Button>
        <Button onPress={() => setItems((value) => value.slice(0, -1))}>Remove item</Button>
        <Button onPress={() => context.current?.emblaApi?.scrollTo(0, true)}>Jump to first</Button>
        <Button onPress={() => context.current?.emblaApi?.reInit({ align: "end" })}>Reinitialize alignment</Button>
      </View>
      {open ? (
        <Carousel
          items={items}
          initialIndex={initialIndex}
          loopEnabled={loop}
          axis={vertical ? "y" : "x"}
          onIndexChange={onIndexChange}
          onViewportRefChange={onViewportRefChange}
          style={{ height: 300, backgroundColor: theme.colors.background }}
          customContainerStyles={{ flexDirection: vertical ? "column" : "row" }}
          customItemStyles={{ padding: 30 }}
          getItemID={(index) => `carousel-scene-${items[index]?.ID ?? index}`}
          chromeOverlayStrategy={overlay ? "overlay" : "none"}
          renderCarouselItem={({ item, index, isSelected }) => (
            <View style={{ gap: 5, width: "100%", alignItems: "center" }}>
              <Text variant="h3">{item.label}</Text>
              <Text>
                {index + 1} / {items.length}. {isSelected ? "Selected" : "Unselected"}.
              </Text>
              <TextInput
                accessibilityLabel={`${item.label} editor`}
                placeholder="Keyboard stays in this editor"
                style={{
                  color: theme.colors.foreground,
                  borderWidth: 1,
                  borderColor: theme.colors.controlBorder,
                  width: "100%",
                  padding: 5,
                }}
              />
            </View>
          )}
          chromeSlot={({ context: current }) => {
            context.current = current
            return (
              <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "space-between", padding: 5 }}>
                <View pointerEvents="box-none" style={{ alignItems: "flex-end" }}>
                  <CarouselCloseButton onPress={() => setOpen(false)} />
                </View>
                <View
                  pointerEvents="box-none"
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <CarouselPrevButton />
                  <CarouselCounter />
                  <CarouselNextButton />
                </View>
                <CarouselDots
                  interactive={interactive}
                  activationMode={manual ? "manual" : "auto"}
                  showOverflowSentinels
                  raised
                  customStyles={{ alignSelf: "center" }}
                />
              </View>
            )
          }}
        />
      ) : null}
    </View>
  )
}
