import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { act, render, cleanup } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { setInteractionModality } from "../../../../node_modules/.pnpm/react-aria@3.48.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/react-aria/dist/private/interactions/useFocusVisible.mjs"
import { useSafelyMouseToSubmenu } from "../../../../node_modules/.pnpm/react-aria@3.48.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/react-aria/dist/private/menu/useSafelyMouseToSubmenu.mjs"

type TRectangle = [number, number, number, number]
type TStep =
  | { move: [number, number]; delay?: number }
  | { wait: number }
  | { resize: TRectangle }
  | { enabled: boolean }
type TCase = { name: string; parent: TRectangle; submenu: TRectangle; steps: TStep[] }
const cases: TCase[] = [
  {
    name: "right-side grace, first invalid release, two-movement recovery and exact timer boundaries",
    parent: [0, 0, 220, 200],
    submenu: [220, 0, 440, 220],
    steps: [
      { move: [20, 30] },
      { move: [60, 60], delay: 50 },
      { wait: 999 },
      { wait: 1 },
      { wait: 99 },
      { wait: 1 },
      { move: [60, 60] },
      { move: [80, 70], delay: 50 },
      { move: [10, 70], delay: 50 },
      { move: [0, 70], delay: 50 },
      { move: [70, 80], delay: 50 },
      { move: [100, 100], delay: 50 },
      { wait: 1100 },
    ],
  },
  {
    name: "left-side grace, leaving and reentering, current handoff cancellation",
    parent: [220, 0, 440, 200],
    submenu: [0, 0, 220, 220],
    steps: [
      { move: [420, 30] },
      { move: [380, 60], delay: 50 },
      { move: [200, 70], delay: 50 },
      { wait: 1200 },
      { move: [410, 30] },
      { move: [370, 70], delay: 50 },
      { wait: 1000 },
      { move: [360, 80], delay: 50 },
      { wait: 1100 },
    ],
  },
  {
    name: "throttled movement preserves original timeout; resize recomputes submenu side",
    parent: [0, 0, 220, 200],
    submenu: [220, 0, 440, 220],
    steps: [
      { move: [20, 30] },
      { move: [60, 60], delay: 50 },
      { move: [0, 199], delay: 49 },
      { resize: [220, -40, 460, 240] },
      { move: [100, 90], delay: 1 },
      { enabled: false },
      { wait: 2000 },
      { enabled: true },
      { move: [30, 40] },
      { move: [80, 80], delay: 50 },
      { wait: 1100 },
    ],
  },
]
for (let seed = 1; seed <= 12; seed++) {
  let random = seed
  const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 2 ** 32
  const left = seed % 2 === 0
  const parent: TRectangle = left ? [220, -30, 440, 200] : [0, -30, 220, 200]
  cases.push({
    name: `source-generated geometry/timing trace ${seed}`,
    parent,
    submenu: left ? [-10, -40, 220, 240] : [220, -40, 450, 240],
    steps: Array.from({ length: 160 }, () =>
      next() < 0.2
        ? { wait: Math.floor(next() * 1300) }
        : { move: [parent[0] - 20 + next() * 260, -50 + next() * 300], delay: Math.floor(next() * 101) },
    ),
  })
}

