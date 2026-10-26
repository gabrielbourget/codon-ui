import { parseDate, parseDateTime, parseTime } from "@internationalized/date"

import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

const parseTemporalArgument = <T>(argument: TTableFilterDraftArgumentValue, parse: (value: string) => T): T | null => {
  if (argument == null || argument === "") return null
  if (typeof argument !== "string") throw new TypeError("Temporal filter argument must be an ISO string or blank")
  return parse(argument)
}
export const parseFilterDateArgument = (argument: TTableFilterDraftArgumentValue) =>
  parseTemporalArgument(argument, parseDate)
export const parseFilterDateTimeArgument = (argument: TTableFilterDraftArgumentValue) =>
  parseTemporalArgument(argument, parseDateTime)
export const parseFilterTimeArgument = (argument: TTableFilterDraftArgumentValue) =>
  parseTemporalArgument(argument, parseTime)
