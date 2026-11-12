import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import {
  installCompactNativeLayout,
  pressCompact,
} from "../../../../../packages/react-native/src/components/CompactTypeaheadSearch/__tests__/fixtures/nativeLayout"
import { CompactTypeaheadSearchScene } from "../CompactTypeaheadSearchScene"

let fixture: ReturnType<typeof installCompactNativeLayout>
beforeEach(() => {
  jest.useFakeTimers()
  fixture = installCompactNativeLayout()
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("filters the public Compact scene and distinguishes numeric and string zero under the existing JS host model", async () => {
  // The maintained helper models measurements and native receipts; this does not qualify native readiness.
  await render(
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={fixture.hostRef} testID="host">
          <CompactTypeaheadSearchScene />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>,
  )
  await fireEvent.changeText(screen.getByTestId("type-ahead-search-input"), " aLpHa ")
  await pressCompact(screen.getByRole("button", { name: "CompactTypeaheadSearch Search Button" }))
  expect(screen.getByTestId("compact-search-state")).toHaveTextContent(/Query: " aLpHa ".*Open: true/)
  await fixture.ready()
  await act(() => jest.advanceTimersByTime(500))
  expect(screen.getAllByRole("option").map((option) => option.props.accessibilityLabel)).toEqual([
    "Alpha numeric",
    "Alpha string",
  ])
  expect(screen.getByRole("option", { name: "Alpha numeric" })).toBeEnabled()
  expect(screen.getByRole("option", { name: "Alpha string" })).toBeEnabled()
  await pressCompact(screen.getByRole("option", { name: "Alpha numeric" }))
  expect(screen.getByTestId("compact-search-state")).toHaveTextContent(/Selection: number:0.*Open: false/)
  expect(screen.getByTestId("compact-search-events")).toHaveTextContent(/selection:number:0/)
  await fireEvent.changeText(screen.getByTestId("type-ahead-search-input"), " aLpHa ")
  await pressCompact(screen.getByRole("button", { name: "CompactTypeaheadSearch Search Button" }))
  expect(screen.getByTestId("compact-search-state")).toHaveTextContent(/Query: " aLpHa ".*Open: true/)
  await fixture.ready()
  await act(() => jest.advanceTimersByTime(500))
  await pressCompact(screen.getByRole("option", { name: "Alpha string" }))
  expect(screen.getByTestId("compact-search-state")).toHaveTextContent(/Selection: string:"0".*Open: false/)
  expect(screen.getByTestId("compact-search-events")).toHaveTextContent(/selection:string:"0"/)
})