let output: string
let repository = process.cwd()
while (!existsSync(resolve(repository, "pnpm-workspace.yaml"))) {
  const parent = resolve(repository, "..")
  if (parent === repository) throw new Error("Codon workspace root unavailable")
  repository = parent
}
const java = "/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home/bin/java"
beforeAll(() => {
  output = mkdtempSync("/private/tmp/codon-native-menu-grace-oracle-")
  execFileSync(
    java.replace(/java$/, "javac"),
    [
      "-d",
      output,
      resolve(repository, "packages/react-native/android/src/main/java/com/codonui/input/CUIMenuPointerGrace.java"),
      resolve(repository, "planning/component-library/fixtures/native-menu-focus/GraceRunner.java"),
    ],
    { timeout: 30000 },
  )
  execFileSync(
    "/usr/bin/clang++",
    [
      "-std=c++17",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-I",
      resolve(repository, "packages/react-native/ios"),
      resolve(repository, "planning/component-library/fixtures/native-menu-focus/grace_runner.cpp"),
      "-o",
      `${output}/grace`,
    ],
    { timeout: 30000 },
  )
}, 60000)
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("actual pinned hook versus both native production grace calculations", () => {
  it.each(cases)("$name", ({ name, parent, submenu, steps }) => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
    vi.setSystemTime(10000)
    vi.stubGlobal("PointerEvent", MouseEvent)
    setInteractionModality("pointer")
    let rectangle = submenu
    let resize: ResizeObserverCallback | undefined
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    const bounds = ([left, top, right, bottom]: TRectangle) => ({
      x: left,
      y: top,
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      toJSON: () => ({}),
    })
    const Subject = ({ enabled }: { enabled: boolean }) => {
      const menuRef = useRef<HTMLDivElement>(null)
      const submenuRef = useRef<HTMLDivElement>(null)
      useSafelyMouseToSubmenu({ menuRef, submenuRef, isOpen: enabled, isDisabled: false })
      return (
        <>
          <div
            ref={(target) => {
              menuRef.current = target
              if (target) target.getBoundingClientRect = () => bounds(parent)
            }}
            data-testid="menu"
          >
            <div data-testid="row" />
          </div>
          <div
            ref={(target) => {
              submenuRef.current = target
              if (target) target.getBoundingClientRect = () => bounds(rectangle)
            }}
          />
        </>
      )
    }
    const subject = render(<Subject enabled />)
    const menu = subject.getByTestId("menu"),
      row = subject.getByTestId("row")
    let handoffs = 0
    menu.addEventListener("pointerover", () => handoffs++)
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => row })
    const input = ["new", `rect ${submenu.join(" ")}`]
    const expected: string[] = []
    for (const step of steps) {
      if ("wait" in step || ("move" in step && step.delay)) {
        const delta = "wait" in step ? step.wait : step.delay!
        act(() => vi.advanceTimersByTime(delta))
        input.push(`wait ${delta}`)
      }
      if ("move" in step) {
        const event = new MouseEvent("pointermove", { bubbles: true, clientX: step.move[0], clientY: step.move[1] })
        Object.defineProperty(event, "pointerType", { value: "mouse" })
        act(() => window.dispatchEvent(event))
        input.push(`move ${step.move.join(" ")} ${parent.join(" ")}`)
      } else if ("resize" in step) {
        rectangle = step.resize
        act(() => resize?.([], {} as ResizeObserver))
        input.push(`rect ${rectangle.join(" ")}`)
      } else if ("enabled" in step) {
        subject.rerender(<Subject enabled={step.enabled} />)
        input.push(step.enabled ? `rect ${rectangle.join(" ")}` : "retire")
      }
      expected.push(`${menu.style.pointerEvents === "none" ? 1 : 0} ${handoffs}`)
      input.push("read")
    }
    const commands = input.join("\n") + "\n"
    if (name === cases[0].name)
      expect(expected).toEqual([
        "0 0",
        "1 0",
        "1 0",
        "0 0",
        "0 0",
        "0 1",
        "0 1",
        "1 1",
        "0 1",
        "0 1",
        "0 1",
        "1 1",
        "0 2",
      ])
    const actualJava = execFileSync(java, ["-cp", output, "com.codonui.input.GraceRunner"], {
      input: commands,
      timeout: 10000,
    })
      .toString()
      .trim()
      .split("\n")
    const actualUIKit = execFileSync(`${output}/grace`, [], { input: commands, timeout: 10000 })
      .toString()
      .trim()
      .split("\n")
    writeFileSync(
      `${output}/${cases.findIndex((entry) => entry.name === name)}.json`,
      JSON.stringify({ name, parent, submenu, steps, expected, actualJava, actualUIKit }, null, 2),
    )
    expect(actualJava).toEqual(expected)
    expect(actualUIKit).toEqual(expected)
  })
})
