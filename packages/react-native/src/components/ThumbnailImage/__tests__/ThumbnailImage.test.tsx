import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Fragment, useState } from "react"
import { Image, PlatformColor, StyleSheet, type ImageErrorEvent } from "react-native"

import { NativeThemeProvider, Text, ThumbnailImage, type ThumbnailImageRenderImageArgs } from "../../.."

const error = { nativeEvent: { error: "decode failed" } } as ImageErrorEvent
const image = () => screen.getByTestId("thumbnail")
const fallback = <Text testID="fallback">Missing</Text>
const load = async (width = 120, height = 80) =>
  fireEvent(image(), "load", { nativeEvent: { source: { width, height, uri: image().props.src } } })
beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

it("CAP.thumbnail-image.001 renders the first exact normalized candidate with native image props", async () => {
  await render(
    <ThumbnailImage
      src="ignored"
      srcCandidates={[null, "", undefined, "first", "first", "second"]}
      alt="Preview"
      fallback={fallback}
      testID="thumbnail"
      width={120}
      height={80}
      style={{ borderRadius: 5 }}
    />,
  )
  expect(image().props.src).toBe("first")
  expect(image().props.accessibilityLabel).toBe("Preview")
  expect(image().props.width).toBe(120)
  expect(image().props.height).toBe(80)
  expect(image()).toHaveStyle({ borderRadius: 5 })
  expect(image().props.resizeMode).toBe("stretch")
  expect(image().props.resizeMethod).toBe("scale")
  expect(image().props.fadeDuration).toBe(0)
  expect(screen.queryByTestId("fallback")).toBeNull()
})

it.each([undefined, []] as const)(
  "CAP.thumbnail-image.001 uses src when the candidate array is %s",
  async (srcCandidates) => {
    await render(<ThumbnailImage src="single" srcCandidates={srcCandidates} fallback={fallback} testID="thumbnail" />)
    expect(image().props.src).toBe("single")
  },
)

it("CAP.thumbnail-image.001 keeps whitespace URI candidates and ignores src for a nonempty unusable list", async () => {
  const { rerender } = await render(
    <ThumbnailImage src="other" srcCandidates={[" ", "next"]} fallback={fallback} testID="thumbnail" />,
  )
  expect(image().props.src).toBe(" ")
  await rerender(
    <ThumbnailImage src="other" srcCandidates={[null, "", undefined]} fallback={fallback} testID="thumbnail" />,
  )
  expect(screen.queryByTestId("thumbnail")).toBeNull()
  expect(screen.getByTestId("fallback")).toHaveTextContent("Missing")
})

it.each([0, "Missing", "", false, null] as const)(
  "CAP.thumbnail-image.002 preserves fallback value %s without an Image",
  async (value) => {
    await render(<ThumbnailImage fallback={value} testID="thumbnail" />)
    expect(screen.queryByTestId("thumbnail")).toBeNull()
    if (value === 0) expect(screen.getByText("0")).toBeOnTheScreen()
    if (value === "Missing") expect(screen.getByText("Missing")).toBeOnTheScreen()
  },
)

it("CAP.thumbnail-image.002 keeps a valid loading candidate instead of showing fallback prematurely", async () => {
  await render(<ThumbnailImage src="pending" fallback={fallback} testID="thumbnail" />)
  expect(image().props.src).toBe("pending")
  expect(screen.queryByTestId("fallback")).toBeNull()
})

it("CAP.thumbnail-image.003 calls the owner before one advancement, skips duplicate/stale errors and exhausts in order", async () => {
  const seen: string[] = []
  const onError = jest.fn((event: ImageErrorEvent) => {
    expect(event).toBe(error)
    seen.push(image().props.src)
  })
  await render(
    <ThumbnailImage srcCandidates={["a", "a", "b"]} fallback={fallback} onError={onError} testID="thumbnail" />,
  )
  const retired = image().props.onError
  await fireEvent(image(), "error", error)
  expect(image().props.src).toBe("b")
  await act(() => retired(error))
  expect(image().props.src).toBe("b")
  await fireEvent(image(), "error", error)
  expect(screen.getByTestId("fallback")).toBeOnTheScreen()
  expect(onError).toHaveBeenCalledTimes(2)
  expect(seen).toEqual(["a", "b"])
})

