/*
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See STEPPER_UPSTREAM.json.
 */
import { NumberFormatter, NumberParser } from "@internationalized/number"

import { VALID_VALIDITY_STATE } from "../ComboBox/state/useFormValidationState"

import type { TNativeStepperNumberFieldProps, TNativeStepperValidation } from "./stepperTypes"

const roundToStepPrecision = (value: number, step: number) => {
  let precision = 0
  const text = step.toString()
  const exponent = text.toLowerCase().indexOf("e-")
  if (exponent > 0) precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponent
  else if (text.includes(".")) precision = text.length - text.indexOf(".")
  const power = 10 ** precision
  return precision > 0 ? Math.round(value * power) / power : value
}

export const snapStepperNumber = (value: number, min: number | undefined, max: number | undefined, step: number) => {
  const remainder = (value - (min ?? 0)) % step
  let snapped = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step ? value + Math.sign(remainder) * (step - Math.abs(remainder)) : value - remainder,
    step,
  )
  if (min !== undefined) {
    if (snapped < min) snapped = min
    else if (max !== undefined && snapped > max)
      snapped = min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step
  } else if (max !== undefined && snapped > max) snapped = Math.floor(roundToStepPrecision(max / step, step)) * step
  return roundToStepPrecision(snapped, step)
}

const decimalOperation = (value: number, step: number, direction: -1 | 1) => {
  let result = value + direction * step
  if (value % 1 !== 0 || step % 1 !== 0) {
    const precision = Math.max(value.toString().split(".")[1]?.length ?? 0, step.toString().split(".")[1]?.length ?? 0)
    const multiplier = 10 ** precision
    result = (Math.round(value * multiplier) + direction * Math.round(step * multiplier)) / multiplier
  }
  return result
}
const normalize = (value: number) => (value === 0 ? 0 : value)

export const createStepperNumberModel = (props: TNativeStepperNumberFieldProps) => {
  const { locale = "en-US", formatOptions = {}, minValue: min, maxValue: max, step } = props
  for (const [name, value] of Object.entries({ minValue: min, maxValue: max, step }))
    if (value !== undefined && (!Number.isFinite(value) || (name === "step" && value <= 0)))
      throw new TypeError(`Stepper: invalid ${name}`)
  if (min !== undefined && max !== undefined && min > max) throw new TypeError("Stepper: invalid bounds order")
  if (!formatOptions || typeof formatOptions !== "object" || Array.isArray(formatOptions))
    throw new TypeError("Stepper: invalid formatOptions")
  const parser = new NumberParser(locale, formatOptions)
  const initialFormatter = new NumberFormatter(locale, formatOptions)
  const resolved = initialFormatter.resolvedOptions()
  const increment = step ?? (resolved.style === "percent" ? 0.01 : 1)
  const formatter = (raw: string) =>
    new NumberFormatter(locale, { ...formatOptions, numberingSystem: parser.getNumberingSystem(raw) })
  const format = (value: number | null, raw = "") => (value === null ? "" : formatter(raw).format(normalize(value)))
  const parse = (raw: string): number | null => {
    const value = parser.parse(raw)
    return Number.isFinite(value) ? normalize(value) : null
  }
  const snap = (value: number) =>
    step === undefined
      ? Math.min(Math.max(value, min ?? -Infinity), max ?? Infinity)
      : snapStepperNumber(value, min, max, step)
  const nextStep = (raw: string, direction: -1 | 1) => {
    const previous = parse(raw)
    const next =
      previous === null
        ? snapStepperNumber((direction === 1 ? min : max) ?? 0, min, max, increment)
        : snapStepperNumber(previous, min, max, increment)
    return normalize(
      previous === null || (direction === 1 ? next > previous : next < previous)
        ? next
        : snapStepperNumber(decimalOperation(previous, increment, direction), min, max, increment),
    )
  }
  return {
    key: JSON.stringify([
      locale,
      min,
      max,
      step,
      Object.entries(formatOptions).sort(([left], [right]) => left.localeCompare(right)),
      props.commitBehavior ?? "snap",
    ]),
    parse,
    format,
    validate: (raw: string) => parser.isValidPartialNumber(raw, min, max),
    snap,
    commit: (raw: string) => {
      if (!raw.trim()) return { value: null }
      const parsed = parse(raw)
      if (parsed === null) return undefined
      const value = parse(format(props.commitBehavior === "validate" ? parsed : snap(parsed), raw))
      return value === null ? undefined : { value }
    },
    endpoint: (direction: -1 | 1) => {
      const bound = direction === -1 ? min : max
      return bound === undefined
        ? undefined
        : normalize(direction === -1 ? bound : snapStepperNumber(bound, min, max, increment))
    },
    step: (raw: string, direction: -1 | 1) => {
      const next = nextStep(raw, direction)
      const previous = parse(raw)
      return Number.isFinite(next) && (previous === null || (direction === 1 ? next > previous : next < previous))
        ? next
        : undefined
    },
  }
}

