import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { Time } from "@internationalized/date"
import { cleanup, render, screen } from "@testing-library/react"
import { afterAll, afterEach, expect, it } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
import styles from "../../../../packages/react/src/components/TimePicker/TimePickerStyles.module.css"

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const records: unknown[] = []
afterEach(cleanup)
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-time-transitions-oracle.json", JSON.stringify(records, null, 2) + "\n"),
)

it("retains the actual root/group transition ownership and exact theme timing", () => {
  const css = readFileSync(
    resolve(sourceRoot, "packages/react/src/components/TimePicker/TimePickerStyles.module.css"),
    "utf8",
  )
  const theme = readFileSync(resolve(sourceRoot, "packages/react/theme.css"), "utf8")
  const style = document.createElement("style")
  style.textContent = css
  document.head.append(style)
  try {
    const rules = [...style.sheet!.cssRules] as CSSStyleRule[]
    const transitions = (selector: string) =>
      rules
        .find((rule) => rule.selectorText === selector)!
        .style.getPropertyValue("transition")
        .trim()
    const token = theme.match(/--cui-transition-border-color:\s*([^;]+);/)![1]
    expect(token).toBe("border-color 0.25s ease-in-out")
    expect(transitions(".timePicker")).toBe("var(--cui-transition-border-color)")
    expect(transitions(".inputIconGroup").replace(/\s+/g, " ")).toBe(
      "var(--cui-transition-border-color), color 350ms ease-in-out",
    )
    expect(
      rules
        .filter((rule) => rule.selectorText?.includes("svg"))
        .every((rule) => !rule.style.getPropertyValue("transition")),
    ).toBe(true)
    expect(
      rules
        .filter((rule) => rule.selectorText?.includes("focused") || rule.selectorText?.includes("focus-within"))
        .every((rule) => !rule.style.getPropertyValue("transition")),
    ).toBe(true)
    render(<TimePicker aria-label="Clock" value={new Time(13, 45)} />)
    expect(screen.getByTestId("time-picker")).toHaveClass(styles.timePicker)
    expect(screen.getByRole("group", { name: "TimePicker Input Icon Group" })).toHaveClass(styles.inputIconGroup)
    records.push({
      name: "owned transitions",
      root: token,
      group: [token, "color 350ms ease-in-out"],
      directIconTransition: false,
      outlineTransition: false,
    })
  } finally {
    style.remove()
  }
})

it("keeps inline root, group and input colors on their actual descendants", () => {
  render(
    <TimePicker
      aria-label="Clock"
      value={new Time(13, 45)}
      customStyles={{ color: "red" }}
      customInputIconGroupStyles={{ color: "green" }}
      customInputStyles={{ color: "blue" }}
      ComponentIcon={<span data-testid="text-icon">Text icon</span>}
    />,
  )
  const root = screen.getByTestId("time-picker"),
    group = screen.getByRole("group", { name: "TimePicker Input Icon Group" })
  expect(root.style.color).toBe("red")
  expect(group.style.color).toBe("green")
  expect((group.querySelector(`.${styles.timeInput}`) as HTMLElement).style.color).toBe("blue")
  expect(getComputedStyle(screen.getByTestId("text-icon")).color).toBe("rgb(0, 128, 0)")
  expect(getComputedStyle(screen.getAllByRole("spinbutton")[0]).color).toBe("rgb(0, 0, 255)")
  records.push({
    name: "owned colors",
    root: "red",
    group: "green",
    input: "blue",
    outsideInputIcon: "rgb(0, 128, 0)",
    segment: "rgb(0, 0, 255)",
  })
})
