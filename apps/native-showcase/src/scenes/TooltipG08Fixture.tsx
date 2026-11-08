import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { AccessibilityInfo, findNodeHandle, View, type LayoutChangeEvent } from "react-native"

import {
  Button,
  NativeFocusView,
  NativeThemeProvider,
  NativeTooltipTrigger,
  Text,
  Tooltip,
  type TNativeTooltipTriggerRenderState,
} from "@codon-ui/react-native"

import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"
import { resolveNativeTheme } from "../../../../packages/react-native/src/theme/defaults"

type TRender = NonNullable<ComponentProps<typeof Tooltip>["render"]>
type TRenderState = Pick<Parameters<TRender>[1], "placement" | "isEntering" | "isExiting">
type TArrowLayout = {
  target: number | null
  currentTarget: number | null
  parentTag: number | null
  x: number
  y: number
  width: number
  height: number
}
const TooltipRootReport = ({
  props,
  state,
  report,
  reportArrow,
}: {
  props: Parameters<TRender>[0]
  state: Parameters<TRender>[1]
  report: (value: TRenderState) => void
  reportArrow: (event: LayoutChangeEvent) => void
}) => {
  useLayoutEffect(() => {
    report({ placement: state.placement, isEntering: state.isEntering, isExiting: state.isExiting })
  }, [state.placement, state.isEntering, state.isExiting, report])
  const observeArrow = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (
        !isValidElement<{ children?: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void }>(child)
      )
        return child
      return cloneElement(child, {
        ...(child.props.children === undefined ? {} : { children: observeArrow(child.props.children) }),
        ...(child.props.testID === "tooltip-native-surface-overlay-arrow"
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
export const TOOLTIP_STYLE_CASES = [
  "baseline",
  "custom",
  "final",
  "arrow-zero",
  "narrow",
  "dark",
  "light-restored",
] as const
type TMode = "behavior" | "styles" | "motion"
type TEvent = { phase: string; epochMs: number; target: number | null; currentTarget: number | null }
type TRootLayout = { target: number | null; currentTarget: number | null; width: number; height: number }
type TCommand = { name: string; epochMs: number; rootLayout?: TRootLayout; rendered?: TRenderState }
const tag = (value: unknown) =>
  typeof value === "number" ? value : value == null ? null : findNodeHandle(value as View)

export const TooltipG08Fixture = () => {
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0),
    [open, setOpen] = useState(false),
    [veto, setVeto] = useState(false)
  const [mounted, setMounted] = useState(true),
    [lifetime, setLifetime] = useState(0),
    [actions, setActions] = useState(0)
  const [rootTag, setRootTag] = useState<number | null>(null),
    [anchorTag, setAnchorTag] = useState<number | null>(null)
  const [requests, setRequests] = useState<{ value: boolean; epochMs: number }[]>([]),
    [commands, setCommands] = useState<TCommand[]>([]),
    [events, setEvents] = useState<TEvent[]>([])
  const [layouts, setLayouts] = useState<TRootLayout[]>([])
  const [rendered, setRendered] = useState<TRenderState>({ placement: null, isEntering: false, isExiting: false })
  const [arrowLayout, setArrowLayout] = useState<TArrowLayout | null>(null)
  const [inspection, setInspection] = useState<Record<string, unknown> | null>(null),
    [inspectionSequence, setInspectionSequence] = useState(0)
  const [selected, setSelected] = useState(false),
    [forceEntering, setForceEntering] = useState(false),
    [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const root = useRef<View | null>(null),
    trigger = useRef<TNativeTooltipTriggerRenderState | null>(null),
    live = useRef(true),
    inspectionGeneration = useRef(0),
    entryRequested = useRef(false),
    nativeLayout = useRef<TRootLayout | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const name = mode === "styles" ? TOOLTIP_STYLE_CASES[index] : mode
  const palette = name === "dark" ? "dark" : "light",
    custom = name === "custom" || name === "final",
    narrow = name === "narrow"
  const foreground = selected ? "#117733" : "#bb3322"
  const bind = useCallback((node: View | null) => {
    root.current = node
    setRootTag(tag(node))
  }, [])
  const reportArrow = useCallback((event: LayoutChangeEvent) => {
    const value = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      parentTag: tag(root.current),
      ...event.nativeEvent.layout,
    }
    setArrowLayout((old) => (JSON.stringify(old) === JSON.stringify(value) ? old : value))
  }, [])
  const report = useCallback((value: TRenderState) => {
    setRendered((old) => (JSON.stringify(old) === JSON.stringify(value) ? old : value))
    const rootLayout = nativeLayout.current
    if (entryRequested.current && value.isEntering && rootLayout) {
      const epochMs = Date.now()
      setCommands((old) =>
        old.some((row) => row.name === "entry-acknowledged")
          ? old
          : [...old, { name: "entry-acknowledged", epochMs, rootLayout: { ...rootLayout }, rendered: { ...value } }],
      )
    }
  }, [])
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const value = { phase, epochMs: Date.now(), target: tag(event.target), currentTarget: tag(event.currentTarget) }
    setEvents((old) => [...old, value])
  }
  useEffect(() => {
    live.current = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (live.current) setMotionEvents((old) => [...old, value])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live.current) setMotionEvents((old) => (old.length ? old : [value]))
    })
    return () => {
      live.current = false
      listener.remove()
      timers.current.forEach(clearTimeout)
    }
  }, [])
  const note = (name: string) => {
    const epochMs = Date.now()
    setCommands((old) => [...old, { name, epochMs }])
  }
  const command = (operation: "open" | "close", immediate: boolean) => {
    note(operation + (immediate ? "-now" : "-delayed"))
    trigger.current?.[operation](immediate)
  }
  const changeMode = (next: TMode) => {
    entryRequested.current = false
    timers.current.forEach(clearTimeout)
    timers.current = []
    setOpen(next !== "behavior")
    setMode(next)
    setIndex(0)
    setVeto(false)
    setMounted(true)
    setLifetime((old) => old + 1)
    setRequests([])
    setCommands([])
    setEvents([])
    setActions(0)
    setSelected(false)
    setForceEntering(false)
    setInspection(null)
    inspectionGeneration.current++
  }
  const inspect = () => {
    const generation = ++inspectionGeneration.current,
      target = trigger.current?.triggerRef.current
    if (
      !target ||
      !inspectNativeAccessibility(target, (event) => {
        if (live.current && generation === inspectionGeneration.current) {
          setInspection({ ...event.nativeEvent })
          setInspectionSequence(generation)
        }
      })
    ) {
      setInspection({ error: "unregistered-target" })
      setInspectionSequence(generation)
    }
  }
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    }
    nativeLayout.current = row
    setLayouts((old) => (JSON.stringify(old.at(-1)) === JSON.stringify(row) ? old : [...old, row]))
  }
  const retire = () => {
    note("retire")
    setMounted(false)
    inspectionGeneration.current++
  }
  const arm = () => {
    entryRequested.current = false
    timers.current.forEach(clearTimeout)
    setCommands([])
    setSelected(false)
    setForceEntering(false)
    setMounted(true)
    setOpen(true)
    const schedule = (delay: number, key: string, action: () => void) =>
      setTimeout(() => {
        note(key)
        action()
      }, delay)
    timers.current = [
      ...Array.from({ length: 40 }, (_, i) =>
        schedule(3000 + i * 100, `retarget-${i}`, () => {
          setSelected(i % 2 === 0)
        }),
      ),
      schedule(7500, "settle", () => {
        setSelected(true)
        entryRequested.current = true
        setForceEntering(true)
      }),
      schedule(9000, "retire", () => {
        entryRequested.current = false
        setForceEntering(false)
        setMounted(false)
      }),
      schedule(11000, "fresh", () => {
        setLifetime((old) => old + 1)
        setMounted(true)
      }),
    ]
  }
  const state = {
    mode,
    case: name,
    open,
    veto,
    mounted,
    lifetime,
    rootTag,
    anchorTag,
    actions,
    requests,
    commands,
    events,
    layouts,
    rendered,
    arrowLayout,
    inspection,
    inspectionSequence,
    narrow,
    palette,
    selected,
    forceEntering,
    motionEvents,
    foreground,
    background:
      mode === "motion"
        ? "#224466"
        : name === "final"
          ? "#ffeedd"
          : custom
            ? "#ddeeff"
            : resolveNativeTheme(palette).colors.foreground,
    textColor: mode === "motion" ? foreground : custom ? "#7a3bba" : resolveNativeTheme(palette).colors.background,
    canvasColor: mode === "motion" ? "#ffffff" : "#808080",
  }
  return (
    <NativeThemeProvider mode={palette}>
      <View testID="tooltip-native-fixture" style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(["behavior", "styles", "motion"] as const).map((next) => (
            <Button key={next} raised={false} onPress={() => changeMode(next)}>
              Tooltip {next}
            </Button>
          ))}
        </View>
        <Text testID="tooltip-native-state" accessibilityLabel={JSON.stringify(state)} numberOfLines={1}>
          Tooltip check: {name}
        </Text>
        {mode === "behavior" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Button raised={false} onPress={() => command("open", false)}>
              Open delayed
            </Button>
            <Button raised={false} onPress={() => command("open", true)}>
              Open now
            </Button>
            <Button raised={false} onPress={() => command("close", false)}>
              Close delayed
            </Button>
            <Button raised={false} onPress={() => command("close", true)}>
              Close now
            </Button>
            <Button raised={false} onPress={() => setVeto((old) => !old)}>
              Veto owner
            </Button>
          </View>
        ) : mode === "styles" ? (
          <Button raised={false} onPress={() => setIndex((old) => (old + 1) % TOOLTIP_STYLE_CASES.length)}>
            Next Tooltip style
          </Button>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Button raised={false} onPress={() => setSelected(false)}>
                First
              </Button>
              <Button raised={false} onPress={() => setSelected(true)}>
                Second
              </Button>
            </View>
            <Button raised={false} onPress={arm}>
              Arm Tooltip motion
            </Button>
          </>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Button raised={false} onPress={inspect}>
            Inspect anchor
          </Button>
          <Button raised={false} onPress={retire}>
            Retire tooltip
          </Button>
          <Button
            raised={false}
            onPress={() => {
              note("fresh")
              setOpen(false)
              setLifetime((old) => old + 1)
              setMounted(true)
            }}
          >
            Fresh tooltip
          </Button>
        </View>
        <View
          testID="tooltip-native-canvas"
          collapsable={false}
          style={{
            width: "100%",
            height: 340,
            paddingTop: 200,
            alignItems: "center",
            backgroundColor: state.canvasColor,
          }}
        >
          {mounted ? (
            <NativeTooltipTrigger
              key={lifetime}
              isOpen={open}
              onOpenChange={(value) => {
                const epochMs = Date.now()
                setRequests((old) => [...old, { value, epochMs }])
                if (!veto) setOpen(value)
              }}
              trigger={(value) => {
                trigger.current = value
                return (
                  <Button
                    {...value.triggerProps}
                    testID="tooltip-native-anchor"
                    onLayout={() => setAnchorTag(tag(value.triggerRef.current))}
                    onPress={(event) => {
                      record("press", event)
                      setActions((old) => old + 1)
                    }}
                  >
                    Original action
                  </Button>
                )
              }}
            >
              <Tooltip
                ref={bind}
                testID="tooltip-native-surface"
                render={(props, state) => <TooltipRootReport {...{ props, state, report, reportArrow }} />}
                placement="top"
                width={mode === "motion" ? 220 : narrow ? 128 : 220}
                height={mode === "motion" ? 60 : undefined}
                showOverlayArrow={mode !== "motion"}
                raised={mode === "motion" ? false : undefined}
                isEntering={forceEntering}
                descriptionLabel="Action details"
                onLayout={layout}
                customStyles={
                  mode === "motion"
                    ? { backgroundColor: "#224466", color: foreground, fontSize: 30, lineHeight: 38, padding: 8 }
                    : custom
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
                customOverlayArrowStyles={
                  name === "arrow-zero" ? { width: 0 } : custom ? { width: 18, fill: "#2f7d18" } : undefined
                }
              >
                {mode === "motion" ? (
                  <Text testID="tooltip-native-motion-glyph" customStyles={{ fontSize: 30, lineHeight: 38 }}>
                    ██████
                  </Text>
                ) : (
                  <Text testID="tooltip-native-body">
                    {narrow
                      ? "Renseignements détaillés qui restent entièrement lisibles dans une description étroite."
                      : "Native description / renseignements"}
                  </Text>
                )}
              </Tooltip>
            </NativeTooltipTrigger>
          ) : null}
        </View>
      </View>
    </NativeThemeProvider>
  )
}
