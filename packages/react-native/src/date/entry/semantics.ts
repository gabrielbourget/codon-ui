import type { DateFieldState, DateSegment, DateSegmentType } from "../state/useDateFieldState"
import { LocalizedStringDictionary, LocalizedStringFormatter } from "../strings"

import messages from "./messages"
import spinMessages from "./spinMessages"

const dictionary = new LocalizedStringDictionary(messages)
const spinDictionary = new LocalizedStringDictionary(spinMessages)
type TDisplayNames = Readonly<{ of: (field: Intl.DateTimeFormatPartTypes) => string | undefined }>

export const createNativeDateDisplayNames = (locale: string): TDisplayNames => {
  try {
    return new Intl.DisplayNames(locale, { type: "dateTimeField" })
  } catch {
    return { of: (field) => dictionary.getStringForLocale(field, locale) }
  }
}

export const getNativeDateFieldDescription = (state: DateFieldState, locale: string) => {
  if (!state.value) return ""
  const field = state.maxGranularity === "hour" ? "time" : "date"
  return new LocalizedStringFormatter(locale, dictionary).format(
    field === "time" ? "selectedTimeDescription" : "selectedDateDescription",
    { [field]: state.formatValue({ month: "long" }) },
  )
}

export const getNativeDateSegmentSemantics = (
  segment: DateSegment,
  state: DateFieldState,
  textValue: string,
  locale: string,
  platform: "ios" | "android",
  ariaLabel?: string,
) => {
  if (segment.type === "literal") return { hidden: true } as const
  const name = createNativeDateDisplayNames(locale).of(segment.type as Intl.DateTimeFormatPartTypes)
  const label = `${name}${ariaLabel ? `, ${ariaLabel}` : ""}`
  const textbox = platform === "ios" || segment.type === "timeZoneName"
  return {
    hidden: false,
    label,
    role: textbox ? ("textbox" as const) : ("spinbutton" as const),
    value: textbox ? null : segment.value != null && !isNaN(segment.value) ? segment.value : undefined,
    minimum: textbox ? null : segment.minValue,
    maximum: textbox ? null : segment.maxValue,
    textValue: textbox
      ? null
      : textValue === ""
        ? spinDictionary.getStringForLocale("Empty", locale)
        : (textValue || `${segment.value}`).replace("-", "\u2212"),
    isDisabled: state.isDisabled,
    isReadOnly: state.isReadOnly || !segment.isEditable,
    isRequired: state.isRequired,
    includeDescription: segment === state.segments.find((part) => part.isEditable) || state.isInvalid,
  }
}

export const isEditableNativeDateSegment = (type: DateSegmentType) => type !== "literal" && type !== "timeZoneName"
