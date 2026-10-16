// Preserve Select's private import boundary and diagnostics while sharing validation.
export {
  validateCollectionKey as validateSelectKey,
  encodeCollectionKey as encodeSelectKey,
  normalizeCollection as normalizeSelectCollection,
} from "../collection"
export type {
  TNativeCollectionKey as TNativeSelectKey,
  TNativeCollectionEntry as TNativeSelectEntry,
} from "../collection"
