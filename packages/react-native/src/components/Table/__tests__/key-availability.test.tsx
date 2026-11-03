import { createRef, useLayoutEffect } from "react"
import type * as RN from "react-native"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable, type TNativeTableContext } from "../context"
import * as navigation from "../keyboard"
import { nativeTableChildren, createNativeTableHeaderModel, createNativeTableBodyModel } from "../model"
import { Table } from "../Table"
import type { TNativeTableProps } from "../types"

import { renderWithNativeCollections as render } from "./collectionModel"

const rows = [
  { id: 0, name: "Number zero" },
  { id: "0", name: "String zero" },
  { id: "", name: "Empty key" },
  { id: "last", name: "Last row" },
]
const columns = [
  { id: "name", name: "Name", isRowHeader: true },
  { id: "editor", name: "Editor" },
]
afterEach(() => jest.restoreAllMocks())

const setup = async (initialProps: TNativeTableProps = {}, initialLocale?: string) => {
  const capture = createRef<TNativeTableContext>()
  const Capture = ({ host }: { host: Parameters<NonNullable<TNativeTableProps["render"]>>[0] }) => {
    const table = useNativeTable()
    useLayoutEffect(() => {
      capture.current = table
      return () => {
        if (capture.current === table) capture.current = null
      }
    }, [table])
    return <NativeFocusView {...host} />
  }
  const renderRoot: NonNullable<TNativeTableProps["render"]> = (host) => <Capture host={host} />
  let currentProps = initialProps
  const node = (props = initialProps, items = rows, locale = initialLocale) => {
    currentProps = props
    const table = (
      <Table
        selectionMode="multiple"
        selectedKeys={[0]}
        {...props}
        render={renderRoot}
        items={(options) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns }, options),
            createNativeTableBodyModel({ columns, items }, options),
          )
        }
      />
    )
    return (
      <NativeThemeProvider>
        {locale ? <NativeLocaleProvider locale={locale}>{table}</NativeLocaleProvider> : table}
      </NativeThemeProvider>
    )
  }
  const view = await render(node())
  const current = () => {
    if (!capture.current) throw new Error("Current public Table owner required")
    return capture.current
  }
  return { view, node, current, capture, props: () => currentProps }
}

const expectedTokens = (
  table: TNativeTableContext,
  from: string | number | null,
  apple: boolean,
  rtl: boolean,
  wrap: boolean,
  reference: typeof navigation.getNativeTableNavigationKey,
  props: TNativeTableProps,
) =>
  table.state.isKeyboardNavigationDisabled
    ? []
    : navigation.getNativeTableKeyTokens(apple).filter((token) => {
        const key = token.slice(5)
        if (key === "a") return table.manager.selectionMode === "multiple" && !props.disallowSelectAll
        if (key === "Escape")
          return (
            props.escapeKeyBehavior !== "none" &&
            !table.manager.disallowEmptySelection &&
            table.manager.selectedKeys.size > 0
          )
        if (key === "Home" || key === "End") return from != null || token[0] !== "1"
        return reference(table, from, key as "ArrowUp", rtl, token[apple ? 3 : 2] === "1", wrap) != null
      })

it.each([
  ["ios", true, false, "all", undefined],
  ["ios", false, true, "selection", "ar"],
  ["android", true, true, "all", "en-US"],
  ["android", false, false, "selection", undefined],
] as const)(
  "preserves every token on %s OS-RTL=%s wrap=%s disabled=%s locale=%s",
  async (platform, osRTL, wrap, disabledBehavior, locale) => {
    const native = jest.requireActual<typeof RN>("react-native")
    jest.replaceProperty(native.Platform, "OS", platform)
    jest.replaceProperty(native.I18nManager, "isRTL", osRTL)
    const f = await setup({ disabledKeys: ["0"], disabledBehavior, shouldFocusWrap: wrap }, locale)
    const reference = navigation.getNativeTableNavigationKey
    const spy = jest.spyOn(navigation, "getNativeTableNavigationKey")
    for (const key of [null, ...f.current().collection.getKeys()]) {
      spy.mockClear()
      const actual = f.current().keyboard.keysFor(key)
      expect(spy.mock.calls.filter((call) => call[2].startsWith("Arrow"))).toHaveLength(8)
      expect(spy.mock.calls.filter((call) => call[2] === "PageUp" || call[2] === "PageDown")).toHaveLength(32)
      expect(actual).toEqual(
        expectedTokens(
          f.current(),
          key,
          platform === "ios",
          locale ? locale === "ar" : osRTL,
          wrap,
          reference,
          f.props(),
        ),
      )
    }
  },
)

it("recomputes subsequent calls after selection, disabled rows, reorder, removal, provider and wrap changes", async () => {
  const native = jest.requireActual<typeof RN>("react-native")
  jest.replaceProperty(native.Platform, "OS", "ios")
  jest.replaceProperty(native.I18nManager, "isRTL", false)
  const f = await setup()
  const reference = navigation.getNativeTableNavigationKey
  const check = (rtl: boolean, wrap: boolean) => {
    const table = f.current()
    for (const key of [null, ...table.collection.getKeys()])
      expect(table.keyboard.keysFor(key)).toEqual(expectedTokens(table, key, true, rtl, wrap, reference, f.props()))
  }
  check(false, false)
  check(false, false)
  await f.view.rerender(
    f.node({ selectedKeys: [], disabledKeys: ["last"], shouldFocusWrap: true }, [...rows].reverse(), "ar"),
  )
  check(true, true)
  await f.view.rerender(
    f.node({ selectedKeys: [""], disallowSelectAll: true, escapeKeyBehavior: "none" }, rows.slice(0, 2), "en-US"),
  )
  check(false, false)
  await f.view.rerender(f.node({}, [], "en-US"))
  check(false, false)
  await f.view.unmount()
  expect(f.capture.current).toBeNull()
})