// The canonical temporary number input has step base min-or-zero and default step 1.
// Scale the comparison tolerance with double precision rather than accepting a fixed off-grid interval.
export const nativeStepperValidity = (
  props: TNativeStepperNumberFieldProps,
  inputValue: string,
  value: number | null,
): TNativeStepperValidation => {
  const missing = !!props.isRequired && !props.isReadOnly && inputValue.length === 0
  const constraints = props.commitBehavior === "validate" && value !== null && !props.isDisabled
  const step = props.step ?? 1
  const base = props.minValue ?? 0
  const ratio = value === null ? 0 : (value - base) / step
  const tolerance =
    8 * Number.EPSILON * Math.max(1, Math.abs(ratio), Math.abs((value ?? 0) / step), Math.abs(base / step))
  const flags = {
    valueMissing: !props.isDisabled && missing,
    rangeUnderflow: constraints && props.minValue !== undefined && value! < props.minValue,
    rangeOverflow: constraints && props.maxValue !== undefined && value! > props.maxValue,
    stepMismatch: constraints && Math.abs(ratio - Math.round(ratio)) > tolerance,
  }
  const isInvalid = Object.values(flags).some(Boolean)
  return {
    isInvalid,
    validationDetails: { ...VALID_VALIDITY_STATE, ...flags, valid: !isInvalid },
    validationErrors: flags.valueMissing ? [props.requiredErrorMessage ?? "Required"] : [],
  }
}

const emptyValueLabels: Readonly<Record<string, string>> = {
  "ar-AE": "فارغ",
  "bg-BG": "Изпразни",
  "cs-CZ": "Prázdné",
  "da-DK": "Tom",
  "de-DE": "Leer",
  "el-GR": "Άδειο",
  "en-US": "Empty",
  "es-ES": "Vacío",
  "et-EE": "Tühjenda",
  "fi-FI": "Tyhjä",
  "fr-FR": "Vide",
  "he-IL": "ריק",
  "hr-HR": "Prazno",
  "hu-HU": "Üres",
  "it-IT": "Vuoto",
  "ja-JP": "空",
  "ko-KR": "비어 있음",
  "lt-LT": "Tuščias",
  "lv-LV": "Tukšs",
  "nb-NO": "Tom",
  "nl-NL": "Leeg",
  "pl-PL": "Pusty",
  "pt-BR": "Vazio",
  "pt-PT": "Vazio",
  "ro-RO": "Gol",
  "ru-RU": "Не заполнено",
  "sk-SK": "Prázdne",
  "sl-SI": "Prazen",
  "sr-SP": "Prazno",
  "sv-SE": "Tomt",
  "tr-TR": "Boş",
  "uk-UA": "Пусто",
  "zh-CN": "空",
  "zh-TW": "空白",
}

export const stepperValueText = (locale: string, text: string) => {
  if (text !== "") return text.replace("-", "\u2212")
  const tag = Intl.getCanonicalLocales(locale)[0] ?? "en-US"
  return (
    emptyValueLabels[tag] ??
    Object.entries(emptyValueLabels).find(([candidate]) => candidate.split("-")[0] === tag.split("-")[0])?.[1] ??
    emptyValueLabels["en-US"]!
  )
}
