import { fireEvent, render, screen } from "@testing-library/react-native"
import { cloneElement, createRef, type PropsWithChildren, type ReactElement } from "react"
import { AccessibilityInfo, StyleSheet, Text as RNText, TextInput, type View } from "react-native"

import {
  Button,
  CircularProgress,
  Counter,
  FormField,
  NativeCircularProgressLabel,
  NativeFocusView,
  Text,
  type TNativeCircularProgressRootRender,
  type TNativeTextRef,
} from "../../.."
import { NativeTextStyleProvider } from "../../NativeTextStyleProvider"

beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it("keeps explicit family metrics, independent Button defaults and original held content through owner updates", async () => {
  const rootRef = createRef<View>()
  const counterRef = createRef<View>()
  const buttonRef = createRef<View>()
  const editorRef = createRef<TextInput>()
  const rawRef = createRef<RNText>()
  const change = jest.fn()
  const press = jest.fn()
  const node = (updated: boolean) => (
    <FormField
      ref={rootRef}
      label="Label"
      description="Description"
      errorMessages={["Error"]}
      customStyles={{ fontFamily: updated ? "NextField" : "FieldBody", lineHeight: updated ? 28 : 26 }}
      customLabelStyles={{ fontFamily: "LabelBody", lineHeight: 20 }}
    >
      <Counter
        ref={counterRef}
        value={0}
        maxValue={10}
        showMaxValue
        customStyles={{ fontFamily: "CounterBody", lineHeight: 30 }}
        customTextStyles={{ fontFamily: "NumberBody", lineHeight: 19 }}
      >
        <Text>Counter child</Text>
      </Counter>
      <Button ref={buttonRef} onPress={press}>
        Independent button
      </Button>
      <TextInput ref={editorRef} testID="held" value="held" selection={{ start: 1, end: 1 }} onChangeText={change} />
      <RNText ref={rawRef} style={{ fontFamily: "RawBody", lineHeight: 18 }}>
        Explicit raw text
      </RNText>
    </FormField>
  )
  const view = await render(node(false))
  const originals = [rootRef.current, counterRef.current, buttonRef.current, editorRef.current, rawRef.current]
  for (const original of originals) expect(original).not.toBeNull()
  for (const id of ["form-field", "counter", "button"])
    expect(screen.getByTestId(id).props.nativeTypographyStyle).toBeUndefined()
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ fontFamily: "LabelBody", lineHeight: 20 })
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontFamily: "FieldBody", lineHeight: 26 })
  expect(screen.getByTestId("counter-value")).toHaveStyle({ fontFamily: "NumberBody", lineHeight: 19 })
  expect(screen.getByTestId("counter-max")).toHaveStyle({ fontFamily: "NumberBody", lineHeight: 19 })
  expect(screen.getByText("Counter child")).toHaveStyle({ fontFamily: "CounterBody", lineHeight: 30 })
  const buttonStyle = StyleSheet.flatten(screen.getByText("Independent button").props.style)
  expect(buttonStyle.fontFamily).toBeUndefined()
  expect(buttonStyle.lineHeight).toBeUndefined()
  await fireEvent.changeText(screen.getByTestId("held"), "request")
  expect(change.mock.calls).toEqual([["request"]])
  expect(screen.getByTestId("held").props.value).toBe("held")
  await view.rerender(node(true))
  for (const [index, ref] of [rootRef, counterRef, buttonRef, editorRef, rawRef].entries())
    expect(ref.current).toBe(originals[index])
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontFamily: "NextField", lineHeight: 28 })
  expect(screen.getByText("Explicit raw text")).toHaveStyle({ fontFamily: "RawBody", lineHeight: 18 })
  expect(screen.getByTestId("held").props.selection).toEqual({ start: 1, end: 1 })
  expect(change).toHaveBeenCalledTimes(1)
  expect(press).not.toHaveBeenCalled()
  await view.unmount()
  for (const ref of [rootRef, counterRef, buttonRef, editorRef, rawRef]) expect(ref.current).toBeNull()
})

it.each(["FormField", "Counter", "CircularProgress"] as const)(
  "keeps the legacy %s boundary until the ancestor migrates, retaining explicit text and refs",
  async (owner) => {
    const rootRef = createRef<View>()
    const textRef = createRef<TNativeTextRef>()
    const renderProgress: TNativeCircularProgressRootRender = (props) => {
      const provider = props.children as ReactElement<PropsWithChildren>
      return (
        <NativeFocusView {...props}>
          {cloneElement(
            provider,
            undefined,
            <>
              <NativeCircularProgressLabel ref={textRef}>Owned phrase</NativeCircularProgressLabel>
              {provider.props.children}
            </>,
          )}
        </NativeFocusView>
      )
    }
    const content = <Text ref={textRef}>Owned phrase</Text>
    const child =
      owner === "FormField" ? (
        <FormField ref={rootRef} customStyles={{ fontFamily: "OwnedBody", lineHeight: 24 }}>
          {content}
        </FormField>
      ) : owner === "Counter" ? (
        <Counter ref={rootRef} value={0} customStyles={{ fontFamily: "OwnedBody", lineHeight: 24 }}>
          {content}
        </Counter>
      ) : (
        <CircularProgress ref={rootRef} value={25} render={renderProgress} />
      )
    const node = (migrated: boolean) => (
      <NativeTextStyleProvider nativeInheritance={!migrated} style={{ fontFamily: "LegacyBody", lineHeight: 38 }}>
        <NativeFocusView testID="legacy-owner">{child}</NativeFocusView>
      </NativeTextStyleProvider>
    )
    const view = await render(node(false))
    const root = rootRef.current
    const text = textRef.current
    expect(root).not.toBeNull()
    expect(text).not.toBeNull()
    const host = () =>
      owner === "CircularProgress"
        ? screen.getByRole("progressbar")
        : screen.getByTestId(owner === "Counter" ? "counter" : "form-field")
    const metrics =
      owner === "CircularProgress"
        ? { fontFamily: "LegacyBody", lineHeight: 38 }
        : { fontFamily: "OwnedBody", lineHeight: 24 }
    expect(JSON.parse(host().props.nativeTypographyStyle)).toMatchObject(metrics)
    expect(screen.getByText("Owned phrase")).toHaveStyle({ ...metrics, fontWeight: "400", fontSize: 14 })
    await view.rerender(node(true))
    expect(screen.getByTestId("legacy-owner").props.nativeTypographyStyle).toBeUndefined()
    expect(host().props.nativeTypographyStyle).toBeUndefined()
    expect(screen.getByText("Owned phrase")).toHaveStyle({ ...metrics, fontWeight: "400", fontSize: 14 })
    expect(rootRef.current).toBe(root)
    expect(textRef.current).toBe(text)
    await view.unmount()
    expect(rootRef.current).toBeNull()
    expect(textRef.current).toBeNull()
  },
)

it.each(["FormField", "Counter"] as const)(
  "requires explicit migration of unsupported %s root weights",
  async (owner) => {
    const scalar = { fontWeight: 750.5 }
    await expect(
      render(owner === "Counter" ? <Counter value={0} customStyles={scalar} /> : <FormField customStyles={scalar} />),
    ).rejects.toThrow(
      `${owner}: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly`,
    )
    await render(
      owner === "Counter" ? (
        <Counter value={0} customStyles={scalar} style={{ fontWeight: "700" }} />
      ) : (
        <FormField customStyles={scalar} style={{ fontWeight: "700" }} />
      ),
    )
  },
)
