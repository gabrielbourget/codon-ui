import type { TNativeKeyboardData } from "../../input/types"
import { encodeCollectionKey } from "../collection"

import {
  AVAILABLE_TOAST_POSITIONS,
  AVAILABLE_TOAST_TYPES,
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_POSITION,
  type TNativeToast,
  type TNativeToastHeight,
  type TNativeToastLabels,
  type TNativeToastPosition,
  type TNativeToastPublication,
} from "./types"

export const DEFAULT_TOAST_LABELS: TNativeToastLabels = {
  cancelActionButton: "Cancel",
  cancelActionButtonAriaLabel: "Cancel Action",
  closeButtonAriaLabel: "Close Toast",
  confirmActionButton: "Confirm",
  confirmActionButtonAriaLabel: "Confirm Action",
}
export const resolveToastLabels = (toast: TNativeToast, labels?: Partial<TNativeToastLabels>): TNativeToastLabels => ({
  ...DEFAULT_TOAST_LABELS,
  cancelActionButton: toast.cancelActionBtnText ?? DEFAULT_TOAST_LABELS.cancelActionButton,
  confirmActionButton: toast.confirmActionBtnText ?? DEFAULT_TOAST_LABELS.confirmActionButton,
  ...labels,
  ...toast.labels,
})
export const resolveToastDuration = (toast: TNativeToast, duration?: number | "persistent") => {
  const resolved = toast.duration ?? duration ?? DEFAULT_TOAST_DURATION
  if (resolved !== "persistent" && (!Number.isFinite(resolved) || resolved < 0))
    throw new TypeError("Toaster: duration must be persistent or finite and nonnegative")
  return resolved
}
export const validateNativeToast = (toast: TNativeToast) => {
  if (typeof toast.id !== "string" && (typeof toast.id !== "number" || !Number.isFinite(toast.id)))
    throw new TypeError("Toaster: ID must be a string or finite number")
  if (toast.type !== undefined && !AVAILABLE_TOAST_TYPES.includes(toast.type))
    throw new TypeError("Toaster: unsupported toast type")
  if (toast.position !== undefined && !AVAILABLE_TOAST_POSITIONS.includes(toast.position))
    throw new TypeError("Toaster: unsupported position")
  resolveToastDuration(toast)
}
export const applyToastPublication = (toasts: readonly TNativeToast[], publication: TNativeToastPublication) => {
  if ("dismiss" in publication)
    return toasts.map((toast) => (toast.id === publication.id ? { ...toast, deletingToast: true } : toast))
  const index = toasts.findIndex((toast) => toast.id === publication.id)
  return index < 0
    ? [publication, ...toasts]
    : toasts.map((toast, current) => (current === index ? { ...toast, ...publication } : toast))
}
export const getNativeToastStacks = (
  toasts: readonly TNativeToast[],
  heights: readonly TNativeToastHeight[],
  position: TNativeToastPosition,
  gap: number,
  maxVisible: number,
) => {
  const groups = new Map<TNativeToastPosition, TNativeToast[]>()
  for (const toast of toasts) {
    const key = toast.position ?? position ?? DEFAULT_TOAST_POSITION
    groups.set(key, [...(groups.get(key) ?? []), toast])
  }
  return [...groups].map(([position, toasts]) => {
    let height = 0
    const offsets = toasts.map((toast, index) => {
      const offset = height + index * gap
      height += heights.find((entry) => entry.id === toast.id && entry.position === position)?.height ?? 0
      return offset
    })
    const visible = toasts.slice(0, maxVisible)
    const firstHeight = heights.find((entry) => entry.id === toasts[0]?.id && entry.position === position)?.height ?? 0
    const stackHeight = visible.reduce(
      (max, toast, index) =>
        Math.max(
          max,
          offsets[index] + (heights.find((entry) => entry.id === toast.id && entry.position === position)?.height ?? 0),
        ),
      0,
    )
    return {
      position,
      toasts,
      offsets,
      firstHeight,
      stackHeight,
      bridges: visible.slice(1).map((toast, index) => ({
        key: encodeCollectionKey(toast.id),
        offset: Math.max(0, offsets[index + 1] - gap),
      })),
    }
  })
}
export const nativeToastHotkey = (keys: readonly string[]) => {
  const key = keys.find((key) => !["shiftKey", "altKey", "ctrlKey", "metaKey"].includes(key))
  if (!key) return []
  const nativeKey = /^Key/.test(key) ? key.slice(3).toLowerCase() : key.replace(/^Digit/, "")
  return Array.from({ length: 16 }, (_, mask) => ({
    shiftKey: !!(mask & 8),
    altKey: !!(mask & 4),
    ctrlKey: !!(mask & 2),
    metaKey: !!(mask & 1),
  }))
    .filter((modifiers) =>
      keys.every((key) =>
        key === "shiftKey" || key === "altKey" || key === "ctrlKey" || key === "metaKey" ? modifiers[key] : true,
      ),
    )
    .map(
      (modifiers) =>
        `${+modifiers.shiftKey}${+modifiers.altKey}${+modifiers.ctrlKey}${+modifiers.metaKey}:${nativeKey}`,
    )
}
export const isNativeToastHotkey = (data: TNativeKeyboardData, keys: readonly string[]) =>
  keys.length > 0 &&
  keys.every((key) => {
    if (key === "shiftKey" || key === "altKey" || key === "ctrlKey" || key === "metaKey") return data[key]
    return (
      data.key.toLowerCase() ===
      key
        .replace(/^Key/, "")
        .replace(/^Digit/, "")
        .toLowerCase()
    )
  })
export const computeToastDateTimeString = (date = new Date()) => {
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][date.getMonth()]
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${month} ${date.getDate()}, ${date.getFullYear()} | ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
