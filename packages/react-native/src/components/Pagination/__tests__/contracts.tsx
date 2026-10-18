import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { Pagination } from "../Pagination"
import type { TNativePaginationProps } from "../types"

const base = {
  currentPage: 1,
  itemsPerPage: 10,
  numberOfItems: 100,
  setCurrentPage: (_value: number) => {},
  setItemsPerPage: (_value: number) => {},
} satisfies TNativePaginationProps
export const nativeContract = (
  <Pagination
    {...base}
    ref={createRef<View>()}
    pageInputRef={createRef<TextInput>()}
    itemsPerPageOptions={[]}
    showWithOnePage={false}
    rtl={false}
    style={[{ width: 0 }, { height: 0 }]}
    chosenPaginationSubcomponents={["page-input", "primary-controls"]}
    customClickPopoverProps={{ ref: createRef<View>(), isOpen: false }}
  />
)
// @ts-expect-error Controlled page ownership and both request callbacks are mandatory.
export const missingOwner = <Pagination currentPage={1} itemsPerPage={10} numberOfItems={0} />
// @ts-expect-error String page values cannot replace controlled numeric ownership.
export const stringPage = <Pagination {...base} currentPage="1" />
// @ts-expect-error The audited maximum is exclusive21.
export const invalidMaximum = <Pagination {...base} maxVisiblePages={21} />
// @ts-expect-error Root refs remain actual native View instances.
export const fakeRef = <Pagination {...base} ref={createRef<{ focus: () => void }>()} />
// @ts-expect-error DOM styling is not a native root surface.
export const webClass = <Pagination {...base} className="pager" />
// @ts-expect-error Nested counters cannot replace the owned current page.
export const replacedCounter = <Pagination {...base} customPageCounterProps={{ value: 99 }} />
// @ts-expect-error Nested numeric inputs cannot replace the owned page draft/range.
export const replacedInput = <Pagination {...base} customPageNumberInputProps={{ value: 9 }} />
// @ts-expect-error The page-size collection remains owned by Pagination.
export const replacedOptions = <Pagination {...base} customItemsPerPageSelectProps={{ items: [] }} />
// @ts-expect-error Unknown group names do not silently render an incomplete pager.
export const unknownGroup = <Pagination {...base} chosenPaginationSubcomponents={["all"]} />
