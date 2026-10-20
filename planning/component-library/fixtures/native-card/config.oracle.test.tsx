import { writeFileSync } from "node:fs"

import { act, render } from "@testing-library/react"
import { MotionConfig, MotionConfigContext, useMotionValue } from "motion/react"
import { memo, useContext } from "react"
import type { ContextType } from "react"
import { afterAll, expect, it, vi } from "vitest"

const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-card-config-oracle.json",
    JSON.stringify(
      {
        scope: "Actual pinned Motion React configuration/hooks; DOM runtime only, no native actions",
        records,
      },
      null,
      2,
    ) + "\n",
  ),
)

it("records actual defaults, zero point identity and explicit undefined inheritance", () => {
  const configs: ContextType<typeof MotionConfigContext>[] = []
  const Probe = () => {
    configs.push(useContext(MotionConfigContext))
    return null
  }
  render(
    <>
      <Probe />
      <MotionConfig transition={{ duration: 2 }} skipAnimations reducedMotion="always">
        <MotionConfig transition={undefined} skipAnimations={undefined} reducedMotion={undefined}>
          <Probe />
        </MotionConfig>
      </MotionConfig>
    </>,
  )
  const point = { x: 0, y: 0 }
  expect(configs[0].transformPagePoint(point)).toBe(point)
  expect(configs[0]).toMatchObject({ isStatic: false, reducedMotion: "never" })
  expect(configs[1].transition).toBeUndefined()
  expect(configs[1].skipAnimations).toBeUndefined()
  expect(configs[1].reducedMotion).toBeUndefined()
  records.push({
    case: "defaults/explicit undefined",
    reducedMotion: configs[0].reducedMotion,
    zeroIdentity: true,
    explicitUndefinedRetained: true,
  })
})

it("records actual shallow inheriting versus replacing transitions", () => {
  const configs: ContextType<typeof MotionConfigContext>[] = []
  const Probe = () => {
    configs.push(useContext(MotionConfigContext))
    return null
  }
  render(
    <MotionConfig transition={{ duration: 2, opacity: { delay: 1 } }}>
      <MotionConfig transition={{ inherit: true, ease: "linear" }}>
        <Probe />
      </MotionConfig>
      <MotionConfig transition={{ duration: 0 }}>
        <Probe />
      </MotionConfig>
    </MotionConfig>,
  )
  expect(configs[0].transition).toEqual({ duration: 2, opacity: { delay: 1 }, ease: "linear" })
  expect(configs[1].transition).toEqual({ duration: 0 })
  records.push({ case: "transition scopes", values: configs.map((config) => config.transition) })
})

it("records actual memo identity and mounted static freeze", () => {
  const configs: ContextType<typeof MotionConfigContext>[] = []
  const Probe = memo(() => {
    configs.push(useContext(MotionConfigContext))
    return null
  })
  const view = render(
    <MotionConfig isStatic transition={{ duration: 1 }}>
      <Probe />
    </MotionConfig>,
  )
  view.rerender(
    <MotionConfig isStatic={false} transition={{ duration: 1 }}>
      <Probe />
    </MotionConfig>,
  )
  expect(configs).toHaveLength(1)
  view.rerender(
    <MotionConfig isStatic={false} transition={{ duration: 2 }}>
      <Probe />
    </MotionConfig>,
  )
  expect(configs).toHaveLength(2)
  expect(configs[1].isStatic).toBe(true)
  records.push({ case: "identity/static lifetime", renderCount: configs.length, isStatic: configs[1].isStatic })
})

it.each([false, true])("records actual scalar value rendering in static mode %s", (isStatic) => {
  let value: ReturnType<typeof useMotionValue<number>> | undefined
  let renders = 0
  const Probe = () => {
    renders++
    value = useMotionValue(0)
    return null
  }
  const view = render(
    <MotionConfig isStatic={isStatic}>
      <Probe />
    </MotionConfig>,
  )
  const initial = renders
  act(() => value!.set(2))
  expect(renders).toBe(initial + (isStatic ? 1 : 0))
  records.push({ case: "scalar static rendering", isStatic, renderDelta: renders - initial })
  view.unmount()
  value!.destroy()
})

it("records the pinned static hook invoking function-valued caller data as React state actions", () => {
  const initial = vi.fn(() => 1),
    next = vi.fn(() => 2)
  let value: ReturnType<typeof useMotionValue<typeof initial>> | undefined
  const Probe = () => {
    value = useMotionValue(initial)
    return null
  }
  const view = render(
    <MotionConfig isStatic>
      <Probe />
    </MotionConfig>,
  )
  expect(value!.get()).toBe(initial)
  expect(initial).toHaveBeenCalledTimes(1)
  act(() => value!.set(next))
  expect(value!.get()).toBe(next)
  expect(next).toHaveBeenCalledTimes(1)
  records.push({
    case: "function-data contradiction",
    initialCalls: initial.mock.calls.length,
    updateCalls: next.mock.calls.length,
    motionValueIdentityPreserved: true,
  })
  view.unmount()
  value!.destroy()
})
