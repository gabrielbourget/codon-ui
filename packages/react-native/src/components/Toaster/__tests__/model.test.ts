import { resolveNativeTheme } from "../../../theme/defaults"
import {
  applyToastPublication,
  computeToastDateTimeString,
  getNativeToastStacks,
  resolveToastDuration,
  resolveToastLabels,
} from "../model"
import { createNativeToasterObserver, toast, ToasterObserver } from "../stateManagement"
import { getNativeToastStyles } from "../styles"
import type { TNativeToast, TNativeToastProps } from "../types"

afterEach(() => {
  ToasterObserver.dismiss()
})

it("CAP.toaster.014 merges matching queue IDs without changing order and publishes every original payload", () => {
  const observer = createNativeToasterObserver(),
    subscriber = jest.fn()
  const unsubscribe = observer.subscribe(subscriber)
  const original: TNativeToast = { id: 0, titleText: "Original", bodyText: "Retained" }
  observer.addToast(original)
  observer.addToast({ id: "0", titleText: "String" })
  observer.addToast({ id: 0, titleText: "Updated", important: false })
  expect(subscriber.mock.calls[0][0]).toBe(original)
  expect(subscriber).toHaveBeenCalledTimes(3)
  expect(observer.snapshot()).toEqual([
    { id: 0, titleText: "Updated", bodyText: "Retained", important: false },
    { id: "0", titleText: "String" },
  ])
  const copy = observer.snapshot()
  copy.pop()
  expect(observer.snapshot()).toHaveLength(2)
  unsubscribe()
  unsubscribe()
  observer.addToast({ id: "", titleText: "Empty" })
  expect(subscriber).toHaveBeenCalledTimes(3)
})
it("CAP.toaster.015 publishes exact single/all instructions including zero and empty IDs", () => {
  const observer = createNativeToasterObserver(),
    subscriber = jest.fn()
  observer.subscribe(subscriber)
  for (const id of [0, "0", ""]) observer.addToast({ id })
  subscriber.mockClear()
  expect(observer.dismiss(0)).toBe(0)
  expect(subscriber.mock.calls).toEqual([[{ id: 0, dismiss: true }]])
  expect(observer.snapshot().map(({ id }) => id)).toEqual(["0", ""])
  subscriber.mockClear()
  expect(observer.dismiss()).toBeUndefined()
  expect(subscriber.mock.calls).toEqual([[{ id: "0", dismiss: true }], [{ id: "", dismiss: true }]])
  expect(observer.snapshot()).toEqual([])
})
it("NATIVE.toaster.001 preserves falsy authored IDs and avoids live generated-ID collisions", () => {
  expect(toast({ id: 0 })).toBe(0)
  expect(toast({ id: "" })).toBe("")
  const observer = createNativeToasterObserver()
  observer.addToast({ id: 1 })
  expect(observer.nextID()).toBe(2)
  expect(observer.nextID()).toBe(3)
})
it("NATIVE.toaster.002 keeps same-turn add/update/dismiss transitions in order with copied render state", () => {
  const original: TNativeToast = { id: "", titleText: "First" }
  const first = applyToastPublication([], original)
  expect(first[0]).toBe(original)
  const next = applyToastPublication(first, { id: "", bodyText: "Updated" })
  const removed = applyToastPublication(next, { id: "", dismiss: true })
  expect(removed).toEqual([{ id: "", titleText: "First", bodyText: "Updated", deletingToast: true }])
  expect(original).toEqual({ id: "", titleText: "First" })
  expect(next).toHaveLength(1)
})
it.each([0, 12, "persistent"] as const)("CAP.toast.009 retains toast duration %s over root defaults", (duration) => {
  expect(resolveToastDuration({ id: 0, duration }, 50)).toBe(duration)
  expect(resolveToastDuration({ id: 0 }, duration)).toBe(duration)
})
it.each([-1, NaN, Infinity])("NATIVE.toaster.003 rejects invalid duration %s", (duration) => {
  expect(() => resolveToastDuration({ id: 0, duration })).toThrow("duration")
})
it("CAP.toast.011/.012 preserves grouped/individual/legacy label priority and empty strings", () => {
  expect(
    resolveToastLabels(
      {
        id: 0,
        cancelActionBtnText: "Legacy",
        confirmActionBtnText: "Legacy confirm",
        labels: { confirmActionButton: "", closeButtonAriaLabel: "" },
      },
      { cancelActionButton: "Grouped", confirmActionButton: "Grouped confirm" },
    ),
  ).toEqual({
    cancelActionButton: "Grouped",
    cancelActionButtonAriaLabel: "Cancel Action",
    closeButtonAriaLabel: "",
    confirmActionButton: "",
    confirmActionButtonAriaLabel: "Confirm Action",
  })
})
it("CAP.toaster.004/.008/.009/.013 derives independently positioned measured offsets and visible bridges", () => {
  const toasts: TNativeToast[] = [{ id: 0 }, { id: "0" }, { id: "" }, { id: "bottom", position: "bottom-left" }]
  const heights = [
    { id: 0, height: 20, position: "top-right" as const },
    { id: "0", height: 30, position: "top-right" as const },
    { id: "", height: 10, position: "top-right" as const },
  ]
  const [top, bottom] = getNativeToastStacks(toasts, heights, "top-right", 5, 2)
  expect(top.offsets).toEqual([0, 25, 60])
  expect(top.firstHeight).toBe(20)
  expect(top.stackHeight).toBe(55)
  expect(top.bridges).toEqual([{ key: "string:0", offset: 20 }])
  expect(bottom.position).toBe("bottom-left")
  expect(bottom.toasts.map(({ id }) => id)).toEqual(["bottom"])
  expect(getNativeToastStacks(toasts, heights, "top-right", 0, 0)[0].bridges).toEqual([])
  expect(getNativeToastStacks(toasts, heights, "top-right", 0, 0)[0].stackHeight).toBe(0)
})
it("NATIVE.toast.001 formats the canonical timestamp without a new date dependency", () => {
  expect(computeToastDateTimeString(new Date(2026, 0, 2, 3, 4, 5))).toBe("January 2, 2026 | 03:04:05")
})
it("CAP.toast.002/.005/.006/.017 retains dimensions, geometry and caller final root styles", () => {
  const props: TNativeToastProps = {
    toast: {
      id: 0,
      width: 0,
      height: "50%",
      geometry: "orthogonal",
      raised: false,
      customStyles: { backgroundColor: "teal", width: 100 },
      style: { width: 0, marginTop: 7 },
    },
    index: 0,
    numToasts: 1,
    position: "top-right",
    offset: 0,
    firstHeight: 0,
    maxVisibleToasts: 5,
    toasterExpanded: false,
    interacting: false,
    removeToast: jest.fn(),
    onHeight: jest.fn(),
  }
  expect(getNativeToastStyles(resolveNativeTheme("light"), props, false).root).toMatchObject({
    width: 0,
    height: "50%",
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: "teal",
    marginTop: 7,
  })
})
it("NATIVE.toast.002 matches the canonical browser-evaluated collapsed scale expression", () => {
  const props: TNativeToastProps = {
    toast: { id: 0 },
    index: 1,
    numToasts: 2,
    position: "bottom-left",
    offset: 75,
    firstHeight: 30,
    maxVisibleToasts: 5,
    toasterExpanded: false,
    interacting: false,
    removeToast: jest.fn(),
    onHeight: jest.fn(),
  }
  expect(getNativeToastStyles(resolveNativeTheme("light"), props, false).root).toMatchObject({
    height: 30,
    transform: [{ translateY: -15 }, { scale: 0.95 }],
  })
  expect(
    getNativeToastStyles(resolveNativeTheme("light"), { ...props, toasterExpanded: true }, false).root.transform,
  ).toEqual([{ translateY: -75 }, { scale: 1 }])
})
