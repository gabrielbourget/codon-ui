import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react"
import { AccessibilityInfo, findNodeHandle, TextInput, View, type LayoutChangeEvent } from "react-native"

import {
  Button,
  ClickPopover,
  NativeDialogTrigger,
  NativeFocusView,
  NativeThemeProvider,
  Text,
  type TNativeDialogTriggerRenderState,
} from "@codon-ui/react-native"

import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"
import {
  focusNativeTarget,
  getNativeFocusedTarget,
  getNativeFocusTargetWindow,
  subscribeNativeFocus,
} from "../../../../packages/react-native/src/input/focus"
import { resolveNativeTheme } from "../../../../packages/react-native/src/theme/defaults"

type TRender = NonNullable<ComponentProps<typeof ClickPopover>["render"]>
type TRenderState = Parameters<TRender>[1]
type TLayout = { target: number | null; currentTarget: number | null; width: number; height: number }
type TAnchorMeasurement = {
  sequence: number
  target: number | null
  rootTag: number | null
  lifetime: number
  case: string
  windowId: string | null
  rootWindowId: string | null
  requestedEpochMs: number
  observedEpochMs: number
  frame: number[]
}
const tag = (value: unknown) =>
  typeof value === "number" ? value : value == null ? null : findNodeHandle(value as View)
const PopoverRootReport = ({
  props,
  state,
  report,
  reportArrow,
}: {
  props: Parameters<TRender>[0]
  state: TRenderState
  report: (value: TRenderState) => void
  reportArrow: (event: LayoutChangeEvent) => void
}) => {
  useLayoutEffect(
    () => report(state),
    [state.trigger, state.placement, state.isEntering, state.isExiting, report, state],
  )
  const observeArrow = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (
        !isValidElement<{ children?: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void }>(child)
      )
        return child
      return cloneElement(child, {
        ...(child.props.children === undefined ? {} : { children: observeArrow(child.props.children) }),
        ...(child.props.testID === "popover-native-surface-overlay-arrow"
          ? {
              onLayout: (event: LayoutChangeEvent) => {
                reportArrow(event)
                child.props.onLayout?.(event)
              },
            }
          : {}),
      })
    })
  return <NativeFocusView {...props}>{observeArrow(props.children)}</NativeFocusView>
}
export const POPOVER_STYLE_CASES = [
  "baseline",
  "custom",
  "final",
  "arrow-zero",
  "narrow",
  "dark",
  "light-restored",
] as const
type TMode = "behavior" | "styles" | "lifetime"

