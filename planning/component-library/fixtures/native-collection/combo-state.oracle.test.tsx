import { writeFileSync } from "node:fs"
import { act, renderHook } from "@testing-library/react"
import { I18nProvider as PinnedI18nProvider } from "react-aria-components"
import { useFilter as usePinnedFilter } from "react-aria/useFilter"
import { useComboBoxState as usePinnedComboBoxState } from "react-stately/useComboBoxState"
import { afterAll, expect, it } from "vitest"

import type { TSourceManagerSurface } from "../../../../packages/react-native/src/collection/state/types"
import type {
  ComboBoxState,
  ComboBoxStateOptions,
} from "../../../../packages/react-native/src/components/ComboBox/state/types"
import { useComboBoxState } from "../../../../packages/react-native/src/components/ComboBox/state/useComboBoxState"
import { createNativeComboBoxFilter } from "../../../../packages/react-native/src/components/ComboBox/filter"
import {
  collection,
  ITEMS,
  type TItem,
} from "../../../../packages/react-native/src/components/ComboBox/state/__tests__/collection"

type TState = Omit<ComboBoxState<TItem>, "selectionManager" | "collection"> & {
  collection: import("react-stately/useComboBoxState").ComboBoxState<TItem>["collection"]
  selectionManager: Pick<TSourceManagerSurface, "focusedKey" | "isFocused" | "selectedKeys" | "setFocusedKey">
}
type THook = (props: ComboBoxStateOptions<TItem>) => TState
const observe = (state: TState) => ({
  methods: Object.keys(state)
    .filter((key) => typeof state[key as keyof TState] === "function")
    .sort(),
  value: state.value,
  defaultValue: state.defaultValue,
  inputValue: state.inputValue,
  defaultInputValue: state.defaultInputValue,
  selectedKey: state.selectedKey,
  defaultSelectedKey: state.defaultSelectedKey,
  selectedItem: state.selectedItem?.key ?? null,
  selectedItems: state.selectedItems.map((node) => [node.key, node.value]),
  keys: [...state.collection.getKeys()],
  nodes: [...state.collection].map((node) => [
    node.key,
    node.index,
    node.prevKey ?? null,
    node.nextKey ?? null,
    node.textValue,
  ]),
  size: state.collection.size,
  open: state.isOpen,
  focused: state.isFocused,
  focusStrategy: state.focusStrategy,
  managerFocused: state.selectionManager.isFocused,
  focusedKey: state.selectionManager.focusedKey,
  selectedKeys: [...state.selectionManager.selectedKeys],
  disabledKeys: [...state.disabledKeys],
  realtime: state.realtimeValidation,
  display: state.displayValidation,
})
const trace = async (hook: THook, controlled: boolean) => {
  const original = collection()
  const events: unknown[][] = []
  const { result, unmount } = await renderHook(() =>
    hook({
      collection: original,
      defaultItems: ITEMS,
      defaultValue: 0,
      value: controlled ? null : undefined,
      inputValue: controlled ? "held" : undefined,
      defaultFilter: (label, input) => label.toLowerCase().includes(input.toLowerCase()),
      onChange: (value) => events.push(["value", value]),
      onSelectionChange: (key) => events.push(["legacy", key]),
      onInputChange: (value) => events.push(["input", value]),
      onOpenChange: (open, trigger) => events.push(["open", open, trigger]),
    }),
  )
  const observations = [observe(result.current)]
  const operations: ((state: TState) => void)[] = [
    (state) => state.setFocused(true),
    (state) => state.setInputValue("be"),
    (state) => state.open(null, "manual"),
    (state) => state.selectionManager.setFocusedKey("b"),
    (state) => state.commit(),
    (state) => state.setInputValue("changed"),
    (state) => state.revert(),
    (state) => state.setFocused(false),
  ]
  for (const operation of operations) {
    await act(() => operation(result.current))
    observations.push(observe(result.current))
  }
  await unmount()
  return { events, observations }
}

const records: unknown[] = []
afterAll(() => {
  const path = process.env.CODON_COMBO_STATE_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(records, null, 2))
})
it.each([false, true])("matches the actual pinned DOM state trace with controlled=%s", async (controlled) => {
  const native = await trace(useComboBoxState, controlled)
  const canonical = await trace(usePinnedComboBoxState, controlled)
  expect(native).toEqual(canonical)
  records.push({ controlled, canonical, native })
})

const validationTrace = async (hook: THook) => {
  const data = collection()
  const { result, unmount } = renderHook(() =>
    hook({
      collection: data,
      validationBehavior: "native",
      validate: ({ inputValue }) => (inputValue === "invalid" ? "Client invalid" : null),
    }),
  )
  const observations = [observe(result.current)]
  await act(() => result.current.setInputValue("invalid"))
  observations.push(observe(result.current))
  expect(result.current.realtimeValidation.isInvalid).toBe(true)
  expect(result.current.displayValidation.isInvalid).toBe(false)
  await act(() => result.current.commitValidation())
  observations.push(observe(result.current))
  expect(result.current.displayValidation.validationErrors).toEqual(["Client invalid"])
  const external = {
    isInvalid: true,
    validationErrors: ["External validation"],
    validationDetails: { ...result.current.realtimeValidation.validationDetails, customError: true, valid: false },
  }
  await act(() => result.current.updateValidation(external))
  observations.push(observe(result.current))
  await act(() => result.current.commitValidation())
  observations.push(observe(result.current))
  await act(() => result.current.resetValidation())
  observations.push(observe(result.current))
  expect(result.current.displayValidation.isInvalid).toBe(false)
  expect(result.current.inputValue).toBe("invalid")
  unmount()
  return observations
}

it("matches complete pinned realtime, commit, external-result and reset validation state", async () => {
  const native = await validationTrace(useComboBoxState)
  const canonical = await validationTrace(usePinnedComboBoxState)
  expect(native).toEqual(canonical)
  records.push({ validation: true, canonical, native })
})

it("preserves the pinned Unicode and locale contains filter", async () => {
  const pairs = [
    ["Étiquette", "etiquette"],
    ["e\u0301tiquette", "éti"],
    ["İstanbul", "i"],
    ["Istanbul", "ı"],
    ["Straße", "strasse"],
    ["Ångström", "ang"],
    ["😀 Beta", "😀"],
    ["Beta", ""],
    ["", "b"],
    ["Beta", "eta"],
  ] as const
  for (const locale of ["en-US", "fr-FR", "tr-TR", "de-DE"]) {
    const native = createNativeComboBoxFilter(locale)
    // Locale is supplied by the actual source i18n context, just as the native receiver supplies its locale.
    const { result: localized, unmount: close } = await renderHook(() => usePinnedFilter({ sensitivity: "base" }), {
      wrapper: ({ children }) => <PinnedI18nProvider locale={locale}>{children}</PinnedI18nProvider>,
    })
    expect(pairs.map(([text, query]) => native(text, query))).toEqual(
      pairs.map(([text, query]) => localized.current.contains(text, query)),
    )
    await close()
  }
})
