import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Linking, View, type View as NativeView } from "react-native"

import { Link } from "../../.."
import { bindNativeDescription } from "../../../input/nativeDescription"

const root = () => screen.getByTestId("link")
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => jest.restoreAllMocks())

it("maps the owned aliases to ordered native IDs and consumes them before the host", async () => {
  await render(
    <Link
      href=""
      ariaLabel="Authored label"
      ariaLabelledBy="first second"
      ariaDescribedBy={" third\nfourth\tfifth "}
      ariaDetails="sixth seventh"
      accessibilityHint="Authored hint"
      accessibilityValue={{ text: "", now: 0 }}
      labels={{ descriptionLabel: "Description du lien", detailsLabel: "Détails" }}
    >
      Destination
    </Link>,
  )
  expect(root().props).toMatchObject({
    nativeLabelledBy: ["first", "second"],
    nativeDescribedBy: ["third", "fourth", "fifth"],
    nativeDetailsBy: ["sixth", "seventh"],
    nativeDescriptionLabel: "Description du lien",
    nativeDetailsLabel: "Détails",
    accessibilityLabel: "Authored label",
    accessibilityHint: "Authored hint",
    accessibilityValue: { text: "", now: 0 },
  })
  for (const name of ["ariaLabelledBy", "ariaDescribedBy", "ariaDetails", "aria-describedby", "aria-details", "labels"])
    expect(root().props[name]).toBeUndefined()
})

it("retains native naming and native ARIA relationship precedence", async () => {
  const names = ["native-name", "another"]
  await render(
    <Link
      href=""
      accessibilityLabelledBy={names}
      aria-labelledby="attribute-name"
      ariaLabelledBy="alias-name"
      aria-describedby="attribute-description"
      ariaDescribedBy="alias-description"
      aria-details="attribute-details"
      ariaDetails="alias-details"
    >
      Destination
    </Link>,
  )
  expect(root().props.nativeLabelledBy).toBe(names)
  expect(root().props.nativeDescribedBy).toEqual(["attribute-description"])
  expect(root().props.nativeDetailsBy).toEqual(["attribute-details"])
})

it("preserves empty native relationship lists and supplementary captions", async () => {
  await render(
    <Link
      href=""
      aria-labelledby=""
      ariaLabelledBy="alias-name"
      aria-describedby=""
      ariaDescribedBy="alias-description"
      aria-details=""
      ariaDetails="alias-details"
      labels={{ descriptionLabel: "", detailsLabel: "" }}
    >
      Destination
    </Link>,
  )
  expect(root().props).toMatchObject({
    nativeLabelledBy: [],
    nativeDescribedBy: [],
    nativeDetailsBy: [],
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "",
  })
})

it("updates and clears relationships without replacing the ref or issuing an owner/navigation request", async () => {
  const ref = createRef<NativeView>(),
    press = jest.fn()
  const node = (mode: number) => (
    <Link
      ref={ref}
      href=""
      isVisited={false}
      onPress={press}
      ariaDescribedBy={mode === 0 ? "old" : mode === 1 ? "new" : undefined}
      ariaDetails={mode === 0 ? "details" : undefined}
    >
      Destination
    </Link>
  )
  const view = await render(node(0)),
    actual = ref.current
  expect(typeof actual?.measure).toBe("function")
  await view.rerender(node(1))
  expect(ref.current).toBe(actual)
  expect(root().props.nativeDescribedBy).toEqual(["new"])
  expect(root().props.nativeDetailsBy).toBeUndefined()
  await view.rerender(node(2))
  expect(ref.current).toBe(actual)
  expect(root().props.nativeDescribedBy).toBeUndefined()
  expect(press).not.toHaveBeenCalled()
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it("preserves a held native key cycle and the original release record through metadata-only changes", async () => {
  const press = jest.fn()
  const node = (id: string) => (
    <Link href="" isVisited={false} onPress={press} ariaDescribedBy={id}>
      Destination
    </Link>
  )
  const view = await render(node("first"))
  const packet = (phase: "down" | "up") => ({
    persist: jest.fn(),
    preventDefault: jest.fn(),
    nativeEvent: {
      kind: "keyboard",
      ownerId: root().props.ownerId,
      target: 17,
      key: "Enter",
      nativeCode: 40,
      phase,
      nativeDefaultHandled: true,
      repeat: false,
      cancelled: false,
    },
  })
  const down = packet("down")
  await act(() => root().props.onNativeKey(down))
  await view.rerender(node("second"))
  const up = packet("up")
  await act(() => root().props.onNativeKey(up))
  expect(press.mock.calls).toEqual([[up]])
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).toHaveBeenCalledWith("")
})

it("keeps explicit description IDs alongside an owned live tooltip binding and respects caption precedence", async () => {
  const runtime = jest.requireActual<typeof import("react-native")>("react-native")
  jest.spyOn(runtime, "findNodeHandle").mockReturnValue(71)
  const ref = createRef<NativeView>(),
    description = createRef<NativeView>()
  const node = (caption?: string) => (
    <>
      <Link href="" ref={ref} ariaDescribedBy="explicit" labels={{ descriptionLabel: caption }}>
        Destination
      </Link>
      <View ref={description} />
    </>
  )
  const view = await render(node())
  let release: (() => void) | undefined
  await act(() => {
    release = bindNativeDescription(ref.current, description.current, "Tooltip description")
  })
  expect(release).toBeDefined()
  expect(root().props.nativeDescriptionTag).toBeGreaterThan(0)
  expect(root().props.nativeDescriptionLabel).toBe("Tooltip description")
  await view.rerender(node(""))
  expect(root().props.nativeDescriptionLabel).toBe("")
  expect(root().props.nativeDescribedBy).toEqual(["explicit"])
  await act(() => release?.())
  expect(root().props.nativeDescriptionTag).toBe(0)
  expect(root().props.nativeDescribedBy).toEqual(["explicit"])
})

it("retains React19 cleanup on the actual root after relationship updates", async () => {
  const cleanup = jest.fn(),
    ref = jest.fn((target: NativeView | null) => {
      expect(typeof target?.measure).toBe("function")
      return cleanup
    })
  const view = await render(
    <Link ref={ref} href="" ariaDescribedBy="first">
      Destination
    </Link>,
  )
  await view.rerender(
    <Link ref={ref} href="" ariaDetails="next">
      Destination
    </Link>,
  )
  expect(ref).toHaveBeenCalledTimes(1)
  expect(cleanup).not.toHaveBeenCalled()
  await view.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
})
