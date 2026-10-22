/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState } from "react-native"

export type TNativeLocale = Readonly<{ locale: string; direction: "ltr" | "rtl" }>
export type TNativeLocaleProviderProps = { locale?: string; children?: ReactNode }

const NativeLocaleContext = createContext<TNativeLocale | null>(null)

const getHostLocale = () => new Intl.DateTimeFormat().resolvedOptions().locale

// The pinned source prioritizes script direction over language when Intl.Locale exists.
const rtlScripts = new Set(["Arab", "Syrc", "Samr", "Mand", "Thaa", "Mend", "Nkoo", "Adlm", "Rohg", "Hebr"])
const rtlLanguages = new Set([
  "ae",
  "ar",
  "arc",
  "bcc",
  "bqi",
  "ckb",
  "dv",
  "fa",
  "glk",
  "he",
  "ku",
  "mzn",
  "nqo",
  "pnb",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
])

type TLocaleTextInfo = Intl.Locale & {
  getTextInfo?: () => { direction: "ltr" | "rtl" }
  textInfo?: { direction: "ltr" | "rtl" }
}

export const resolveNativeLocale = (locale: string): TNativeLocale => {
  if (Intl.Locale) {
    const parsed = new Intl.Locale(locale).maximize() as TLocaleTextInfo
    const textInfo = typeof parsed.getTextInfo === "function" ? parsed.getTextInfo() : parsed.textInfo
    if (textInfo) return { locale, direction: textInfo.direction }
    if (parsed.script) return { locale, direction: rtlScripts.has(parsed.script) ? "rtl" : "ltr" }
  }
  return { locale, direction: rtlLanguages.has(locale.split("-")[0]) ? "rtl" : "ltr" }
}

const useHostLocale = () => {
  const [locale, setLocale] = useState(getHostLocale)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setLocale(getHostLocale())
    })
    return () => subscription.remove()
  }, [])
  return locale
}

export const NativeLocaleProvider = ({ locale, children }: TNativeLocaleProviderProps) => {
  const hostLocale = useHostLocale()
  const value = useMemo(() => resolveNativeLocale(locale ?? hostLocale), [locale, hostLocale])
  return <NativeLocaleContext.Provider value={value}>{children}</NativeLocaleContext.Provider>
}

export const useNativeLocale = (): TNativeLocale => {
  const inherited = useContext(NativeLocaleContext)
  const hostLocale = useHostLocale()
  return useMemo(() => inherited ?? resolveNativeLocale(hostLocale), [inherited, hostLocale])
}
