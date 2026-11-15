// Metro must finish these literal synchronous loads before the app's formatting caches initialize.
declare const require: (specifier: string) => unknown

const REQUIRED_NUMBER_LOCALES = ["en-US", "fr-CA", "fr-FR", "ar-EG"] as const

const REQUIRED_PLURAL_LOCALES = [
  "ar-AE",
  "bg-BG",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "et-EE",
  "fi-FI",
  "fr-FR",
  "he-IL",
  "hr-HR",
  "hu-HU",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "lt-LT",
  "lv-LV",
  "nb-NO",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sl-SI",
  "sr-SP",
  "sv-SE",
  "tr-TR",
  "uk-UA",
  "zh-CN",
  "zh-TW",
] as const

const hasRequiredNumberSupport = () => {
  try {
    if (typeof Intl === "undefined" || typeof Intl.NumberFormat !== "function") return false
    if (Intl.NumberFormat.supportedLocalesOf([...REQUIRED_NUMBER_LOCALES]).length !== REQUIRED_NUMBER_LOCALES.length)
      return false
    for (const locale of REQUIRED_NUMBER_LOCALES) {
      const formatter = new Intl.NumberFormat(locale, { style: "decimal", maximumFractionDigits: 6 })
      if (typeof formatter.formatToParts !== "function") return false
      const parts = formatter.formatToParts(-1234.5)
      if (!parts.some((part) => part.type === "integer") || !parts.some((part) => part.type === "decimal")) return false
      if (formatter.resolvedOptions().maximumFractionDigits !== 6) return false
    }
    const localized = new Intl.NumberFormat("en-US-u-nu-arab", { maximumFractionDigits: 6 })
    const egyptian = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 6 })
    return (
      typeof localized.formatToParts === "function" &&
      localized.resolvedOptions().numberingSystem === "arab" &&
      egyptian.resolvedOptions().numberingSystem === "arab"
    )
  } catch {
    return false
  }
}

const hasRequiredPluralSupport = () => {
  try {
    if (typeof Intl === "undefined" || typeof Intl.PluralRules !== "function") return false
    if (Intl.PluralRules.supportedLocalesOf([...REQUIRED_PLURAL_LOCALES]).length !== REQUIRED_PLURAL_LOCALES.length)
      return false
    const rules = new Intl.PluralRules("en-US")
    return rules.select(1) === "one" && rules.select(2) === "other"
  } catch {
    return false
  }
}

const needsNumberSupport = !hasRequiredNumberSupport()
const needsPluralSupport = !hasRequiredPluralSupport()
if (needsNumberSupport || needsPluralSupport) {
  require("@formatjs/intl-getcanonicallocales/polyfill.js")
  require("@formatjs/intl-locale/polyfill.js")
}
if (needsPluralSupport) {
  require("@formatjs/intl-pluralrules/polyfill-force.js")
  require("@formatjs/intl-pluralrules/locale-data/ar.js")
  require("@formatjs/intl-pluralrules/locale-data/bg.js")
  require("@formatjs/intl-pluralrules/locale-data/cs.js")
  require("@formatjs/intl-pluralrules/locale-data/da.js")
  require("@formatjs/intl-pluralrules/locale-data/de.js")
  require("@formatjs/intl-pluralrules/locale-data/el.js")
  require("@formatjs/intl-pluralrules/locale-data/en.js")
  require("@formatjs/intl-pluralrules/locale-data/es.js")
  require("@formatjs/intl-pluralrules/locale-data/et.js")
  require("@formatjs/intl-pluralrules/locale-data/fi.js")
  require("@formatjs/intl-pluralrules/locale-data/fr.js")
  require("@formatjs/intl-pluralrules/locale-data/he.js")
  require("@formatjs/intl-pluralrules/locale-data/hr.js")
  require("@formatjs/intl-pluralrules/locale-data/hu.js")
  require("@formatjs/intl-pluralrules/locale-data/it.js")
  require("@formatjs/intl-pluralrules/locale-data/ja.js")
  require("@formatjs/intl-pluralrules/locale-data/ko.js")
  require("@formatjs/intl-pluralrules/locale-data/lt.js")
  require("@formatjs/intl-pluralrules/locale-data/lv.js")
  require("@formatjs/intl-pluralrules/locale-data/nb.js")
  require("@formatjs/intl-pluralrules/locale-data/nl.js")
  require("@formatjs/intl-pluralrules/locale-data/pl.js")
  require("@formatjs/intl-pluralrules/locale-data/pt.js")
  require("@formatjs/intl-pluralrules/locale-data/pt-PT.js")
  require("@formatjs/intl-pluralrules/locale-data/ro.js")
  require("@formatjs/intl-pluralrules/locale-data/ru.js")
  require("@formatjs/intl-pluralrules/locale-data/sk.js")
  require("@formatjs/intl-pluralrules/locale-data/sl.js")
  require("@formatjs/intl-pluralrules/locale-data/sr.js")
  require("@formatjs/intl-pluralrules/locale-data/sv.js")
  require("@formatjs/intl-pluralrules/locale-data/tr.js")
  require("@formatjs/intl-pluralrules/locale-data/uk.js")
  require("@formatjs/intl-pluralrules/locale-data/zh.js")
  if (!hasRequiredPluralSupport())
    throw new TypeError("Native showcase: required plural Intl capabilities remain unavailable")
}
if (needsNumberSupport) {
  require("@formatjs/intl-numberformat/polyfill-force.js")
  require("@formatjs/intl-numberformat/locale-data/en.js")
  require("@formatjs/intl-numberformat/locale-data/fr.js")
  require("@formatjs/intl-numberformat/locale-data/fr-CA.js")
  require("@formatjs/intl-numberformat/locale-data/ar.js")
  require("@formatjs/intl-numberformat/locale-data/ar-EG.js")
  if (!hasRequiredNumberSupport())
    throw new TypeError("Native showcase: required number Intl capabilities remain unavailable")
}

export const NUMBER_INTL_PREPARATION = needsNumberSupport ? "polyfilled" : "existing"

export const PLURAL_INTL_PREPARATION = needsPluralSupport ? "polyfilled" : "existing"
