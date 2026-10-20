import { useLayoutEffect, useRef, useState } from "react"
import { Button, Modal, ScrollView, Text, TextInput, View } from "react-native"

import { Card } from "../../../../packages/react-native/src/components/Card/Card"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { useNativeAnimationControls } from "../../../../packages/react-native/src/motion/animation/hooks"
import { NativeMotionConfig } from "../../../../packages/react-native/src/motion/config"
import { NativeAnimatePresence } from "../../../../packages/react-native/src/motion/presence/NativeAnimatePresence"
import { NativeLayoutGroup } from "../../../../packages/react-native/src/motion/projection/NativeLayoutGroup"
import { NativeThemeProvider } from "../../../../packages/react-native/src/theme"

// Non-shipping Card composition. Its journal does not certify native pixels, editor state or frame cost.
export const NativeCardProbeScene = () => {
  const controls = useNativeAnimationControls()
  const root = useRef<View>(null),
    editor = useRef<TextInput>(null),
    viewport = useRef<ScrollView>(null)
  const original = useRef<{ root: View | null; editor: TextInput | null } | null>(null)
  const [visible, setVisible] = useState(true),
    [wide, setWide] = useState(false),
    [dark, setDark] = useState(false),
    [skip, setSkip] = useState(false),
    [modal, setModal] = useState(false),
    [value, setValue] = useState("")
  const [journal, setJournal] = useState<readonly unknown[]>([])
  const alive = useRef(true)
  const append = (event: unknown) => {
    if (alive.current) setJournal((current) => [...current, event])
  }
  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const identity = () => ({
    sameRoot: root.current === original.current?.root,
    sameEditor: editor.current === original.current?.editor,
  })
  const animate = async () => {
    original.current = { root: root.current, editor: editor.current }
    append({ event: "request", ...identity() })
    try {
      controls.set({ transform: undefined, transformOrigin: undefined, fontVariant: undefined })
      await controls.start({
        opacity: [1, 0.3, 1],
        x: [0, 60, 0],
        transition: { duration: 0.8, ease: "linear" },
      })
      append({ event: "request-settled", ...identity() })
    } catch (error) {
      append({ event: "request-failed", error: String(error), ...identity() })
    }
  }
  return (
    <NativeThemeProvider mode={dark ? "dark" : "light"}>
      <Button title="Press outside observer scope" onPress={() => append({ event: "outside-native-press" })} />
      <NativeKeyboardScope captureEnabled>
        <ScrollView ref={viewport} keyboardShouldPersistTaps="always" contentContainerStyle={{ padding: 20, gap: 15 }}>
          <Text>Private Card source probe. Native fidelity and performance remain unaccepted.</Text>
          <Button title="Animate Card" onPress={() => void animate()} />
          <Button title="Stop" onPress={controls.stop} />
          <Button
            title="Set native array styles"
            onPress={() => {
              controls.set({
                transform: [{ translateX: 20 }, { rotate: "10deg" }],
                transformOrigin: ["50%", "50%", 0],
                fontVariant: ["tabular-nums"],
              })
              append({ event: "set-native-arrays", ...identity() })
            }}
          />
          <Button title="Toggle Card" onPress={() => setVisible((current) => !current)} />
          <Button title="Toggle layout width" onPress={() => setWide((current) => !current)} />
          <Button title="Toggle theme" onPress={() => setDark((current) => !current)} />
          <Button title="Toggle skip" onPress={() => setSkip((current) => !current)} />
          <Button title="Open native modal window" onPress={() => setModal(true)} />
          <NativeMotionConfig reducedMotion="user" skipAnimations={skip}>
            <Card
              testID="private-global-tap"
              globalTapTarget
              onTapStart={(event, info) => append({ event: "global-tap-start", native: event.nativeEvent, info })}
              onTap={(event, info) => append({ event: "global-tap", native: event.nativeEvent, info })}
              onTapCancel={(event, info) => append({ event: "global-tap-cancel", native: event.nativeEvent, info })}
            >
              <Text>Global tap observer: includes the button outside this scope, excludes the modal window.</Text>
            </Card>
            <NativeLayoutGroup id="private-card-probe">
              <NativeAnimatePresence mode="popLayout" onExitComplete={() => append({ event: "exit-complete" })}>
                {visible && (
                  <Card
                    key="card"
                    ref={root}
                    testID="private-card"
                    accessibilityLabel="Private Card"
                    layoutMode="size"
                    width={wide ? "100%" : "75%"}
                    borderRadius={10}
                    initial={{ x: 0, opacity: 1 }}
                    animate={controls}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onTapStart={(event, info) => append({ event: "card-tap-start", native: event.nativeEvent, info })}
                    onTap={(event, info) => append({ event: "card-tap", native: event.nativeEvent, info })}
                    onTapCancel={(event, info) => append({ event: "card-tap-cancel", native: event.nativeEvent, info })}
                    whileFocus={{ opacity: 0.95 }}
                    viewport={{ root: viewport, amount: "some" }}
                    onViewportEnter={(entry) => append({ event: "viewport-enter", ratio: entry.intersectionRatio })}
                    onViewportLeave={(entry) => append({ event: "viewport-leave", ratio: entry.intersectionRatio })}
                    onAnimationStart={(definition) => append({ event: "animation-start", definition })}
                    onAnimationComplete={(definition) =>
                      append({ event: "animation-complete", definition, ...identity() })
                    }
                    onLayoutAnimationComplete={() => append({ event: "layout-complete", ...identity() })}
                    customStyles={{ backgroundColor: dark ? "#171717" : "#ffffff" }}
                  >
                    <Text>Original editor and Card root</Text>
                    <TextInput
                      ref={editor}
                      testID="private-card-editor"
                      accessibilityLabel="Card editor"
                      value={value}
                      onChangeText={(request) => append({ event: "editor-request", request })}
                    />
                    <Button title="Owner echoes empty" onPress={() => setValue("")} />
                    <Button title="Owner echoes dirty" onPress={() => setValue("dirty")} />
                    <Card
                      testID="private-claimed-tap"
                      propagate={{ tap: false }}
                      whileTap={{ opacity: 0.5 }}
                      onTap={(event, info) => append({ event: "claimed-tap", native: event.nativeEvent, info })}
                    >
                      <Button
                        title="Claim motion tap; preserve native press"
                        onPress={() => append({ event: "claimed-native-press" })}
                      />
                    </Card>
                  </Card>
                )}
              </NativeAnimatePresence>
            </NativeLayoutGroup>
          </NativeMotionConfig>
          <Text testID="private-card-journal">{JSON.stringify(journal)}</Text>
        </ScrollView>
      </NativeKeyboardScope>
      <Modal visible={modal} onRequestClose={() => setModal(false)}>
        <NativeKeyboardScope captureEnabled>
          <View style={{ padding: 20, gap: 15 }}>
            <Text>The modal owns a separate actual window and global tap registration.</Text>
            <Card
              globalTapTarget
              onTap={(event, info) => append({ event: "modal-tap", native: event.nativeEvent, info })}
            >
              <Text>Modal global observer</Text>
              <TextInput
                accessibilityLabel="Modal held-empty editor"
                value=""
                onChangeText={(request) => append({ event: "modal-editor-request", request })}
              />
            </Card>
            <Button title="Close native modal" onPress={() => setModal(false)} />
          </View>
        </NativeKeyboardScope>
      </Modal>
    </NativeThemeProvider>
  )
}
