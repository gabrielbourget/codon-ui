/*
 * Copyright 2022 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

export type TNativeDateMessages = Record<string, string>

// Pinned @internationalized/string locale matching, with native-owned dictionaries.
export class LocalizedStringDictionary {
  private strings: Record<string, TNativeDateMessages>
  private defaultLocale: string

  constructor(messages: Record<string, TNativeDateMessages>, defaultLocale = "en-US") {
    this.strings = Object.fromEntries(Object.entries(messages).filter(([, value]) => value))
    this.defaultLocale = defaultLocale
  }

  getStringForLocale(key: string, locale: string): string {
    const strings = this.getStringsForLocale(locale)
    const value = strings[key]
    if (!value) throw new Error(`Could not find intl message ${key} in ${locale} locale`)
    return value
  }

  getStringsForLocale(locale: string): TNativeDateMessages {
    let strings = this.strings[locale]
    if (!strings) {
      const language = Intl.Locale ? new Intl.Locale(locale).language : locale.split("-")[0]
      strings = this.strings[language]
      if (!strings) {
        for (const key in this.strings) {
          if (key.startsWith(language + "-")) {
            strings = this.strings[key]
            break
          }
        }
      }
      strings ||= this.strings[this.defaultLocale]
      this.strings[locale] = strings
    }
    return strings
  }
}

export class LocalizedStringFormatter {
  constructor(
    private locale: string,
    private strings: LocalizedStringDictionary,
  ) {}

  format(key: string, variables?: Record<string, string | number | boolean>): string {
    return this.strings
      .getStringForLocale(key, this.locale)
      .replace(/\{(\w+)\}/g, (_, name: string) => String(variables?.[name]))
  }
}
