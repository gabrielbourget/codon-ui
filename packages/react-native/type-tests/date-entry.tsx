import { NativeLocaleProvider, useNativeLocale, type TNativeLocale } from "../src/index"

const LocaleReceiver = () => {
  const { locale, direction }: TNativeLocale = useNativeLocale()
  const language: string = locale
  const writingDirection: "ltr" | "rtl" = direction
  void language
  void writingDirection
  return null
}

export const localeEntryContracts = (
  <NativeLocaleProvider locale="ar-EG">
    <LocaleReceiver />
    <NativeLocaleProvider />
  </NativeLocaleProvider>
)

// @ts-expect-error Direction follows locale and cannot conflict with it.
export const invalidDirection = <NativeLocaleProvider locale="ar-EG" direction="ltr" />
// @ts-expect-error The locale is an optional BCP 47 string, never null.
export const invalidLocale = <NativeLocaleProvider locale={null} />
