/* Copyright 2022 Adobe. Apache-2.0; see ../LICENSE.react-aria.md. */
import { nativeDragMessages } from "./strings"

export type TNativeDragVariables = Record<string, string | number | boolean>
type TChoice = string | (() => string)
export type TNativeDragMessage =
  | string
  | ((args: TNativeDragVariables, formatter: TNativeDragMessageFormatter) => string)
export type TNativeDragMessageFormatter = {
  format: (key: string, args?: TNativeDragVariables) => string
  plural: (count: string | number | boolean, options: Record<string, TChoice>, type?: Intl.PluralRuleType) => string
  number: (value: string | number | boolean) => string
  select: (options: Record<string, TChoice>, value: string | number | boolean) => string
}
const plurals = new Map<string, Intl.PluralRules>(),
  numbers = new Map<string, Intl.NumberFormat>()
// Received portable dictionary lookup/formatting from pinned @internationalized/string3.2.8.
// NativeLocaleProvider supplies the locale; no DOM/global dictionary is read.
export const nativeDragFormatter = (locale: string): TNativeDragMessageFormatter => {
  const language = typeof Intl.Locale === "function" ? new Intl.Locale(locale).language : locale.split("-")[0]
  const messages =
    nativeDragMessages[locale] ??
    nativeDragMessages[language] ??
    Object.entries(nativeDragMessages).find(([key]) => key.startsWith(`${language}-`))?.[1] ??
    nativeDragMessages["en-US"]
  const choose = (value: TChoice) => (typeof value === "function" ? value() : value)
  const formatter: TNativeDragMessageFormatter = {
    format: (key, variables = {}) => {
      const value = messages[key]
      if (!value) throw new Error(`Could not find intl message ${key} in ${locale} locale`)
      return typeof value === "function" ? value(variables, formatter) : value
    },
    plural: (count, options, type = "cardinal") => {
      const exact = options[`=${count}`]
      if (exact) return choose(exact)
      const key = `${locale}:${type}`
      let rules = plurals.get(key)
      if (!rules) {
        rules = new Intl.PluralRules(locale, { type })
        plurals.set(key, rules)
      }
      return choose(options[rules.select(Number(count))] || options.other)
    },
    number: (value) => {
      let format = numbers.get(locale)
      if (!format) {
        format = new Intl.NumberFormat(locale)
        numbers.set(locale, format)
      }
      return format.format(Number(value))
    },
    select: (options, value) => choose(options[String(value)] || options.other),
  }
  return formatter
}
