export const EJECT_TARGET__LOCKFILE_OWNERSHIP = "lockfile-ownership"
export const EJECT_TARGET__NONE = "none"

export const EJECT_TARGETS = [EJECT_TARGET__LOCKFILE_OWNERSHIP, EJECT_TARGET__NONE] as const

export type TEjectTarget = (typeof EJECT_TARGETS)[number]
