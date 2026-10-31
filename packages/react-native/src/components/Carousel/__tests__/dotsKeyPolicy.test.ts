import { handleNativeCarouselDotKey, type TNativeCarouselDotKeyPolicy } from "../dotsKeyPolicy"

import oracle from "./fixtures/dotsKeyOracle.json"

it.each(oracle.vectors)(
  "matches canonical $activationMode/$interactive/$focusIndex/$key/modifiers=$modifiers",
  (vector) => {
    const trace: (string | number)[][] = []
    const owner = Object.freeze({ focusIndex: vector.focusIndex, itemCount: vector.itemCount })
    const input: TNativeCarouselDotKeyPolicy = {
      ...owner,
      interactive: vector.interactive,
      activationMode: vector.activationMode as TNativeCarouselDotKeyPolicy["activationMode"],
      setFocusIndex: (index) => {
        trace.push(["setFocus", index])
      },
      requestFocus: (index) => {
        trace.push(["focus", index])
      },
      scrollTo: (index) => {
        trace.push(["scroll", index])
      },
    }
    handleNativeCarouselDotKey(Object.freeze(input), {
      nativeEvent: Object.freeze({
        key: vector.key,
        altKey: vector.modifiers,
        ctrlKey: vector.modifiers,
        metaKey: vector.modifiers,
        shiftKey: vector.modifiers,
      }),
      preventDefault: () => {
        trace.push(["prevent"])
      },
      stopPropagation: () => {
        trace.push(["stop"])
      },
    })
    expect(trace).toEqual(vector.trace)
    expect(owner).toEqual({ focusIndex: vector.focusIndex, itemCount: vector.itemCount })
  },
)

it("keeps a focus-request exception ahead of auto activation instead of publishing a fabricated scroll", () => {
  const scrollTo = jest.fn()
  const setFocusIndex = jest.fn()
  const error = new Error("focus transport unavailable")
  expect(() =>
    handleNativeCarouselDotKey(
      {
        interactive: true,
        activationMode: "auto",
        focusIndex: 0,
        itemCount: 5,
        setFocusIndex,
        requestFocus: () => {
          throw error
        },
        scrollTo,
      },
      { nativeEvent: { key: "ArrowRight" }, preventDefault: jest.fn(), stopPropagation: jest.fn() },
    ),
  ).toThrow(error)
  expect(setFocusIndex).toHaveBeenCalledWith(1)
  expect(scrollTo).not.toHaveBeenCalled()
})

it("retains activation errors and Enter propagation without issuing a focus request", () => {
  const requestFocus = jest.fn()
  const stopPropagation = jest.fn()
  const error = new Error("owner request failed")
  expect(() =>
    handleNativeCarouselDotKey(
      {
        interactive: true,
        activationMode: "manual",
        focusIndex: 0,
        itemCount: 5,
        setFocusIndex: jest.fn(),
        requestFocus,
        scrollTo: () => {
          throw error
        },
      },
      { nativeEvent: { key: "Enter" }, preventDefault: jest.fn(), stopPropagation },
    ),
  ).toThrow(error)
  expect(requestFocus).not.toHaveBeenCalled()
  expect(stopPropagation).not.toHaveBeenCalled()
})
