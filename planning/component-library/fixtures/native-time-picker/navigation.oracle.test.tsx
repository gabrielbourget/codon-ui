import { Time } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { I18nProvider } from "react-aria-components"
import { afterEach, expect, it, vi } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
import {
  nativeDateFieldPressIndex,
  nativeDateFieldVisualIndex,
} from "../../../../packages/react-native/src/date/field/selection"

afterEach(() => {
  document.querySelector<HTMLButtonElement>("button[data-navigation-outside]")?.focus()
  cleanup()
  vi.restoreAllMocks()
})
const source = (locale: string, value: Time | null, isReadOnly = false) => {
  const view = render(
    <>
      <button data-navigation-outside>Outside navigation oracle</button>
      <I18nProvider locale={locale}>
        <TimePicker aria-label="Clock" defaultValue={value} granularity="second" isReadOnly={isReadOnly} />
      </I18nProvider>
    </>,
  )
  return { ...view, parts: () => screen.getAllByRole("spinbutton") }
}
for (const locale of ["en-GB", "ar-EG"]) {
  for (const positions of [
    [10, 90, 40],
    [40, 10, 40],
    [90, 40, 10],
  ]) {
    for (const direction of [-1, 1] as const) {
      it(`matches actual source ${locale} physical/logical navigation ${positions} ${direction}`, () => {
        const view = source(locale, new Time(13, 45, 7), true),
          parts = view.parts(),
          from = 1
        parts.forEach((part, index) =>
          vi.spyOn(part, "getBoundingClientRect").mockReturnValue(new DOMRect(positions[index], index * 30, 20, 25)),
        )
        act(() => parts[from].focus())
        const candidate =
          locale === "ar-EG" ? nativeDateFieldVisualIndex(positions, positions[from], direction) : from + direction
        fireEvent.keyDown(parts[from], { key: direction === -1 ? "ArrowLeft" : "ArrowRight" })
        expect(document.activeElement).toBe(parts[candidate < 0 || candidate >= parts.length ? from : candidate])
      })
    }
  }
}
it.each(["empty", "partial", "filled"])(
  "matches actual source background press placeholder traversal: %s",
  async (kind) => {
    const view = source("en-GB", kind === "filled" ? new Time(13, 45, 7) : null)
    if (kind === "partial") {
      act(() => view.parts()[0].focus())
      fireEvent.keyDown(view.parts()[0], { key: "2" })
    }
    const parts = view.parts(),
      placeholders = parts.map((part) => part.hasAttribute("data-placeholder"))
    const expected = nativeDateFieldPressIndex(placeholders, null)
    const group = view.container.querySelector<HTMLElement>('[data-testid="time-picker"] [role="group"]')!
    expect(group).not.toBeNull()
    await userEvent.setup().click(group)
    expect(document.activeElement).toBe(parts[expected])
  },
)
