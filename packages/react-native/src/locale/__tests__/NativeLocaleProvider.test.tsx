import { act, renderHook } from "@testing-library/react-native"
import type { ReactNode } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { NativeLocaleProvider, resolveNativeLocale, useNativeLocale } from "../NativeLocaleProvider"

it.each([
  ["en-GB", "ltr"],
  ["ar-EG", "rtl"],
  ["he-IL", "rtl"],
  ["fa-IR", "rtl"],
  ["ar-Latn", "ltr"],
  ["az-Arab", "rtl"],
  ["ku-Latn", "ltr"],
  ["ja-JP", "ltr"],
])("derives %s direction from script and host Intl text information", (locale, direction) => {
  expect(resolveNativeLocale(locale)).toEqual({ locale, direction })
})

it("defaults to the actual host Intl locale", async () => {
  const { result } = await renderHook(useNativeLocale)
  expect(result.current).toEqual(resolveNativeLocale(new Intl.DateTimeFormat().resolvedOptions().locale))
})

it("reconciles mounted provider replacements without remounting the receiver", async () => {
  let locale = "en-GB"
  const { result, rerender } = await renderHook(useNativeLocale, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NativeLocaleProvider locale={locale}>{children}</NativeLocaleProvider>
    ),
  })
  expect(result.current.direction).toBe("ltr")
  locale = "ar-EG"
  await rerender(undefined)
  expect(result.current).toEqual({ locale, direction: "rtl" })
})

it("refreshes host locale on actual active AppState observations and releases the listener", async () => {
  const remove = jest.fn()
  let callback: ((state: AppStateStatus) => void) | undefined
  const subscribe = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    callback = listener
    return { remove }
  })
  const { result, unmount } = await renderHook(useNativeLocale)
  await act(() => callback?.("active"))
  expect(result.current.locale).toBe(new Intl.DateTimeFormat().resolvedOptions().locale)
  await unmount()
  expect(remove).toHaveBeenCalledTimes(1)
  subscribe.mockRestore()
})