it("CAP.thumbnail-image.003 prevents advancement on a synchronous caller throw and allows a later real error", async () => {
  const throwing = jest.fn(() => {
    throw new Error("owner failure")
  })
  const { rerender } = await render(
    <ThumbnailImage srcCandidates={["a", "b"]} fallback={fallback} testID="thumbnail" onError={throwing} />,
  )
  await expect(fireEvent(image(), "error", error)).rejects.toThrow("owner failure")
  expect(image().props.src).toBe("a")
  const onError = jest.fn()
  await rerender(<ThumbnailImage srcCandidates={["a", "b"]} fallback={fallback} testID="thumbnail" onError={onError} />)
  await fireEvent(image(), "error", error)
  expect(image().props.src).toBe("b")
  expect(onError).toHaveBeenCalledWith(error)
})

it("CAP.thumbnail-image.003 does not advance a parent-replaced candidate list", async () => {
  const Owner = () => {
    const [sources, setSources] = useState(["a", "b"])
    return (
      <ThumbnailImage
        srcCandidates={sources}
        fallback={fallback}
        testID="thumbnail"
        onError={() => setSources(["replacement"])}
      />
    )
  }
  await render(<Owner />)
  await fireEvent(image(), "error", error)
  expect(image().props.src).toBe("replacement")
})

it("CAP.thumbnail-image.004 retains progress through equivalent normalized lists and native/theme updates", async () => {
  const { rerender } = await render(
    <NativeThemeProvider mode="light">
      <ThumbnailImage srcCandidates={[null, "a", "a", "b"]} fallback={fallback} testID="thumbnail" />
    </NativeThemeProvider>,
  )
  await fireEvent(image(), "error", error)
  await rerender(
    <NativeThemeProvider mode="dark">
      <ThumbnailImage
        src="ignored"
        srcCandidates={["a", "", "b", undefined]}
        alt="Updated"
        fallback={fallback}
        testID="thumbnail"
        style={{ width: 0 }}
      />
    </NativeThemeProvider>,
  )
  expect(image().props.src).toBe("b")
  expect(image().props.accessibilityLabel).toBe("Updated")
  expect(image()).toHaveStyle({ width: 0 })
  await rerender(
    <NativeThemeProvider mode="light">
      <ThumbnailImage
        srcCandidates={["a", "b"]}
        alt="Changed"
        fallback={fallback}
        testID="thumbnail"
        style={{ width: 0 }}
      />
    </NativeThemeProvider>,
  )
  expect(image().props.src).toBe("b")
})

it("CAP.thumbnail-image.004 resets a changed or exhausted list to its first source without a stale fallback commit", async () => {
  const { rerender } = await render(<ThumbnailImage srcCandidates={["a"]} fallback={fallback} testID="thumbnail" />)
  const retired = image().props.onError
  await fireEvent(image(), "error", error)
  expect(screen.getByTestId("fallback")).toBeOnTheScreen()
  await rerender(<ThumbnailImage srcCandidates={["new", "next"]} fallback={fallback} testID="thumbnail" />)
  expect(image().props.src).toBe("new")
  await act(() => retired(error))
  expect(image().props.src).toBe("new")
})

it("CAP.thumbnail-image.005 passes exact adapter arguments and advances without an invented event", async () => {
  const onError = jest.fn()
  let args: ThumbnailImageRenderImageArgs | undefined
  const renderer = (next: ThumbnailImageRenderImageArgs) => {
    args = next
    return <Image {...next.imageProps} testID="thumbnail" />
  }
  await render(
    <ThumbnailImage
      srcCandidates={["a", "b"]}
      alt=""
      fallback={fallback}
      onError={onError}
      renderImage={renderer}
      style={{ width: 0 }}
    />,
  )
  expect(args!.alt).toBe("")
  expect(args!.src).toBe("a")
  expect(args!.imageProps.onError).toBe(args!.onError)
  expect(args!.imageProps.style).toEqual({ width: 0 })
  await act(() => args!.onError())
  expect(args!.src).toBe("b")
  expect(onError).not.toHaveBeenCalled()
})

