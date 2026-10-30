import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { cloneElement, createRef, type PropsWithChildren, type ReactElement } from "react"
import { AccessibilityInfo, processColor, Text as RNText, type View } from "react-native"

import {
  CircularProgress,
  NativeCircularProgressContext,
  NativeCircularProgressLabel,
  NativeCircularProgressLabelContext,
  NativeFocusView,
  NativeLocaleProvider,
  type TNativeCircularProgressRootRender,
  type TNativeCircularProgressRenderState,
  type TNativeTextRef,
} from "../../.."
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("supplies its current root foreground to the original native typography receiver", async () => {
  const ref = createRef<View>()
  const node = (updated: boolean) => (
    <CircularProgress ref={ref} value={25} customStyles={{ color: updated ? "green" : "purple" }} />
  )
  const view = await render(node(false))
  const original = ref.current
  expect(JSON.parse(screen.getByRole("progressbar").props.nativeTypographyStyle ?? "{}")).toMatchObject({
    color: processColor("purple"),
  })
  await view.rerender(node(true))
  expect(ref.current === original).toBe(true)
  expect(JSON.parse(screen.getByRole("progressbar").props.nativeTypographyStyle ?? "{}")).toMatchObject({
    color: processColor("green"),
  })
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("merges context at the root while retaining wrapper geometry, original refs and progress renderer state", async () => {
  const ref = createRef<View>()
  const contextRef = createRef<View>()
  const states: TNativeCircularProgressRenderState[] = []
  const events: unknown[] = []
  const node = (custom: boolean) => (
    <NativeCircularProgressContext.Provider
      value={{
        ref: contextRef,
        maxValue: 200,
        style: { padding: 7, height: 72 },
        onLayout: (event) => events.push(event),
      }}
    >
      <CircularProgress
        value={50}
        ref={ref}
        customStyles={{ padding: 0 }}
        onLayout={(event) => events.push(event)}
        render={
          custom
            ? (props, state) => {
                states.push(state)
                return <NativeFocusView {...props} />
              }
            : undefined
        }
      />
    </NativeCircularProgressContext.Provider>
  )
  const view = await render(node(false))
  const original = ref.current
  const path = screen.getByTestId("circular-progress-path", { includeHiddenElements: true }).props.strokeDashoffset
  expect(contextRef.current === original).toBe(true)
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ min: 0, max: 200, now: 50, text: "25%" })
  expect(screen.getByRole("progressbar")).toHaveStyle({ padding: 0, height: 72 })
  await view.rerender(node(true))
  expect(ref.current === original).toBe(true)
  expect(states.at(-1)).toEqual({ percentage: 25, valueText: "25%", isIndeterminate: false })
  expect(screen.getByTestId("circular-progress-path", { includeHiddenElements: true }).props.strokeDashoffset).toBe(
    path,
  )
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 72 } } }
  await fireEvent(screen.getByRole("progressbar"), "layout", event)
  expect(events).toEqual([event, event])
  await view.rerender(node(false))
  expect(ref.current === original).toBe(true)
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(contextRef.current).toBeNull()
})

it("keeps default/named/null contexts and inline style/range ownership independent", async () => {
  const states: unknown[] = []
  const node = (slot: string | null | undefined) => (
    <NativeCircularProgressContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: { maxValue: 200 },
          task: {
            maxValue: 400,
            style: (state) => {
              states.push(state)
              return { padding: 7 }
            },
          },
        },
      }}
    >
      <CircularProgress slot={slot} value={50} style={({ defaultStyle }) => [defaultStyle, { padding: 0 }]} />
    </NativeCircularProgressContext.Provider>
  )
  const view = await render(node("task"))
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ max: 400, text: "13%" })
  expect(states.at(-1)).toMatchObject({ percentage: 12.5, valueText: "13%", isIndeterminate: false })
  expect(screen.getByRole("progressbar")).toHaveStyle({ padding: 0 })
  await view.rerender(node(undefined))
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ max: 200, text: "25%" })
  await view.rerender(node(null))
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ max: 100, text: "50%" })
})

it("binds the reachable scoped label and retires it without changing the original progress host", async () => {
  const ref = createRef<View>()
  const labelRef = createRef<TNativeTextRef>()
  const onLayout = jest.fn()
  const labels: string[] = []
  const root: TNativeCircularProgressRootRender = (props) => {
    const provider = props.children as ReactElement<PropsWithChildren>
    return (
      <NativeFocusView {...props}>
        {cloneElement(
          provider,
          undefined,
          <>
            <NativeCircularProgressLabel ref={labelRef} testID="progress-label" onLayout={onLayout}>
              Transfer
            </NativeCircularProgressLabel>
            {provider.props.children}
          </>,
        )}
      </NativeFocusView>
    )
  }
  const view = await render(<CircularProgress ref={ref} value={25} render={root} />)
  const original = ref.current
  const label = screen.getByTestId("progress-label")
  labels.push(label.props.nativeID)
  expect(labelRef.current).not.toBeNull()
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toEqual(labels)
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 90, height: 20 } } }
  await fireEvent(label, "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
  await view.rerender(
    <CircularProgress
      ref={ref}
      value={0}
      render={root}
      aria-label="Explicit"
      aria-describedby="first second"
      aria-details="details"
      labels={{ descriptionLabel: "Description", detailsLabel: "Détails" }}
    />,
  )
  expect(ref.current === original).toBe(true)
  expect(screen.getByRole("progressbar").props).toMatchObject({
    accessibilityLabel: "Explicit",
    nativeDescribedBy: ["first", "second"],
    nativeDetailsBy: ["details"],
    nativeDetailsLabel: "Détails",
  })
  await view.rerender(<CircularProgress ref={ref} value={0} />)
  expect(ref.current === original).toBe(true)
  expect(labelRef.current).toBeNull()
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toBeUndefined()
})

