export const REMOVE_TARGET__FILE_AND_LOCKFILE = "file-and-lockfile"
export const REMOVE_TARGET__LOCKFILE_ONLY = "lockfile-only"
export const REMOVE_TARGET__NONE = "none"

export const REMOVE_TARGETS = [
  REMOVE_TARGET__FILE_AND_LOCKFILE,
  REMOVE_TARGET__LOCKFILE_ONLY,
  REMOVE_TARGET__NONE,
] as const

export type TRemoveTarget = (typeof REMOVE_TARGETS)[number]
