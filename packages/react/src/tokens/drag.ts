export const DROP_OPERATION__COPY = "copy"
export const DROP_OPERATION__LINK = "link"
export const DROP_OPERATION__MOVE = "move"
export const DROP_OPERATION__CANCEL = "cancel"

export const AVAILABLE_DROP_OPERATIONS = [
  DROP_OPERATION__COPY,
  DROP_OPERATION__LINK,
  DROP_OPERATION__MOVE,
  DROP_OPERATION__CANCEL,
] as const

export type TAvailableDropOperations = (typeof AVAILABLE_DROP_OPERATIONS)[number]