it("CAP.thumbnail-image.005 retains injected child state across source changes and safely renders primitive/Fragment output", async () => {
  const Adapter = ({ src }: { src: string }) => {
    const [count, setCount] = useState(0)
    return (
      <Text testID="adapter" onPress={() => setCount((value) => value + 1)}>
        {src}:{count}
      </Text>
    )
  }
  const renderer = ({ src }: ThumbnailImageRenderImageArgs) => <Adapter src={src} />
  const { rerender } = await render(<ThumbnailImage src="a" fallback={fallback} renderImage={renderer} />)
  await fireEvent.press(screen.getByTestId("adapter"))
  await rerender(<ThumbnailImage src="b" fallback={fallback} renderImage={renderer} />)
  expect(screen.getByTestId("adapter")).toHaveTextContent("b:1")
  await rerender(<ThumbnailImage src="b" fallback={fallback} renderImage={() => <Fragment>Preview {0}</Fragment>} />)
  expect(screen.getByText("Preview 0")).toBeOnTheScreen()
})

it("NATIVE.thumbnail-image.fallback retains authored keyed fallback state for equivalent unavailable candidates", async () => {
  const Fallback = () => {
    const [count, setCount] = useState(0)
    return (
      <Text testID="fallback" onPress={() => setCount((value) => value + 1)}>
        {count}
      </Text>
    )
  }
  const node = <Fallback key="fallback" />
  const { rerender } = await render(<ThumbnailImage srcCandidates={[null]} fallback={node} />)
  await fireEvent.press(screen.getByTestId("fallback"))
  await rerender(<ThumbnailImage src="ignored" srcCandidates={["", undefined]} fallback={node} />)
  expect(screen.getByTestId("fallback")).toHaveTextContent("1")
})

it("NATIVE.thumbnail-image.intrinsic derives natural geometry only from a genuine native load payload", async () => {
  const getSize = jest.spyOn(Image, "getSize")
  const onLoad = jest.fn()
  await render(<ThumbnailImage src="a" fallback={fallback} testID="thumbnail" onLoad={onLoad} />)
  const payload = { nativeEvent: { source: { width: 120, height: 80, uri: "a" } } }
  await fireEvent(image(), "load", payload)
  expect(onLoad).toHaveBeenCalledWith(payload)
  expect(image()).toHaveStyle({ width: 120, aspectRatio: 1.5 })
  expect(getSize).not.toHaveBeenCalled()
})

it.each([0, "50%", "auto", null] as const)(
  "NATIVE.thumbnail-image.intrinsic preserves native style width %s and final precedence",
  async (width) => {
    const custom = StyleSheet.create({ image: { borderRadius: 3, width: 80 } })
    await render(
      <ThumbnailImage
        src="a"
        fallback={fallback}
        testID="thumbnail"
        width={40}
        style={[custom.image, { width, maxWidth: 200 }]}
      />,
    )
    await load(120, 60)
    const style = StyleSheet.flatten(image().props.style)
    expect(style.width).toBe(width === "auto" || width === null ? 120 : width)
    expect(style.aspectRatio).toBe(2)
    expect(style.maxWidth).toBe(200)
    expect(style.borderRadius).toBe(3)
    expect(image().props.width).toBe(40)
  },
)

it("NATIVE.thumbnail-image.intrinsic retains both explicit zero axes and caller aspect/resize/fade controls", async () => {
  await render(
    <ThumbnailImage
      src="a"
      fallback={fallback}
      testID="thumbnail"
      width={0}
      height={0}
      resizeMethod="resize"
      resizeMode="contain"
      fadeDuration={0}
      style={{ aspectRatio: 3 }}
    />,
  )
  await load()
  expect(image().props.width).toBe(0)
  expect(image().props.height).toBe(0)
  expect(image()).toHaveStyle({ aspectRatio: 3 })
  expect(image().props.resizeMethod).toBe("resize")
  expect(image().props.resizeMode).toBe("contain")
  expect(image().props.fadeDuration).toBe(0)
})

it("NATIVE.thumbnail-image.intrinsic supports a height-owned image and forwards registered native colors", async () => {
  const opaque = PlatformColor("systemBlueColor")
  await render(
    <ThumbnailImage
      src="a"
      fallback={fallback}
      testID="thumbnail"
      height={40}
      style={{ height: "50%", tintColor: opaque, aspectRatio: 3 }}
    />,
  )
  await load(120, 60)
  expect(image()).toHaveStyle({ height: "50%", aspectRatio: 3, tintColor: opaque })
  expect(StyleSheet.flatten(image().props.style).width).toBeUndefined()
})