it("merges actual label refs/events/styles with undefined renderer state and null slot opt-out", async () => {
  const ref = createRef<TNativeTextRef>()
  const contextRef = createRef<TNativeTextRef>()
  const states: unknown[] = []
  const events: unknown[] = []
  const node = (slot: null | undefined) => (
    <NativeCircularProgressLabelContext.Provider
      value={{
        ref: contextRef,
        style: { fontStyle: "italic", letterSpacing: 7 },
        onLayout: (event) => events.push(event),
        render: (props, state) => {
          states.push(state)
          return <RNText {...props} />
        },
      }}
    >
      <NativeCircularProgressLabel
        ref={ref}
        slot={slot}
        testID="label"
        style={{ letterSpacing: 0 }}
        onLayout={(event) => events.push(event)}
      >
        Transfer
      </NativeCircularProgressLabel>
    </NativeCircularProgressLabelContext.Provider>
  )
  const view = await render(node(undefined))
  const original = ref.current
  expect(contextRef.current === original).toBe(true)
  expect(screen.getByTestId("label")).toHaveStyle({ fontStyle: "italic", letterSpacing: 0 })
  expect(states.every((state) => state === undefined)).toBe(true)
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 90, height: 20 } } }
  await fireEvent(screen.getByTestId("label"), "layout", event)
  expect(events).toEqual([event, event])
  await view.rerender(node(null))
  expect(ref.current === original).toBe(true)
  expect(contextRef.current).toBeNull()
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("selects named label context and preserves authored native identity before default/null replacement", async () => {
  const ref = createRef<TNativeTextRef>()
  const contextRef = createRef<TNativeTextRef>()
  const node = (slot: string | null | undefined) => (
    <NativeCircularProgressLabelContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: { id: "default-label", style: { letterSpacing: 5 } },
          task: { ref: contextRef, id: "context-label", style: { fontStyle: "italic", letterSpacing: 7 } },
        },
      }}
    >
      <NativeCircularProgressLabel
        ref={ref}
        slot={slot}
        nativeID="authored-label"
        style={{ letterSpacing: 0 }}
        testID="named-label"
      >
        Transfer
      </NativeCircularProgressLabel>
    </NativeCircularProgressLabelContext.Provider>
  )
  const view = await render(node("task"))
  const original = ref.current
  expect(contextRef.current === original).toBe(true)
  expect(screen.getByTestId("named-label").props.nativeID).toBe("authored-label")
  expect(screen.getByTestId("named-label")).toHaveStyle({ fontStyle: "italic", letterSpacing: 0 })
  await view.rerender(node(undefined))
  expect(ref.current === original).toBe(true)
  expect(contextRef.current).toBeNull()
  expect(screen.getByTestId("named-label")).toHaveStyle({ letterSpacing: 0 })
  await view.rerender(node(null))
  expect(ref.current === original).toBe(true)
  expect(screen.getByTestId("named-label").props.nativeID).toBe("authored-label")
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("uses the current locale provider and preserves raw rich semantic values without mounting them", async () => {
  const label = <RNText>Never mounted</RNText>
  const renderRoot = jest.fn(
    (props: Parameters<TNativeCircularProgressRootRender>[0], _state: TNativeCircularProgressRenderState) => (
      <NativeFocusView {...props} />
    ),
  )
  const view = await render(
    <NativeLocaleProvider locale="fr-CA">
      <CircularProgress value={25} render={renderRoot} />
    </NativeLocaleProvider>,
  )
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ text: "25 %" })
  await view.rerender(<CircularProgress value={25} valueLabel={label} render={renderRoot} />)
  expect(renderRoot.mock.calls.at(-1)?.[1].valueText).toBe(label)
  expect(screen.queryByText("Never mounted")).toBeNull()
  await act(async () => view.unmount())
})

it("tracks the reachable label's authored ID through replacement and removal", async () => {
  const rootRef = createRef<View>()
  const labelRef = createRef<TNativeTextRef>()
  const node = (id: string | undefined, show = true, combined = false) => (
    <CircularProgress
      ref={rootRef}
      nativeID="task-progress"
      aria-label={combined ? "Task" : undefined}
      aria-labelledby={combined ? "external-one external-two" : undefined}
      value={25}
      render={(props) => {
        const provider = props.children as ReactElement<PropsWithChildren>
        return (
          <NativeFocusView {...props}>
            {cloneElement(
              provider,
              undefined,
              <>
                {show ? (
                  <NativeCircularProgressLabel ref={labelRef} nativeID={id} testID="owned-label">
                    Transfer
                  </NativeCircularProgressLabel>
                ) : null}
                {provider.props.children}
              </>,
            )}
          </NativeFocusView>
        )
      }}
    />
  )
  const view = await render(node("transfer-one"))
  const original = rootRef.current
  const label = labelRef.current
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toEqual(["transfer-one"])
  await view.rerender(node("transfer-two"))
  expect(rootRef.current === original).toBe(true)
  expect(labelRef.current === label).toBe(true)
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toEqual(["transfer-two"])
  await view.rerender(node("transfer-two", true, true))
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toEqual([
    "task-progress",
    "transfer-two",
    "external-one",
    "external-two",
  ])
  await view.rerender(node(undefined))
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toEqual([
    screen.getByTestId("owned-label").props.nativeID,
  ])
  await view.rerender(node(undefined, false))
  expect(labelRef.current).toBeNull()
  expect(screen.getByRole("progressbar").props.nativeLabelledBy).toBeUndefined()
})
