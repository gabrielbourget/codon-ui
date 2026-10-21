import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { expect, it } from "vitest"

import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"
import { formatNativeTagSelectionMessage } from "../../../../packages/react-native/src/components/TagGroup/selectionAnnouncement"
import {
  nativeTagSelectionMessages,
  type TNativeTagSelectionMessageKey,
} from "../../../../packages/react-native/src/components/TagGroup/selectionMessages"

const require = createRequire(resolve("packages/react/package.json"))
const aria = dirname(require.resolve("react-aria/package.json"))
const strings = createRequire(resolve(aria, "package.json"))("@internationalized/string") as {
  LocalizedStringDictionary: new (messages: Record<string, object>) => object
  LocalizedStringFormatter: new (
    locale: string,
    dictionary: object,
  ) => { format: (key: string, args: { item: string; count: number }) => string }
}
it.each(Object.keys(nativeTagSelectionMessages))("matches all four pinned selection messages in %s", async (locale) => {
  const source = await import(
    /* @vite-ignore */ pathToFileURL(resolve(aria, "dist/private/intl/grid", locale + ".mjs")).href
  )
  const dictionary = new strings.LocalizedStringDictionary({ [locale]: source.default })
  const formatter = new strings.LocalizedStringFormatter(locale, dictionary)
  for (const key of [
    "selectedItem",
    "deselectedItem",
    "selectedCount",
    "selectedAll",
  ] as TNativeTagSelectionMessageKey[])
    for (const count of [0, 1, 2, 3, 11, 1000]) {
      const args = { item: "Typed zero", count }
      expect(formatNativeTagSelectionMessage(key, args, {}, locale)).toBe(formatter.format(key, args))
    }
})

it.each(Object.keys(nativeTagSelectionMessages))(
  "matches pinned integer counts without native PluralRules in %s",
  async (locale) => {
    const source = await import(
      /* @vite-ignore */ pathToFileURL(resolve(aria, "dist/private/intl/grid", locale + ".mjs")).href
    )
    const formatter = new strings.LocalizedStringFormatter(
      locale,
      new strings.LocalizedStringDictionary({ [locale]: source.default }),
    )
    const counts = [
      ...Array.from({ length: 1001 }, (_, index) => index),
      10001,
      100001,
      1000000,
      2147483647,
      4294967295,
    ]
    const expected = counts.map((count) => formatter.format("selectedCount", { item: "", count }))
    const original = Object.getOwnPropertyDescriptor(Intl, "PluralRules")!
    try {
      Object.defineProperty(Intl, "PluralRules", { ...original, value: undefined })
      expect(
        counts.map((count) => formatNativeTagSelectionMessage("selectedCount", { item: "", count }, {}, locale)),
      ).toEqual(expected)
    } finally {
      Object.defineProperty(Intl, "PluralRules", original)
    }
  },
)

it("records actual canonical TagGroup selection announcements", async () => {
  render(
    <TagGroup aria-label="Tags" selectionMode="multiple">
      <Tag id={0} textValue="Number zero" data-testid="number-zero">
        Number zero
      </Tag>
      <Tag id="0" textValue="String zero" data-testid="string-zero">
        String zero
      </Tag>
    </TagGroup>,
  )
  const user = userEvent.setup()
  const latest = () => document.querySelector('[role="log"][aria-live="assertive"]')?.lastElementChild?.textContent
  await user.click(screen.getByTestId("number-zero"))
  await waitFor(() => expect(latest()).toBe("Number zero selected."))
  await user.click(screen.getByTestId("string-zero"))
  await waitFor(() => expect(latest()).toBe("String zero selected. 2 items selected."))
  await user.click(screen.getByTestId("number-zero"))
  await waitFor(() => expect(latest()).toBe("Number zero not selected. 1 item selected."))
})