it("NATIVE.thumbnail-image.accessibility preserves default/empty alt, explicit false and native empty-name precedence", async () => {
  const { rerender } = await render(<ThumbnailImage src="a" fallback={fallback} testID="thumbnail" />)
  expect(image().props.accessibilityLabel).toBe("Thumbnail image")
  expect(image().props.accessible).toBe(true)
  expect(image().props.alt).toBeUndefined()
  await rerender(<ThumbnailImage src="a" alt="" fallback={fallback} testID="thumbnail" />)
  expect(image().props.accessibilityLabel).toBe("")
  expect(image().props.accessible).toBe(false)
  await rerender(
    <ThumbnailImage
      src="a"
      alt="Visible"
      aria-label="Alias"
      accessibilityLabel=""
      accessible={false}
      fallback={fallback}
      testID="thumbnail"
    />,
  )
  expect(image().props.accessibilityLabel).toBe("")
  expect(image().props.accessible).toBe(false)
  await rerender(<ThumbnailImage src="a" alt="" accessibilityLabel="Authored" fallback={fallback} testID="thumbnail" />)
  expect(image().props.accessibilityLabel).toBe("Authored")
  expect(image().props.accessible).toBe(true)
})

it("NATIVE.thumbnail-image.forwarding retains empty native IDs and native load/layout event identity without leaking wrapper props", async () => {
  const onLayout = jest.fn(),
    onLoadStart = jest.fn(),
    onLoadEnd = jest.fn()
  await render(
    <ThumbnailImage
      srcCandidates={["a"]}
      fallback={fallback}
      testID=""
      data-testid="alias"
      nativeID="native"
      onLayout={onLayout}
      onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
    />,
  )
  const root = screen.getByTestId("")
  const payload = { nativeEvent: { layout: { x: 1, y: 2, width: 0, height: 0 } } }
  await fireEvent(root, "layout", payload)
  await fireEvent(root, "loadStart", payload)
  await fireEvent(root, "loadEnd", payload)
  for (const fn of [onLayout, onLoadStart, onLoadEnd]) expect(fn).toHaveBeenCalledWith(payload)
  expect(root.props.nativeID).toBe("native")
  for (const field of ["srcCandidates", "fallback", "renderImage", "data-testid", "children"])
    expect(root.props[field]).toBeUndefined()
})

it("NATIVE.thumbnail-image.lifetime retires old default-image load/error/layout callbacks across sources and unmount", async () => {
  const onLoad = jest.fn(),
    onError = jest.fn(),
    onLayout = jest.fn()
  const { rerender, unmount } = await render(
    <ThumbnailImage
      src="a"
      fallback={fallback}
      testID="thumbnail"
      onLoad={onLoad}
      onError={onError}
      onLayout={onLayout}
    />,
  )
  const old = image().props
  await rerender(
    <ThumbnailImage
      src="b"
      fallback={fallback}
      testID="thumbnail"
      onLoad={onLoad}
      onError={onError}
      onLayout={onLayout}
    />,
  )
  await act(() => {
    old.onLoad({ nativeEvent: { source: { width: 999, height: 999, uri: "a" } } })
    old.onError(error)
    old.onLayout({})
  })
  expect(image().props.src).toBe("b")
  expect(onLoad).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
  expect(onLayout).not.toHaveBeenCalled()
  const retired = image().props
  await unmount()
  await act(() => {
    retired.onError(error)
    retired.onLoad({ nativeEvent: { source: { width: 99, height: 99 } } })
  })
  expect(onError).not.toHaveBeenCalled()
  expect(onLoad).not.toHaveBeenCalled()
})

it("NATIVE.thumbnail-image.responsive forwards native srcSet/headers and seeds only implicit geometry", async () => {
  const getSize = jest
    .spyOn(Image, "getSizeWithHeaders")
    .mockImplementation(() => Promise.resolve({ width: 200, height: 100 }))
  await render(
    <ThumbnailImage
      src="base"
      srcSet="small 1x, large 2x"
      crossOrigin="use-credentials"
      referrerPolicy="no-referrer"
      fallback={fallback}
      testID="thumbnail"
    />,
  )
  expect(getSize).toHaveBeenCalledWith("small", {
    "Access-Control-Allow-Credentials": "true",
    "Referrer-Policy": "no-referrer",
  })
  expect(image().props.srcSet).toBe("small 1x, large 2x")
  expect(image().props.crossOrigin).toBe("use-credentials")
  expect(image()).toHaveStyle({ width: 200, aspectRatio: 2 })
})

