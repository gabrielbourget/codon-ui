import { act, render } from "@testing-library/react-native"
import { useLayoutEffect } from "react"

import { OverlayRegistryContext } from "../../NativeOverlayProvider"
import { createOverlayRegistry } from "../../registry"
import { createNativeFloatingLayerRegistry } from "../registry"
import { NativeFloatingWindowContext } from "../scope"
import { useNativeFloatingLayer } from "../useFloatingLayer"

type TOptions = Parameters<typeof useNativeFloatingLayer>[0]
type TLayer = ReturnType<typeof useNativeFloatingLayer>
const Probe = ({ options, observe }: { options: TOptions; observe: (state: TLayer) => void }) => {
  const layer = useNativeFloatingLayer(options)
  useLayoutEffect(() => {
    observe(layer)
  })
  return null
}
const setup = (overrides: Partial<TOptions> = {}) => {
  const options: TOptions = {
    registry: createNativeFloatingLayerRegistry(),
    parent: null,
    isOpen: true,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: jest.fn(),
    ...overrides,
  }
  let layer: TLayer
  const observe = (value: TLayer) => {
    layer = value
  }
  return { options, observe, layer: () => layer!, node: (next = options) => <Probe options={next} observe={observe} /> }
}

it("stages requested open state until explicit geometry readiness", async () => {
  const fixture = setup({ isOpen: false })
  const result = await render(fixture.node())
  expect(fixture.layer().mounted).toBe(false)
  await result.rerender(fixture.node({ ...fixture.options, isOpen: true }))
  expect(fixture.layer().phase).toBe("entering")
  expect(fixture.layer().canAct()).toBe(false)
  await act(() => {
    expect(fixture.layer().entered()).toBe(true)
  })
  expect(fixture.layer().active).toBe(true)
  expect(fixture.layer().canAct()).toBe(true)
  expect(fixture.options.onDismiss).not.toHaveBeenCalled()
})

it("keeps old readiness/exit/action closures inert across close and reopen", async () => {
  const fixture = setup()
  const result = await render(fixture.node())
  const oldEntry = fixture.layer()
  await act(() => {
    fixture.layer().entered()
  })
  const oldOpen = fixture.layer()
  await result.rerender(fixture.node({ ...fixture.options, isOpen: false }))
  const oldExit = fixture.layer()
  await act(() => {
    expect(oldEntry.entered()).toBe(false)
    expect(oldOpen.canAct()).toBe(false)
    expect(fixture.layer().exited()).toBe(true)
  })
  expect(fixture.layer().mounted).toBe(false)
  await result.rerender(fixture.node())
  await act(() => {
    fixture.layer().entered()
  })
  expect(fixture.layer().active).toBe(true)
  expect(oldOpen.canAct()).toBe(false)
  await act(() => {
    expect(oldExit.exited()).toBe(false)
  })
})

it("uses the latest dismissal callback while leaving controlled requests authoritative", async () => {
  const fixture = setup()
  const result = await render(fixture.node())
  await act(() => {
    fixture.layer().entered()
  })
  const latest = jest.fn()
  await result.rerender(fixture.node({ ...fixture.options, onDismiss: latest }))
  await act(() => {
    fixture.options.registry.requestDismiss("outside")
  })
  expect(latest).toHaveBeenCalledWith("outside")
  expect(fixture.options.onDismiss).not.toHaveBeenCalled()
  expect(fixture.layer().active).toBe(true)
})

it("checks actual window admission before delivery and tracks native window registry barriers", async () => {
  const fixture = setup()
  const windows = createOverlayRegistry()
  const result = await render(
    <OverlayRegistryContext.Provider value={windows}>
      <NativeFloatingWindowContext.Provider value={() => windows.canRestore(null)}>
        {fixture.node()}
      </NativeFloatingWindowContext.Provider>
    </OverlayRegistryContext.Provider>,
  )
  await act(() => {
    fixture.layer().entered()
  })
  expect(fixture.layer().active).toBe(true)
  await act(() => {
    windows.register("window", null, false, true)
  })
  expect(fixture.layer().active).toBe(false)
  expect(fixture.layer().canAct()).toBe(false)
  await act(() => {
    fixture.options.registry.requestDismiss("keyboard")
  })
  expect(fixture.options.onDismiss).not.toHaveBeenCalled()
  await act(() => {
    windows.shown("window")
    windows.request("window", false)
  })
  expect(fixture.layer().active).toBe(false)
  await act(() => {
    windows.dismissed("window")
  })
  expect(fixture.layer().active).toBe(true)
  await result.unmount()
})

it("waits for a ready logical parent and preserves nonmodal parent activation", async () => {
  const registry = createNativeFloatingLayerRegistry()
  const parent = registry.register("parent", {
    parent: null,
    isOpen: true,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: jest.fn(),
  })
  const fixture = setup({ registry, parent: "parent", isModal: false })
  await render(fixture.node())
  expect(fixture.layer().mounted).toBe(false)
  await act(() => {
    parent.entered(parent.state().generation)
  })
  expect(fixture.layer().phase).toBe("entering")
  await act(() => {
    fixture.layer().entered()
  })
  expect(fixture.layer().active).toBe(true)
  expect(parent.state().active).toBe(true)
  await act(() => {
    parent.unregister()
  })
  expect(fixture.layer().mounted).toBe(false)
  expect(fixture.options.onDismiss).not.toHaveBeenCalled()
})

it("retires source callbacks and subscription ownership on unmount", async () => {
  const fixture = setup()
  const result = await render(fixture.node())
  await act(() => {
    fixture.layer().entered()
  })
  const old = fixture.layer()
  await result.unmount()
  expect(fixture.options.registry.state(old.id).mounted).toBe(false)
  expect(old.canAct()).toBe(false)
  expect(old.entered()).toBe(false)
  expect(old.exited()).toBe(false)
  expect(fixture.options.registry.requestDismiss("keyboard")).toBe(false)
  expect(fixture.options.onDismiss).not.toHaveBeenCalled()
})

it("does not admit geometry readiness before its native window becomes active", async () => {
  const fixture = setup()
  const node = (active: boolean) => (
    <NativeFloatingWindowContext.Provider value={() => active}>{fixture.node()}</NativeFloatingWindowContext.Provider>
  )
  const result = await render(node(false))
  await act(() => {
    expect(fixture.layer().entered()).toBe(false)
  })
  expect(fixture.layer().phase).toBe("entering")
  await result.rerender(node(true))
  await act(() => {
    expect(fixture.layer().entered()).toBe(true)
  })
  expect(fixture.layer().active).toBe(true)
})

it("retires the old lease when a host registry is replaced without reusing its generation", async () => {
  const fixture = setup()
  const result = await render(fixture.node())
  await act(() => {
    fixture.layer().entered()
  })
  const old = fixture.layer()
  const replacement = createNativeFloatingLayerRegistry()
  await result.rerender(fixture.node({ ...fixture.options, registry: replacement }))
  expect(fixture.options.registry.state(old.id).mounted).toBe(false)
  expect(old.canAct()).toBe(false)
  await act(() => {
    expect(old.entered()).toBe(false)
    expect(fixture.layer().entered()).toBe(true)
  })
  expect(fixture.layer().active).toBe(true)
})
