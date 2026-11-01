import type { TimeFieldState } from "../date/state/useTimeFieldState"

import { nativeTimeFieldData, type TNativeTimeFieldFormOptions } from "./timeField"
import { useNativeSegmentedFieldForm, type TOriginalDateField } from "./useSegmentedField"

export const useNativeTimeFieldForm = (
  props: TNativeTimeFieldFormOptions,
  state: TimeFieldState,
  original: TOriginalDateField | null,
  currentOriginal: () => TOriginalDateField | null,
  isFocusObserved: () => boolean,
  semanticBinding = "",
) =>
  useNativeSegmentedFieldForm(
    props,
    nativeTimeFieldData(props, state),
    state,
    () => state.setValue(state.defaultValue),
    original,
    currentOriginal,
    isFocusObserved,
    semanticBinding,
  )
