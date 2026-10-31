// Metro must finish these literal synchronous loads before the app's formatting caches initialize.
declare const require: (specifier: string) => unknown

const REQUIRED_NUMBER_LOCALES = ["en-US", "fr-CA", "fr-FR", "ar-EG"] as const

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

const needsNumberSupport = !hasRequiredNumberSupport()
if (needsNumberSupport) {
  require("@formatjs/intl-getcanonicallocales/polyfill.js")
  require("@formatjs/intl-locale/polyfill.js")
  require("@formatjs/intl-pluralrules/polyfill.js")
  if ("__addLocaleData" in Intl.PluralRules) {
    require("@formatjs/intl-pluralrules/locale-data/en.js")
    require("@formatjs/intl-pluralrules/locale-data/fr.js")
    require("@formatjs/intl-pluralrules/locale-data/ar.js")
  }
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