export const ClickPopoverG08Fixture = () => {
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0),
    [open, setOpen] = useState(false),
    [echo, setEcho] = useState(true),
    [veto, setVeto] = useState(false),
    [nonmodal, setNonmodal] = useState(false),
    [mounted, setMounted] = useState(true),
    [lifetime, setLifetime] = useState(0),
    [actions, setActions] = useState(0),
    [backgroundActions, setBackgroundActions] = useState(0),
    [value, setValue] = useState("owner")
  const [rootTag, setRootTag] = useState<number | null>(null),
    [anchorTag, setAnchorTag] = useState<number | null>(null),
    [entryTag, setEntryTag] = useState<number | null>(null)
  const [requests, setRequests] = useState<{ value: boolean; epochMs: number }[]>([]),
    [outside, setOutside] = useState<{ kind: string; target: number | null; epochMs: number }[]>([]),
    [events, setEvents] = useState<{ phase: string; target: number | null; currentTarget: number | null }[]>([]),
    [layouts, setLayouts] = useState<TLayout[]>([]),
    [rendered, setRendered] = useState<TRenderState>({
      trigger: null,
      placement: null,
      isEntering: false,
      isExiting: false,
    }),
    [arrowLayout, setArrowLayout] = useState<Record<string, number | null> | null>(null),
    [inspection, setInspection] = useState<Record<string, unknown> | null>(null),
    [inspectionSequence, setInspectionSequence] = useState(0),
    [motionEvents, setMotionEvents] = useState<boolean[]>([]),
    [anchorMeasurement, setAnchorMeasurement] = useState<TAnchorMeasurement | null>(null)
  const root = useRef<View | null>(null),
    entry = useRef<View | null>(null),
    editor = useRef<TextInput | null>(null),
    background = useRef<View | null>(null),
    trigger = useRef<TNativeDialogTriggerRenderState | null>(null),
    live = useRef(true),
    generation = useRef(0),
    measurementSequence = useRef(0)
  const focused = useSyncExternalStore(subscribeNativeFocus, getNativeFocusedTarget, getNativeFocusedTarget)
  const name = mode === "styles" ? POPOVER_STYLE_CASES[index] : mode,
    custom = name === "custom" || name === "final",
    narrow = name === "narrow",
    palette = name === "dark" ? "dark" : "light",
    showArrow = custom || name === "arrow-zero"
  const measurementContext = useRef({ lifetime, name })
  measurementContext.current = { lifetime, name }
  const theme = resolveNativeTheme(palette)
  const bind = useCallback((node: View | null) => {
    root.current = node
    setRootTag(tag(node))
  }, [])
  const report = useCallback((next: TRenderState) => {
    setRendered((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : { ...next }))
  }, [])
  const reportArrow = useCallback((event: LayoutChangeEvent) => {
    const next = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      parentTag: tag(root.current),
      ...event.nativeEvent.layout,
    }
    setArrowLayout((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next))
  }, [])
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const row = { phase, target: tag(event.target), currentTarget: tag(event.currentTarget) }
    setEvents((old) => [...old, row])
  }
  useEffect(() => {
    live.current = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (next) => {
      if (live.current) setMotionEvents((old) => [...old, next])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((next) => {
      if (live.current) setMotionEvents((old) => (old.length ? old : [next]))
    })
    return () => {
      live.current = false
      generation.current++
      listener.remove()
    }
  }, [])
  const inspect = () => {
    const sequence = ++generation.current,
      target = root.current
    if (
      !inspectNativeAccessibility(target, (event) => {
        if (live.current && sequence === generation.current && target === root.current) {
          setInspection({ ...event.nativeEvent })
          setInspectionSequence(sequence)
        }
      })
    ) {
      setInspection({ error: "unregistered-target" })
      setInspectionSequence(sequence)
    }
  }
  const measureAnchor = () => {
    const target = trigger.current?.triggerRef.current,
      originalRoot = root.current,
      originalGeneration = generation.current,
      sequence = ++measurementSequence.current,
      requestedEpochMs = Date.now()
    if (!target || !originalRoot) return
    const windowId = getNativeFocusTargetWindow(target) ?? null,
      rootWindowId = getNativeFocusTargetWindow(originalRoot) ?? null
    target.measureInWindow((x, y, width, height) => {
      if (
        !live.current ||
        sequence !== measurementSequence.current ||
        originalGeneration !== generation.current ||
        target !== trigger.current?.triggerRef.current ||
        originalRoot !== root.current ||
        measurementContext.current.lifetime !== lifetime ||
        measurementContext.current.name !== name ||
        (getNativeFocusTargetWindow(target) ?? null) !== windowId ||
        (getNativeFocusTargetWindow(originalRoot) ?? null) !== rootWindowId
      )
        return
      setAnchorMeasurement({
        sequence,
        target: tag(target),
        rootTag: tag(originalRoot),
        lifetime,
        case: name,
        windowId,
        rootWindowId,
        requestedEpochMs,
        observedEpochMs: Date.now(),
        frame: [x, y, width, height],
      })
    })
  }
  const changeMode = (next: TMode) => {
    generation.current++
    setMode(next)
    setIndex(0)
    setOpen(false)
    setEcho(true)
    setVeto(false)
    setNonmodal(false)
    setMounted(true)
    setLifetime((old) => old + 1)
    setRequests([])
    setOutside([])
    setEvents([])
    setActions(0)
    setBackgroundActions(0)
    setInspection(null)
  }
  const state = {
    mode,
    case: name,
    open,
    echo,
    veto,
    nonmodal,
    mounted,
    lifetime,
    actions,
    backgroundActions,
    value,
    rootTag,
    anchorTag,
    entryTag,
    editorTag: tag(editor.current),
    focusedTag: tag(focused),
    backgroundTag: tag(background.current),
    requests,
    outside,
    events,
    layouts,
    rendered,
    arrowLayout: showArrow ? arrowLayout : null,
    showArrow,
    narrow,
    palette,
    inspection,
    inspectionSequence,
    motionEvents,
    anchorMeasurement,
    background: name === "final" ? "#ffeedd" : custom ? "#ddeeff" : theme.colors.background,
    textColor: custom ? "#7a3bba" : theme.colors.foreground,
    dialogPadding: custom ? 4 : 0,
  }
  const status = (inside: boolean) => (
    <Text
      testID={inside ? "popover-native-open-state" : "popover-native-state"}
      accessibilityLabel={JSON.stringify(state)}
      numberOfLines={1}
    >
      Popover check: {name}
    </Text>
  )
  const controls = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      <Button
        ref={entry}
        testID="popover-native-action"
        raised={false}
        onLayout={() => setEntryTag(tag(entry.current))}
        onFocus={(event) => record("entry-focus", event)}
        onPress={(event) => {
          record("action", event)
          setActions((old) => old + 1)
        }}
      >
        Original content action
      </Button>
      <Button raised={false} onPress={() => trigger.current?.close()}>
        Close popover
      </Button>
      <Button raised={false} onPress={inspect}>
        Inspect popover
      </Button>
      <Button raised={false} focusable={false} onPress={measureAnchor}>
        Measure original anchor
      </Button>
      {mode === "styles" ? (
        <Button raised={false} onPress={() => setIndex((old) => (old + 1) % POPOVER_STYLE_CASES.length)}>
          Next popover style
        </Button>
      ) : (
        <>
          <Button raised={false} onPress={() => setEcho((old) => !old)}>
            Toggle owner echo
          </Button>
          <Button raised={false} onPress={() => setVeto((old) => !old)}>
            Toggle outside veto
          </Button>
          <Button
            raised={false}
            onPress={() => {
              setMounted(false)
              generation.current++
            }}
          >
            Retire popover owner
          </Button>
        </>
      )}
    </View>
  )
  const backgroundAction = (
    <Button
      ref={background}
      testID="popover-native-background"
      raised={false}
      onPress={() => {
        setBackgroundActions((old) => old + 1)
        focusNativeTarget(background.current)
      }}
    >
      Background action
    </Button>
  )
  return (
    <NativeThemeProvider mode={palette}>
      <View testID="popover-native-fixture" style={{ gap: 8 }}>
        {mode === "behavior" && backgroundAction}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {(["behavior", "styles", "lifetime"] as const).map((next) => (
            <Button key={next} raised={false} onPress={() => changeMode(next)}>
              Popover {next}
            </Button>
          ))}
        </View>
        {status(false)}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Button raised={false} onPress={() => setEcho((old) => !old)}>
            Set closed owner echo
          </Button>
          <Button raised={false} onPress={() => setNonmodal((old) => !old)}>
            Set nonmodal popover
          </Button>
          <Button
            raised={false}
            onPress={() => {
              generation.current++
              setOpen(false)
              setMounted(true)
              setLifetime((old) => old + 1)
            }}
          >
            Fresh popover owner
          </Button>
          {mode !== "behavior" && backgroundAction}
        </View>
        <Text nativeID="popover-native-description">Original supplementary popover details</Text>
        <View
          testID="popover-native-canvas"
          collapsable={false}
          style={{ width: "100%", height: 400, paddingTop: 260, alignItems: "center", backgroundColor: "#808080" }}
        >
          {mounted && (
            <NativeDialogTrigger
              key={lifetime}
              isOpen={open}
              onOpenChange={(next) => {
                const epochMs = Date.now()
                setRequests((old) => [...old, { value: next, epochMs }])
                if (echo) setOpen(next)
              }}
              trigger={(next) => {
                trigger.current = next
                return (
                  <Button
                    {...next.triggerProps}
                    testID="popover-native-anchor"
                    onLayout={() => setAnchorTag(tag(next.triggerRef.current))}
                    onFocus={(event) => record("anchor-focus", event)}
                    onPress={(event) => {
                      record("anchor-press", event)
                      next.triggerProps.onPress(event)
                    }}
                  >
                    Original popover action
                  </Button>
                )
              }}
            >
              <ClickPopover
                ref={bind}
                testID="popover-native-surface"
                accessibilityLabel="Native popover"
                aria-describedby="popover-native-description"
                placement="top"
                width={narrow ? 128 : 280}
                isNonModal={nonmodal}
                initialFocusRef={mode === "styles" ? undefined : entry}
                showOverlayArrow={showArrow ? true : undefined}
                render={(props, current) => (
                  <PopoverRootReport props={props} state={current} report={report} reportArrow={reportArrow} />
                )}
                onLayout={(event) => {
                  const next = {
                    target: tag(event.target),
                    currentTarget: tag(event.currentTarget),
                    width: event.nativeEvent.layout.width,
                    height: event.nativeEvent.layout.height,
                  }
                  setLayouts((old) => (JSON.stringify(old.at(-1)) === JSON.stringify(next) ? old : [...old, next]))
                }}
                customStyles={
                  custom
                    ? {
                        backgroundColor: "#ddeeff",
                        color: "#7a3bba",
                        padding: 7,
                        borderWidth: 3,
                        borderColor: "#117733",
                      }
                    : undefined
                }
                style={name === "final" ? { padding: 3, borderWidth: 1, backgroundColor: "#ffeedd" } : undefined}
                customDialogStyles={custom ? { padding: 4, gap: 2 } : undefined}
                customOverlayArrowStyles={
                  name === "arrow-zero" ? { width: 0 } : custom ? { width: 18, fill: "#2f7d18" } : undefined
                }
                shouldCloseOnInteractOutside={(interaction) => {
                  setOutside((old) => [
                    ...old,
                    { kind: interaction.kind ?? "touch", target: tag(interaction.target), epochMs: Date.now() },
                  ])
                  return !veto
                }}
              >
                {status(true)}
                <Text testID="popover-native-body">
                  {narrow
                    ? "Renseignements détaillés entièrement lisibles dans une fenêtre étroite."
                    : "Native popover content"}
                </Text>
                {mode !== "styles" && (
                  <TextInput
                    ref={editor}
                    testID="popover-native-editor"
                    accessibilityLabel="Original popover editor"
                    value={value}
                    onChangeText={setValue}
                    onFocus={(event) => record("editor-focus", event)}
                    onBlur={(event) => record("editor-blur", event)}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit
                    style={{ height: 36, borderWidth: 1 }}
                  />
                )}
                {controls}
              </ClickPopover>
            </NativeDialogTrigger>
          )}
        </View>
      </View>
    </NativeThemeProvider>
  )
}