it("NATIVE.thumbnail-image.responsive never advances or fabricates onError from failed metadata probes", async () => {
  const getSize = jest.spyOn(Image, "getSize").mockImplementation(() => Promise.reject(new Error("metadata failure")))
  const onError = jest.fn()
  await render(
    <ThumbnailImage src="base" srcSet="bad 1x, bad2 2x" fallback={fallback} testID="thumbnail" onError={onError} />,
  )
  expect(getSize.mock.calls.map((call) => call[0])).toEqual(["bad", "bad2", "base"])
  expect(image().props.src).toBe("base")
  expect(image()).toHaveStyle({ width: 1, aspectRatio: 1 })
  expect(onError).not.toHaveBeenCalled()
  await fireEvent(image(), "error", error)
  expect(screen.getByTestId("fallback")).toBeOnTheScreen()
  expect(onError).toHaveBeenCalledWith(error)
})

it("NATIVE.thumbnail-image.responsive retires replaced metadata and stale native source-set callbacks", async () => {
  let resolve: (value: { width: number; height: number }) => void = () => undefined
  jest.spyOn(Image, "getSize").mockImplementation((uri) =>
    uri === "old"
      ? new Promise((done) => {
          resolve = done
        })
      : Promise.resolve({ width: 80, height: 40 }),
  )
  const onError = jest.fn()
  const { rerender, unmount } = await render(
    <ThumbnailImage src="base" srcSet="old 1x" fallback={fallback} testID="thumbnail" onError={onError} />,
  )
  const stale = image().props
  await rerender(<ThumbnailImage src="base" srcSet="new 1x" fallback={fallback} testID="thumbnail" onError={onError} />)
  await act(async () => {
    resolve({ width: 999, height: 999 })
    stale.onError(error)
  })
  expect(image()).toHaveStyle({ width: 80, aspectRatio: 2 })
  expect(onError).not.toHaveBeenCalled()
  await unmount()
})

it("NATIVE.thumbnail-image.responsive retains explicit zero dimensions without metadata replacement", async () => {
  const getSize = jest.spyOn(Image, "getSize")
  await render(
    <ThumbnailImage
      src="base"
      srcSet="small 1x, large 2x"
      width={0}
      height={0}
      fallback={fallback}
      testID="thumbnail"
    />,
  )
  expect(image().props.width).toBe(0)
  expect(image().props.height).toBe(0)
  expect(getSize).not.toHaveBeenCalled()
})

it("NATIVE.thumbnail-image.responsive stops probe continuation and callbacks after unmount", async () => {
  let reject: (error: unknown) => void = () => undefined
  const getSize = jest.spyOn(Image, "getSize").mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const onError = jest.fn()
  const { unmount } = await render(
    <ThumbnailImage
      src="base"
      srcSet="pending 1x, later 2x"
      fallback={fallback}
      testID="thumbnail"
      onError={onError}
    />,
  )
  await unmount()
  await act(async () => reject(new Error("late metadata failure")))
  expect(getSize).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

it("NATIVE.thumbnail-image.intrinsic ignores invalid size metadata while forwarding the original load event", async () => {
  const onLoad = jest.fn()
  await render(<ThumbnailImage src="a" fallback={fallback} testID="thumbnail" onLoad={onLoad} />)
  const event = { nativeEvent: { source: { width: 0, height: 80, uri: "a" } } }
  await fireEvent(image(), "load", event)
  expect(onLoad).toHaveBeenCalledWith(event)
  expect(StyleSheet.flatten(image().props.style).aspectRatio).toBeUndefined()
  expect(image().props.src).toBe("a")
})

it("NATIVE.thumbnail-image.intrinsic snapshots decoded scalars before batched owner callbacks mutate their payload", async () => {
  await render(
    <ThumbnailImage
      src="a"
      fallback={fallback}
      testID="thumbnail"
      onLoad={(event) => {
        event.nativeEvent.source.width = 999
        event.nativeEvent.source.height = 1
      }}
    />,
  )
  const onLoad = image().props.onLoad
  await act(() => {
    onLoad({ nativeEvent: { source: { width: 120, height: 80, uri: "a" } } })
    onLoad({ nativeEvent: { source: { width: 200, height: 100, uri: "a" } } })
  })
  expect(image()).toHaveStyle({ width: 200, aspectRatio: 2 })
})
