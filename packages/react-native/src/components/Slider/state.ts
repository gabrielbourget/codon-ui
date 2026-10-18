import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { createSliderModel, equalSliderValues, sliderArray } from "./model"
import type { TNativeSliderProps, TNativeSliderState } from "./types"

export const useNativeSliderState = (props: TNativeSliderProps) => {
  const model = useMemo(
    () => createSliderModel(props.minValue, props.maxValue, props.step),
    [props.minValue, props.maxValue, props.step],
  )
  const controlled = useRef(props.value !== undefined)
  const scalarShape =
    props.value !== undefined ? typeof props.value === "number" : typeof props.defaultValue === "number"
  if (
    props.value !== undefined &&
    props.defaultValue !== undefined &&
    (typeof props.value === "number") !== (typeof props.defaultValue === "number")
  )
    throw new TypeError("Slider: value and defaultValue must have the same scalar/array shape")
  const scalar = useRef(scalarShape)
  if (controlled.current !== (props.value !== undefined) || scalar.current !== scalarShape)
    throw new TypeError("Slider: controlled mode and scalar/array shape must remain stable")
  const initial = useRef(
    model.project(sliderArray(props.value === undefined ? props.defaultValue : props.value, [model.min])),
  )
  const [stored, setStored] = useState(initial.current)
  const values = model.project(controlled.current ? sliderArray(props.value, []) : stored)
  const formatKey = JSON.stringify(Object.entries(props.formatOptions ?? {}).sort(([a], [b]) => a.localeCompare(b)))
  const formatter = useMemo(() => new Intl.NumberFormat(props.locale, props.formatOptions), [props.locale, formatKey])
  const [, setDragging] = useState<readonly number[]>([])
  const [focused, setFocused] = useState<number>()
  const focusedRef = useRef<number | undefined>(undefined)
  const [disabledThumbs, setDisabledThumbs] = useState<readonly number[]>([])
  const disabledRef = useRef<readonly number[]>([])
  const mounted = useRef(true)
  const proposal = useRef([...values])
  const draggingRef = useRef<readonly number[]>([])
  const latest = useRef({ props, model, values, formatter, disabledThumbs })
  latest.current = { props, model, values, formatter, disabledThumbs }
  const revision = useRef(0)
  const thumbRevisions = useRef(new Map<number, number>())
  const cancelThumb = (index: number) => {
    draggingRef.current = draggingRef.current.filter((item) => item !== index)
    setDragging(draggingRef.current)
  }
  const previous = useRef({ key: model.key, count: values.length, disabled: props.isDisabled, values, disabledThumbs })
  const cancel = () => {
    revision.current++
    draggingRef.current = []
    setDragging([])
    proposal.current = [...latest.current.values]
  }
  useLayoutEffect(() => {
    const old = previous.current
    const ownerTakeover = !equalSliderValues(old.values, values) && !equalSliderValues(proposal.current, values)
    if (old.key !== model.key || old.count !== values.length || props.isDisabled || ownerTakeover) {
      if (draggingRef.current.length) cancel()
      if (old.key !== model.key || old.count !== values.length || old.disabled !== props.isDisabled || ownerTakeover)
        revision.current++
      if (props.isDisabled || (focused !== undefined && focused >= values.length)) {
        focusedRef.current = undefined
        setFocused(undefined)
      }
    }
    if (old.count !== values.length) {
      const next = disabledRef.current.filter((index) => index < values.length)
      if (next.length !== disabledRef.current.length) {
        disabledRef.current = next
        setDisabledThumbs(next)
      }
    }
    previous.current = { key: model.key, count: values.length, disabled: props.isDisabled, values, disabledThumbs }
  })
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      revision.current++
    }
  }, [])
  const check = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= latest.current.values.length)
      throw new RangeError("Slider: invalid thumb index")
  }
  const editable = (index: number) =>
    mounted.current && !latest.current.props.isDisabled && !disabledRef.current.includes(index)
  const emit = (kind: "onChange" | "onChangeEnd", next: readonly number[]) => {
    const callback = latest.current.props[kind]
    if (scalar.current) (callback as ((value: number) => void) | undefined)?.(next[0]!)
    else (callback as ((value: number[]) => void) | undefined)?.([...next])
  }
  const bounds = (index: number) =>
    [
      index ? latest.current.values[index - 1]! : latest.current.model.min,
      index === latest.current.values.length - 1 ? latest.current.model.max : latest.current.values[index + 1]!,
    ] as const
  const request = (index: number, value: number) => {
    if (!mounted.current) return
    check(index)
    if (!editable(index)) return
    if (!Number.isFinite(value)) throw new TypeError("Slider: requested values must be finite")
    const [min, max] = bounds(index)
    const nextValue = latest.current.model.snap(value, min, max)
    const baseline = draggingRef.current.length ? proposal.current : latest.current.values
    if (baseline[index] === nextValue) return
    const next = [...baseline]
    next[index] = nextValue
    proposal.current = next
    if (!controlled.current) {
      latest.current.values = [...next]
      setStored(next)
    }
    emit("onChange", next)
  }
  const setThumbDragging = (index: number, active: boolean) => {
    if (!mounted.current) return
    check(index)
    if (!editable(index)) return
    const current = draggingRef.current
    if (active) {
      if (current.includes(index)) return
      proposal.current = [...latest.current.values]
      draggingRef.current = [...current, index]
    } else {
      if (!current.includes(index)) return
      draggingRef.current = current.filter((value) => value !== index)
    }
    setDragging(draggingRef.current)
    if (!active && !draggingRef.current.length) emit("onChangeEnd", proposal.current)
  }
  const state: TNativeSliderState = {
    get values() {
      return [...latest.current.values]
    },
    defaultValues:
      props.defaultValue === undefined
        ? [...initial.current]
        : model.project(sliderArray(props.defaultValue, [model.min])),
    get focusedThumb() {
      return focusedRef.current
    },
    get step() {
      return latest.current.model.step
    },
    get pageSize() {
      return latest.current.model.pageSize
    },
    get orientation() {
      return latest.current.props.orientation ?? "horizontal"
    },
    get isDisabled() {
      return latest.current.props.isDisabled ?? false
    },
    getThumbValue: (index) => {
      check(index)
      return latest.current.values[index]!
    },
    setThumbValue: request,
    setThumbPercent: (index, percent) => {
      if (!Number.isFinite(percent)) throw new TypeError("Slider: percent must be finite")
      request(index, latest.current.model.fromPercent(percent))
    },
    isThumbDragging: (index) => draggingRef.current.includes(index),
    setThumbDragging,
    setFocusedThumb: (index) => {
      if (!mounted.current) return
      if (index !== undefined) check(index)
      if (index !== undefined && !editable(index)) return
      focusedRef.current = index
      setFocused(index)
    },
    getThumbPercent: (index) => {
      check(index)
      return latest.current.model.percent(latest.current.values[index]!)
    },
    getValuePercent: (value) => latest.current.model.percent(value),
    getThumbValueLabel: (index) => {
      check(index)
      return latest.current.formatter.format(latest.current.values[index]!)
    },
    getFormattedValue: (value) => latest.current.formatter.format(value),
    getThumbMinValue: (index) => {
      check(index)
      return bounds(index)[0]
    },
    getThumbMaxValue: (index) => {
      check(index)
      return bounds(index)[1]
    },
    getPercentValue: (percent) => latest.current.model.fromPercent(percent),
    isThumbEditable: (index) => {
      check(index)
      return editable(index)
    },
    setThumbEditable: (index, enabled) => {
      if (!mounted.current) return
      check(index)
      const old = disabledRef.current
      const next = enabled ? old.filter((item) => item !== index) : old.includes(index) ? old : [...old, index]
      if (!enabled && !old.includes(index)) {
        thumbRevisions.current.set(index, (thumbRevisions.current.get(index) ?? 0) + 1)
        cancelThumb(index)
        if (focusedRef.current === index) {
          focusedRef.current = undefined
          setFocused(undefined)
        }
      }
      disabledRef.current = next
      setDisabledThumbs(next)
    },
    incrementThumb: (index, amount = 1) => {
      check(index)
      request(index, latest.current.values[index]! + Math.max(amount, latest.current.model.step))
    },
    decrementThumb: (index, amount = 1) => {
      check(index)
      request(index, latest.current.values[index]! - Math.max(amount, latest.current.model.step))
    },
  }
  return { state, model, revision, thumbRevisions, cancel, cancelThumb }
}
