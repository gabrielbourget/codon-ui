import { CalendarDate } from "@internationalized/date"
import { render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { deliverSourceReceipt, sourcePublication, sourceReceipt } from "../../../collection/__tests__/visiblePublisher"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../../collection/snapshot"
import { NativeThemeProvider } from "../../../theme"
import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativeDatePickerAppearance, resolveNativeDatePickerLabels } from "../../picker/appearance"
import { useDatePickerState } from "../../state/useDatePickerState"
import { NativeDateCalendar } from "../NativeDateCalendar"

const Fixture = ({
  month = 10,
  virtualized = false,
  capture,
}: {
  month?: number
  virtualized?: boolean
  capture: (collection: TNativeCollectionSnapshot<unknown>) => void
}) => {
  const value = new CalendarDate(2024, month, 10)
  const state = useDatePickerState({ value })
  const Root = (props: TNativeCollectionRootProps) => {
    capture(props.collection)
    return virtualized ? null : <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  return (
    <NativeThemeProvider>
      <NativeCollectionRendererContext.Provider
        value={{ ...DefaultNativeCollectionRenderer, isVirtualized: virtualized, CollectionRoot: Root }}
      >
        <NativeDateCalendar
          options={{
            range: false,
            state,
            locale: "en-US",
            direction: "ltr",
            props: { multiMonth: false, placeholderValue: value },
          }}
          appearance={getNativeDatePickerAppearance(
            resolveNativeTheme("light"),
            {},
            { isDisabled: false, isFocusWithin: false, isOpen: true },
          )}
          labels={resolveNativeDatePickerLabels(false)}
          initialFocusRef={createRef<View>()}
          testID="calendar"
        />
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>
  )
}

it("authors explicit header/week/day models independently of visible materialization", async () => {
  let collection: TNativeCollectionSnapshot<unknown> | undefined
  const view = await render(
    <Fixture
      virtualized
      capture={(value) => {
        collection = value
      }}
    />,
  )
  expect([...collection!].map((node) => node.key)).toEqual(["header", "body"])
  expect(sourcePublication().receivers).toHaveLength(0)
  expect([...collection!.getChildren("weekdays")].map((node) => node.key)).toEqual(
    Array.from({ length: 7 }, (_, index) => `header:${index}`),
  )
  const weeks = [...collection!.getChildren("body")]
  expect(weeks).toHaveLength(5)
  expect(weeks.every((week) => [...collection!.getChildren(week.key)].length === 7)).toBe(true)
  expect(collection!.getItem("day:0:2")?.props.date.toString()).toBe("2024-10-01")
  expect(
    view.container.queryAll((host) => host.props.descriptorId !== undefined || host.props.rootRevision !== undefined),
  ).toHaveLength(0)
})

it("renders the actual visible calendar grid, headings and day accessibility after model migration", async () => {
  await render(<Fixture capture={() => {}} />)
  expect(screen.getByTestId("calendar-calendar-grid").props.role).toBe("grid")
  expect(screen.getAllByRole("columnheader")).toHaveLength(7)
  expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(35)
  expect(screen.getByTestId("calendar-day-2024-10-10").props.accessibilityState.selected).toBe(true)
  expect(screen.getByTestId("calendar-day-2024-09-29").props.accessibilityState.disabled).toBe(true)
})

it("registers only the original materialized day receivers and rebinds after explicit publisher acknowledgement", async () => {
  await render(<Fixture capture={() => {}} />)
  const publication = sourcePublication()
  expect(publication.receivers).toHaveLength(35)
  expect(new Set(publication.receivers.map((entry) => entry.tag)).size).toBe(35)
  expect(publication.receivers.some((entry) => entry.tag === publication.root.tag)).toBe(false)
  expect(screen.getByTestId("calendar-day-2024-10-10").props.nativeCollectionBinding).toBe("")
  await deliverSourceReceipt(sourceReceipt(1))
  expect(screen.getByTestId("calendar-day-2024-10-10").props.nativeCollectionBinding).toMatch(
    /^source-test-native-lease:/,
  )
})
