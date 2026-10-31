import type { RefObject } from "react"
import { processColor, type ColorValue, type View } from "react-native"

import { sampleNativeMotionColors } from "../../input/motionColors"

import {
  arePanelAppearanceValuesEqual,
  createPanelAppearanceMixer,
  type TPanelAppearanceBounds,
} from "./appearanceValues"

type TTemplate = { changed: boolean; read: (colors: readonly ColorValue[]) => unknown }
const colorField = (field: string) => field === "color" || field.endsWith("Color")
const opaque = (value: unknown) => {
  const encoded = processColor(value as ColorValue)
  return encoded != null && typeof encoded === "object"
}
const templates = (from: unknown, to: unknown, direct: boolean) => {
  const colors: ColorValue[] = []
  const visit = (value: unknown, other: unknown, isColor: boolean): TTemplate => {
    if (isColor) {
      if (opaque(value) && !arePanelAppearanceValuesEqual("color", value, other)) {
        const index = colors.push(value as ColorValue) - 1
        return { changed: true, read: (values) => values[index] }
      }
      return { changed: false, read: () => value }
    }
    if (!value || typeof value !== "object") return { changed: false, read: () => value }
    const entries = Object.entries(value).map(
      ([key, child]) => [key, visit(child, (other as Record<string, unknown> | null)?.[key], colorField(key))] as const,
    )
    if (!entries.some(([, entry]) => entry.changed)) return { changed: false, read: () => value }
    return {
      changed: true,
      read: (values) =>
        Array.isArray(value)
          ? entries.map(([, entry]) => entry.read(values))
          : Object.fromEntries(entries.map(([key, entry]) => [key, entry.read(values)])),
    }
  }
  return { colors, first: visit(from, to, direct), last: visit(to, from, direct) }
}

// Resolve opaque descriptors on the original native host. Placeholder components
// validate mixer compatibility only and never reach a rendered style.
export const createPanelNativeColorMixer = (
  field: string,
  from: unknown,
  to: unknown,
  bounds: TPanelAppearanceBounds,
  foreground: unknown,
  target: RefObject<View | null>,
  changed: () => void,
  failed: (error: Error) => void,
) => {
  const plan = templates(from, to, colorField(field))
  if (!plan.colors.length) return undefined
  const build = (values: readonly ColorValue[]) =>
    createPanelAppearanceMixer(field, plan.first.read(values), plan.last.read(values), bounds, foreground)
  if (!build(plan.colors.map(() => "rgba(0,0,0,1)"))) return undefined
  const host = target.current
  let live = true
  let resolved: ReturnType<typeof build>
  const listeners = new Set<() => void>()
  const isCurrent = () => live && host !== null && target.current === host
  const cancel = (completed = false) => {
    if (!live) return
    const unavailable = completed && !resolved && isCurrent()
    live = false
    for (const listener of listeners) listener()
    listeners.clear()
    if (unavailable) failed(new Error("Panel: native colors unavailable before the appearance deadline"))
  }
  void sampleNativeMotionColors(host, plan.colors, {
    isCurrent,
    onCancel: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  })
    .then((batch) => {
      if (!isCurrent()) return
      resolved = build(
        batch.colors.map(
          ({ red, green, blue, alpha }) => `rgba(${red * 255}, ${green * 255}, ${blue * 255}, ${alpha})`,
        ),
      )
      if (!resolved) throw new Error("Panel: native colors did not resolve a compatible appearance mixer")
      changed()
    })
    .catch((error: unknown) => {
      if (isCurrent()) {
        cancel()
        failed(error instanceof Error ? error : new Error("Panel: native color resolution failed"))
      }
    })
  return { mix: (progress: number) => (resolved ? resolved(progress) : from), release: cancel }
}
