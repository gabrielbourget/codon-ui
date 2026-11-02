import { render, screen } from "@testing-library/react-native"
import { createRef, type ComponentProps } from "react"
import { TextInput, type View } from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { Button } from "../Button"
import { NativeButtonContext, NATIVE_BUTTON_SELF_LABELLED_BY, type TNativeButtonLabelContextProps } from "../context"

type TProps = ComponentProps<typeof Button>
const defaults = (rows = ["row-first", "row-second"]): TNativeButtonLabelContextProps => ({
  nativeID: "generated-chevron",
  "aria-label": "Expand",
  accessibilityLabelledBy: ["generated-chevron", ...rows],
  [NATIVE_BUTTON_SELF_LABELLED_BY]: rows,
})

it.each([false, true])(
  "resolves actual final caller IDs before default/custom=%s rendering with current rows and original refs",
  async (custom) => {
    const button = createRef<View>(),
      inherited = createRef<View>(),
      editor = createRef<TextInput>()
    const seen: object[] = []
    const renderButton: TProps["render"] = custom
      ? (props) => {
          seen.push(props)
          return <NativeFocusView {...props} />
        }
      : undefined
    const tree = (props: TProps, rows = ["row-first", "row-second"]) => (
      <NativeButtonContext.Provider value={{ slots: { chevron: { ...defaults(rows), ref: inherited } } }}>
        <Button slot="chevron" ref={button} testID="self-label" render={renderButton} {...props}>
          Own button text
        </Button>
        <TextInput ref={editor} value="held" testID="held-editor" />
      </NativeButtonContext.Provider>
    )
    const view = await render(
      tree({ id: "caller-id", nativeID: "caller-native", accessibilityLabel: "Caller own name" }),
    )
    const original = button.current,
      originalEditor = editor.current!
    const write = jest.spyOn(originalEditor, "setNativeProps")
    expect(screen.getByTestId("self-label").props).toMatchObject({
      nativeID: "caller-id",
      nativeLabelledBy: ["caller-id", "row-first", "row-second"],
      accessibilityLabel: "Caller own name",
    })
    expect(inherited.current).toBe(original)
    await view.rerender(tree({ nativeID: "next-native" }, ["row-next"]))
    expect(screen.getByTestId("self-label").props).toMatchObject({
      nativeID: "next-native",
      nativeLabelledBy: ["next-native", "row-next"],
    })
    expect(button.current).toBe(original)
    expect(inherited.current).toBe(original)
    expect(editor.current).toBe(originalEditor)
    expect(screen.getByTestId("held-editor").props.value).toBe("held")
    expect(screen.getByText("Own button text")).toBeTruthy()
    expect(write).not.toHaveBeenCalled()
    expect(screen.getByTestId("self-label").props.nativeLabelledBy).not.toContain("generated-chevron")
    if (custom) {
      expect(seen).not.toHaveLength(0)
      for (const props of seen)
        expect(Object.getOwnPropertySymbols(props)).not.toContain(NATIVE_BUTTON_SELF_LABELLED_BY)
    }
    await view.unmount()
    expect(button.current).toBeNull()
    expect(inherited.current).toBeNull()
  },
)

it.each([
  { accessibilityLabel: "", accessibilityLabelledBy: "" },
  { "aria-label": "", "aria-labelledby": "" },
  { accessibilityLabel: "Caller", accessibilityLabelledBy: ["authored-label"] },
  { "aria-label": "Caller alias", "aria-labelledby": "first, second" },
  { accessibilityLabel: "Caller empty references", accessibilityLabelledBy: [] },
] as TProps[])("preserves explicit caller names and references including empty values %j", async (props) => {
  const value = defaults()
  await render(
    <NativeButtonContext.Provider value={value}>
      <Button testID="self-label" id="caller" render={(host) => <NativeFocusView {...host} />} {...props}>
        Own text
      </Button>
    </NativeButtonContext.Provider>,
  )
  const host = screen.getByTestId("self-label").props
  expect(host.accessibilityLabel).toBe(props.accessibilityLabel ?? props["aria-label"])
  const references =
    props["aria-labelledby"] !== undefined
      ? props["aria-labelledby"].split(/\s*,\s*/g)
      : typeof props.accessibilityLabelledBy === "string"
        ? [props.accessibilityLabelledBy]
        : props.accessibilityLabelledBy
  expect(host.nativeLabelledBy).toEqual(references)
  expect(host.nativeLabelledBy).not.toContain("row-first")
})

it.each(["id", "nativeID"] as const)(
  "retains an explicitly empty %s without forcing a generated self ID",
  async (name) => {
    const value = defaults(["row"])
    await render(
      <NativeButtonContext.Provider value={value}>
        <Button testID="self-label" {...{ [name]: "" }}>
          Own text
        </Button>
      </NativeButtonContext.Provider>,
    )
    expect(screen.getByTestId("self-label").props.nativeID).toBe("")
    expect(screen.getByTestId("self-label").props.nativeLabelledBy).toEqual(["row"])
  },
)

it("keeps absent/default/null and foreign named slot behavior unchanged", async () => {
  const chevron = defaults(["row"])
  await render(
    <NativeButtonContext.Provider
      value={{ slots: { [NATIVE_DEFAULT_SLOT]: { accessibilityLabelledBy: ["legacy"] }, chevron } }}
    >
      <Button id="default" testID="default">
        Default
      </Button>
      <Button id="chevron" slot="chevron" testID="chevron">
        Chevron
      </Button>
      <Button id="null" slot={null} testID="null">
        Null
      </Button>
    </NativeButtonContext.Provider>,
  )
  expect(screen.getByTestId("default").props.nativeLabelledBy).toEqual(["legacy"])
  expect(screen.getByTestId("chevron").props.nativeLabelledBy).toEqual(["chevron", "row"])
  expect(screen.getByTestId("null").props.nativeLabelledBy).toBeUndefined()
})
