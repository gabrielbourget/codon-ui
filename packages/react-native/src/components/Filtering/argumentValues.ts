import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

export const getFilterArrayArgument = (
  argument: TTableFilterDraftArgumentValue,
): (string | number | null | undefined)[] => {
  if (argument == null) return []
  if (!Array.isArray(argument)) throw new TypeError("Filter range/list argument must be an array or nullish")
  return argument
}

export const getControlledFilterNumberArgument = (argument: TTableFilterDraftArgumentValue): number | null => {
  if (argument == null || argument === "" || Number.isNaN(argument)) return null
  return argument as number
}
