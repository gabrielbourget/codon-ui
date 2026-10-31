import {
  decodeNativeFieldInputPacket,
  activeNativeFieldInputEvent,
  receiveNativeFieldOwnedInput,
  type TNativeFieldOwnedInputEvent,
  moveNativeFieldFocus,
  nativeFieldGroupKeyHandler,
  receiveNativeFieldKey,
  receiveNativeFieldPointer,
  type TNativeFieldKeyEvent,
  type TNativeFieldPointerEvent,
} from "../fieldInput"
import type { TNativeKeyboardEvent } from "../types"
import { NativeFieldGroupPress } from "../useFieldGroupPress"

const packet = () => ({
  moduleLease: "module:1",
  token: 1,
  eventId: 1,
  phase: "down",
  identity: {
    ownerId: "field",
    bindingId: "field:1",
    bindingRevision: "rev:1",
    metadataTarget: 15,
    outerTarget: 2,
    inputTarget: 3,
    surfaceId: 11,
    target: 10,
    documentId: "document:1",
    documentRevision: "7",
    windowId: "window:1",
    mountRevision: "mount:7",
    outerInstance: "outer:1",
    inputInstance: "input:1",
    nativeInstance: "component:10",
    editorInstance: "editor:10",
    epoch: 2,
  },
  groups: [
    { target: 3, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2, containsTarget: true },
    { target: 2, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2, containsTarget: true },
  ],
})
const event = (data = packet(), extra: Partial<TNativeFieldKeyEvent["nativeEvent"]> = {}) => {
  let prevented = false,
    stopped = false
  return {
    nativeEvent: {
      kind: "keyboard",
      ownerId: "original-child",
      target: data.identity.target,
      key: "ArrowRight",
      nativeCode: 79,
      characters: "",
      phase: data.phase === "down" ? "down" : "up",
      repeat: false,
      cancelled: data.phase === "cancel",
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: false,
      timestamp: 10,
      fieldDispatch: JSON.stringify(data),
      ...extra,
    },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
    isDefaultPrevented: () => prevented,
    isPropagationStopped: () => stopped,
    get defaultPrevented() {
      return prevented
    },
  } as unknown as TNativeFieldKeyEvent
}
const setup = () => {
  let live = true
  const native = {
    getLease: jest.fn(() => "module:1"),
    acceptsField: jest.fn((_request: string) => true),
    settleField: jest.fn((_request: string) => true),
    moveFieldFocus: jest.fn((_request: string) =>
      JSON.stringify({
        requested: true,
        observed: true,
        current: true,
        target: 13,
        nativeInstance: "component:13",
        editorInstance: "editor:13",
        error: "",
      }),
    ),
  }
  return {
    scope: { bindingId: "field:1", bindingRevision: "rev:1", current: () => live, native },
    native,
    retire: () => {
      live = false
    },
  }
}

const pointerEvent = (
  phase: "pointer-start" | "pointer-end" | "pointer-cancel" | "pointer-click" = "pointer-start",
  options: Partial<TNativeFieldPointerEvent["nativeEvent"]> = {},
) => {
  const data = { ...packet(), phase }
  const original = event() as unknown as TNativeFieldPointerEvent
  // SDK pointers do not have the custom keyboard phase/kind fields.
  const payload = original.nativeEvent as unknown as Record<string, unknown>
  for (const key of Object.keys(payload)) delete payload[key]
  Object.assign(payload, {
    target: data.identity.target,
    pointerId: 0,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: phase === "pointer-start" ? 1 : 0,
    clientX: 27,
    clientY: 18,
    fieldDispatch: JSON.stringify(data),
    ...options,
  })
  return original
}

const pressRoots = { input: {}, outer: {} }
const groupEvent = (
  phase: "pointer-start" | "pointer-end" | "pointer-cancel" | "pointer-click",
  pointerType = "touch",
  options: Partial<TNativeFieldPointerEvent["nativeEvent"]> = {},
  root = pressRoots.input,
) => Object.assign(pointerEvent(phase, { pointerType, ...options }), { currentTarget: root })

it("delivers a portaled control's original group keys without physical group navigation", () => {
  const f = setup(),
    data = packet(),
    caller = jest.fn()
  data.groups.forEach((group) => {
    group.containsTarget = false
  })
  const original = event(data)
  expect(nativeFieldGroupKeyHandler(f.scope, { direction: "ltr", onKeyDown: caller })(original, 3)).toBe(true)
  expect(caller).toHaveBeenCalledWith(original)
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  expect(original.isDefaultPrevented()).toBe(false)
  expect(original.isPropagationStopped()).toBe(false)
})

it("retains the original held-key repeat flag through group navigation and its caller", () => {
  const f = setup(),
    original = event(packet(), { repeat: true }),
    caller = jest.fn()
  nativeFieldGroupKeyHandler(f.scope, { direction: "ltr", onKeyDown: caller })(original, 3)
  expect(caller).toHaveBeenCalledWith(original)
  expect(original.nativeEvent.repeat).toBe(true)
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it.each(["pointer-start", "pointer-end", "pointer-cancel", "pointer-click"] as const)(
  "delivers a portaled control's original %s without group press behavior",
  (phase) => {
    const f = setup(),
      data = { ...packet(), phase },
      caller = jest.fn()
    data.groups.forEach((group) => {
      group.containsTarget = false
    })
    const original = groupEvent(phase, "mouse", { fieldDispatch: JSON.stringify(data) })
    const press = new NativeFieldGroupPress(() => ({
      scope: f.scope,
      onPointerDown: caller,
      onPointerUp: caller,
      onPointerCancel: caller,
      onClick: caller,
    }))
    expect(press.receive(original, 3, phase)).toBe(true)
    expect(caller).toHaveBeenCalledWith(original)
    expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
    expect(original.isDefaultPrevented()).toBe(false)
    expect(original.isPropagationStopped()).toBe(false)
  },
)

it("runs source mouse-start focus before the same group's caller and stops only subsequent ancestors", () => {
  const f = setup(),
    original = groupEvent("pointer-start", "mouse"),
    trace: string[] = []
  const press = new NativeFieldGroupPress(() => ({
    scope: f.scope,
    onPointerDown: (received) => {
      expect(received).toBe(original)
      expect(received.isPropagationStopped()).toBe(true)
      trace.push("group-caller")
    },
  }))
  const focus = f.native.moveFieldFocus.getMockImplementation()!
  f.native.moveFieldFocus.mockImplementation((request) => {
    expect(original.isPropagationStopped()).toBe(false)
    expect(activeNativeFieldInputEvent(f.scope)).toBe(original)
    expect(JSON.parse(request).action).toEqual({ groupTarget: 2, kind: "press" })
    trace.push("original-focus")
    return focus(request)
  })
  expect(press.receive(original, 3, "pointer-start")).toBe(true)
  expect(trace).toEqual(["original-focus", "group-caller"])
  expect(original.isDefaultPrevented()).toBe(false)
  expect(press.receive(original, 2, "pointer-start")).toBe(false)
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it.each(["mouse", "touch", "pen"])("preserves the source's non-primary %s press", (pointerType) => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start", pointerType, { isPrimary: false }), 3, "pointer-start")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(pointerType === "mouse" ? 1 : 0)
  press.receive(groupEvent("pointer-end", pointerType, { isPrimary: false }), 3, "pointer-end")
  press.receive(groupEvent("pointer-click", pointerType, { isPrimary: false }), 3, "pointer-click")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it("starts the new native stream when the previous release was outside the field receivers", () => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start", "touch"), 3, "pointer-start")
  press.receive(groupEvent("pointer-start", "mouse"), 3, "pointer-start")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it.each(["touch", "pen"])("waits for the actual %s click and retains shared input/outer press state", async (type) => {
  const f = setup(),
    received: TNativeFieldPointerEvent[] = []
  const press = new NativeFieldGroupPress(() => ({ scope: f.scope, onPointerUp: (event) => received.push(event) }))
  press.receive(groupEvent("pointer-start", type), 3, "pointer-start")
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  const up = groupEvent("pointer-end", type)
  press.receive(up, 3, "pointer-end")
  Object.assign(up, { currentTarget: pressRoots.outer })
  press.receive(up, 2, "pointer-end")
  await Promise.resolve()
  expect(received).toEqual([up, up])
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  const click = groupEvent("pointer-click", type)
  press.receive(click, 3, "pointer-click")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
  expect(JSON.parse(f.native.moveFieldFocus.mock.calls[0][0])).toMatchObject({
    phase: "pointer-click",
    identity: packet().identity,
    action: { groupTarget: 2, kind: "press" },
  })
  press.receive(groupEvent("pointer-click", type), 3, "pointer-click")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it("preserves a child's original stop before group press state or focus exists", () => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope })),
    down = groupEvent("pointer-start")
  receiveNativeFieldPointer(f.scope, down, "pointer-start", {
    target: 10,
    group: false,
    run: () => down.stopPropagation(),
  })
  expect(press.receive(down, 3, "pointer-start")).toBe(false)
  press.receive(groupEvent("pointer-click"), 3, "pointer-click")
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it.each(["cancel", "retire"])("does not focus from a click after %s", (change) => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  if (change === "cancel") press.receive(groupEvent("pointer-cancel"), 3, "pointer-cancel")
  else press.retire()
  press.receive(groupEvent("pointer-click"), 3, "pointer-click")
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it.each([{ button: 1 }, { button: 2 }])(
  "does not request native focus for ineligible source pointer data %j",
  (options) => {
    const f = setup(),
      press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
    press.receive(groupEvent("pointer-start", "mouse", options), 3, "pointer-start")
    press.receive(groupEvent("pointer-click", "touch", options), 3, "pointer-click")
    expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  },
)

it("cancels an input press released in its outer group after the complete original bubble", async () => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  const up = groupEvent("pointer-end", "touch", {}, pressRoots.outer)
  const data = JSON.parse(up.nativeEvent.fieldDispatch)
  data.groups = [data.groups[1]]
  Object.assign(up.nativeEvent, { fieldDispatch: JSON.stringify(data) })
  press.receive(up, 2, "pointer-end")
  await Promise.resolve()
  press.receive(groupEvent("pointer-click", "touch", {}, pressRoots.outer), 2, "pointer-click")
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it("honors a later original ancestor's stop before document-style release cleanup", async () => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  const up = groupEvent("pointer-end", "touch", {}, pressRoots.outer)
  const data = JSON.parse(up.nativeEvent.fieldDispatch)
  data.groups = [data.groups[1]]
  Object.assign(up.nativeEvent, { fieldDispatch: JSON.stringify(data) })
  press.receive(up, 2, "pointer-end")
  up.stopPropagation()
  await Promise.resolve()
  press.receive(groupEvent("pointer-click", "touch", {}, pressRoots.outer), 2, "pointer-click")
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it("uses current same-group callers without resetting a live contact", () => {
  const f = setup(),
    first = jest.fn(),
    next = jest.fn()
  let caller = first
  const press = new NativeFieldGroupPress(() => ({ scope: f.scope, onClick: caller }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  caller = next
  const click = groupEvent("pointer-click")
  press.receive(click, 3, "pointer-click")
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith(click)
  expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
})

it.each(["window", "surface", "root"])("retires a contact before a changed %s can request focus", (change) => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  const click = groupEvent("pointer-click", "touch", {}, change === "root" ? {} : pressRoots.input)
  const data = JSON.parse(click.nativeEvent.fieldDispatch)
  if (change === "window") data.identity.windowId = "window:2"
  if (change === "surface") data.identity.surfaceId = 12
  Object.assign(click.nativeEvent, { fieldDispatch: JSON.stringify(data) })
  press.receive(click, 3, "pointer-click")
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it("does not invent a successful press when the SDK supplies only a release", async () => {
  const f = setup(),
    press = new NativeFieldGroupPress(() => ({ scope: f.scope }))
  press.receive(groupEvent("pointer-start"), 3, "pointer-start")
  press.receive(groupEvent("pointer-end"), 3, "pointer-end")
  await Promise.resolve()
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it.each(["pointer-start", "pointer-end", "pointer-cancel", "pointer-click"] as const)(
  "carries the original SDK %s through child, input and outer receivers without adding public fields",
  (phase) => {
    const f = setup(),
      original = pointerEvent(phase),
      payload = original.nativeEvent,
      publicKeys = Object.keys(payload),
      trace: number[] = []
    const methods = [original.preventDefault, original.stopPropagation, original.persist]
    for (const [target, group] of [
      [10, false],
      [3, true],
      [2, true],
    ] as const) {
      expect(
        receiveNativeFieldPointer(f.scope, original, phase, {
          target,
          group,
          run: () => {
            expect(activeNativeFieldInputEvent(f.scope)).toBe(original)
            expect(original.nativeEvent).toBe(payload)
            expect(payload.pointerId).toBe(0)
            trace.push(target)
          },
        }),
      ).toBe(true)
      if (target !== 2) expect(f.native.settleField).not.toHaveBeenCalled()
    }
    expect(trace).toEqual([10, 3, 2])
    expect(Object.keys(payload)).toEqual(publicKeys)
    expect([original.preventDefault, original.stopPropagation, original.persist]).toEqual(methods)
    expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
    expect(f.native.settleField).toHaveBeenCalledTimes(1)
    expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ phase, current: true })
    expect(receiveNativeFieldPointer(f.scope, original, phase, { target: 2, group: true, run: jest.fn() })).toBe(false)
  },
)

it("settles original pointer stop/prevent decisions before any ancestor or later focus request", () => {
  const f = setup(),
    original = pointerEvent(),
    group = jest.fn()
  receiveNativeFieldPointer(f.scope, original, "pointer-start", {
    target: 10,
    group: false,
    run: () => {
      original.preventDefault()
      original.stopPropagation()
    },
  })
  expect(receiveNativeFieldPointer(f.scope, original, "pointer-start", { target: 3, group: true, run: group })).toBe(
    false,
  )
  expect(group).not.toHaveBeenCalled()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ preventDefault: true })
  expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "press" })).toBeNull()
})

it.each(["mouse", "touch", "pen"])("retains the actual %s pointer and observed press-focus result", (pointerType) => {
  const f = setup(),
    original = pointerEvent("pointer-end", { pointerType }),
    trace: string[] = []
  const prevent = original.preventDefault
  receiveNativeFieldPointer(f.scope, original, "pointer-end", {
    target: 3,
    group: true,
    run: () => {
      const result = moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "press" })
      expect(result).toMatchObject({ requested: true, observed: true, current: true, target: 13 })
      trace.push("observed-focus")
      original.stopPropagation()
      trace.push("same-group-caller")
    },
  })
  expect(trace).toEqual(["observed-focus", "same-group-caller"])
  expect(original.preventDefault).toBe(prevent)
  expect(original.isDefaultPrevented()).toBe(false)
  expect(JSON.parse(f.native.moveFieldFocus.mock.calls[0][0])).toMatchObject({
    phase: "pointer-end",
    identity: packet().identity,
    action: { groupTarget: 2, kind: "press" },
  })
})

it("does not admit pointer packets to a keyboard receiver or a mismatched actual pointer phase", () => {
  const f = setup(),
    original = pointerEvent(),
    run = jest.fn()
  expect(
    receiveNativeFieldKey(f.scope, original as unknown as TNativeFieldKeyEvent, { target: 3, group: true, run }),
  ).toBe(false)
  expect(receiveNativeFieldPointer(f.scope, original, "pointer-end", { target: 3, group: true, run })).toBe(false)
  expect(run).not.toHaveBeenCalled()
  expect(f.native.settleField).not.toHaveBeenCalled()
})

it("lets cancellation reach its original caller while refusing focus and native-default cancellation", () => {
  const f = setup(),
    original = pointerEvent("pointer-cancel"),
    run = jest.fn(() => {
      original.preventDefault()
      expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "press" })).toBeNull()
    })
  receiveNativeFieldPointer(f.scope, original, "pointer-cancel", { target: 2, group: true, run })
  expect(run).toHaveBeenCalledTimes(1)
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ preventDefault: false, current: true })
})

it.each(["unmount", "throw"])("retires the original pointer turn after callback %s", (change) => {
  const f = setup(),
    original = pointerEvent(),
    failure = new Error("original-pointer-callback")
  const receive = () =>
    receiveNativeFieldPointer(f.scope, original, "pointer-start", {
      target: 2,
      group: true,
      run: () => {
        original.preventDefault()
        if (change === "throw") throw failure
        f.retire()
      },
    })
  if (change === "throw") expect(receive).toThrow(failure)
  else expect(receive()).toBe(true)
  expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ current: false, preventDefault: false })
})

it.each([{ target: 99 }, { pointerId: -1 }, { pointerId: 1.5 }, { pointerType: undefined }, { isPrimary: undefined }])(
  "rejects inconsistent original SDK pointer evidence %j",
  (options) => {
    const f = setup(),
      original = pointerEvent("pointer-start", options),
      run = jest.fn()
    expect(() =>
      receiveNativeFieldPointer(f.scope, original, "pointer-start", { target: 3, group: true, run }),
    ).toThrow("invalid-native-field-input-packet")
    expect(run).not.toHaveBeenCalled()
    expect(f.native.settleField).not.toHaveBeenCalled()
  },
)

it("retains each original receiver event and acknowledges only the last actual group", () => {
  const f = setup(),
    original = event(),
    trace: string[] = []
  for (const [target, group] of [
    [10, false],
    [3, true],
    [2, true],
  ] as const) {
    expect(
      receiveNativeFieldKey(f.scope, original, {
        target,
        group,
        run: () => {
          trace.push(String(target))
          expect(original.nativeEvent.ownerId).toBe("original-child")
        },
      }),
    ).toBe(true)
    if (target !== 2) expect(f.native.settleField).not.toHaveBeenCalled()
  }
  expect(trace).toEqual(["10", "3", "2"])
  expect(f.native.settleField).toHaveBeenCalledTimes(1)
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toEqual({
    token: 1,
    identity: packet().identity,
    eventId: 1,
    phase: "down",
    current: true,
    preventDefault: false,
    focus: null,
  })
  expect(receiveNativeFieldKey(f.scope, original, { target: 2, group: true, run: jest.fn() })).toBe(false)
})

it("settles a child's original stop without invoking a group or replaying a child callback", () => {
  const f = setup(),
    original = event(),
    run = jest.fn(() => original.stopPropagation())
  receiveNativeFieldKey(f.scope, original, { target: 10, group: false, run })
  expect(run).toHaveBeenCalledTimes(1)
  expect(f.native.settleField).toHaveBeenCalledTimes(1)
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).preventDefault).toBe(false)
})

it.each(Array.from({ length: 16 }, (_, mask) => mask))(
  "retains source navigation and original key-up flags for modifier mask %i",
  (mask) => {
    const f = setup(),
      down = jest.fn(),
      up = jest.fn()
    const modifiers = {
      shiftKey: !!(mask & 1),
      altKey: !!(mask & 2),
      ctrlKey: !!(mask & 4),
      metaKey: !!(mask & 8),
      nativeModifierData: String(mask),
    }
    const original = event(packet(), modifiers)
    const handler = nativeFieldGroupKeyHandler(f.scope, { direction: "ltr", onKeyDown: down, onKeyUp: up })
    handler(original, 3)
    handler(original, 2)
    expect(down).toHaveBeenCalledTimes(1)
    expect(down).toHaveBeenCalledWith(original)
    expect(original.nativeEvent).toMatchObject(modifiers)
    expect(original.isDefaultPrevented()).toBe(true)
    expect(original.isPropagationStopped()).toBe(true)
    expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
    const next = packet()
    next.phase = "up"
    next.token = 2
    next.eventId = 2
    next.identity.target = 13
    const release = event(next, modifiers)
    handler(release, 3)
    handler(release, 2)
    expect(up.mock.calls.map(([received]) => received)).toEqual([release, release])
    expect(release.nativeEvent).toMatchObject({ target: 13, phase: "up", ...modifiers })
    expect(f.native.moveFieldFocus).toHaveBeenCalledTimes(1)
  },
)

it("keeps same-group navigation, original focus result and caller order before its propagation stop", () => {
  const f = setup(),
    original = event(),
    trace: string[] = []
  f.native.moveFieldFocus.mockImplementation(() => {
    trace.push("native-focus")
    return JSON.stringify({
      requested: true,
      observed: true,
      current: true,
      target: 13,
      nativeInstance: "component:13",
      editorInstance: "editor:13",
      error: "",
    })
  })
  receiveNativeFieldKey(f.scope, original, {
    target: 3,
    group: true,
    run: () => {
      original.preventDefault()
      original.stopPropagation()
      expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "next" })?.observed).toBe(true)
      trace.push("same-group-caller")
    },
  })
  expect(trace).toEqual(["native-focus", "same-group-caller"])
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).preventDefault).toBe(true)
  expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "next" })).toBeNull()
})

it("retains preventDefault through the actual group path and does not invent focus completion", () => {
  const f = setup(),
    original = event()
  f.native.moveFieldFocus.mockReturnValue(
    JSON.stringify({
      requested: true,
      observed: false,
      current: true,
      target: 13,
      nativeInstance: "component:13",
      editorInstance: "editor:13",
      error: "original-focus-not-observed",
    }),
  )
  receiveNativeFieldKey(f.scope, original, {
    target: 3,
    group: true,
    run: () => {
      original.preventDefault()
    },
  })
  expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "next" })?.observed).toBe(false)
  receiveNativeFieldKey(f.scope, original, { target: 2, group: true, run: jest.fn() })
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).preventDefault).toBe(true)
})

it.each(["up", "cancel"] as const)("retains separate original %s phases and actual single-group paths", (phase) => {
  const f = setup(),
    data = packet()
  data.phase = phase
  data.identity = { ...data.identity, target: 20 }
  data.groups = [data.groups[1]]
  const original = event(data),
    received: TNativeFieldKeyEvent[] = []
  receiveNativeFieldKey(f.scope, original, {
    target: 20,
    group: false,
    run: () => {
      received.push(original)
      original.preventDefault()
    },
  })
  receiveNativeFieldKey(f.scope, original, { target: 2, group: true, run: () => received.push(original) })
  expect(received).toEqual([original, original])
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).phase).toBe(phase)
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).preventDefault).toBe(phase !== "cancel")
})

it("preserves actual focus observations separately from request and later owner retirement", () => {
  const f = setup(),
    original = event()
  for (const [requested, current, error] of [
    [false, true, ""],
    [true, false, "owner-retired-after-focus"],
  ] as const) {
    f.native.moveFieldFocus.mockReturnValue(
      JSON.stringify({
        requested,
        observed: true,
        current,
        target: 13,
        nativeInstance: "component:13",
        editorInstance: "editor:13",
        error,
      }),
    )
    expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "first" })).toMatchObject({
      requested,
      observed: true,
      current,
    })
  }
})

it.each(["owner", "native-frame", "module", "revision", "group"])(
  "declines %s changes before caller/default/focus effects",
  (change) => {
    const f = setup(),
      original = event(),
      run = jest.fn()
    if (change === "owner") f.retire()
    if (change === "native-frame") f.native.acceptsField.mockReturnValue(false)
    if (change === "module") f.native.getLease.mockReturnValue("other")
    const scope = change === "revision" ? { ...f.scope, bindingRevision: "rev:2" } : f.scope
    expect(receiveNativeFieldKey(scope, original, { target: change === "group" ? 99 : 3, group: true, run })).toBe(
      false,
    )
    expect(run).not.toHaveBeenCalled()
    expect(f.native.settleField).not.toHaveBeenCalled()
  },
)

it("rechecks actual ownership after callback-triggered unmount and still settles a thrown caller", () => {
  const f = setup(),
    original = event()
  expect(() =>
    receiveNativeFieldKey(f.scope, original, {
      target: 3,
      group: true,
      run: () => {
        f.retire()
        throw new Error("original-caller")
      },
    }),
  ).toThrow("original-caller")
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ current: false, preventDefault: false })
})

it.each([
  [
    "document",
    (data: ReturnType<typeof packet>) => {
      data.identity = { ...data.identity, documentRevision: "7x" }
    },
  ],
  [
    "epoch",
    (data: ReturnType<typeof packet>) => {
      data.identity = { ...data.identity, epoch: 0 }
    },
  ],
  [
    "original instance",
    (data: ReturnType<typeof packet>) => {
      data.identity = { ...data.identity, editorInstance: "" }
    },
  ],
  [
    "token",
    (data: ReturnType<typeof packet>) => {
      data.token = 0
    },
  ],
  [
    "group duplicate",
    (data: ReturnType<typeof packet>) => {
      data.groups = [data.groups[0], data.groups[0], data.groups[1]]
    },
  ],
  [
    "missing physical containment",
    (data: ReturnType<typeof packet>) => {
      Reflect.deleteProperty(data.groups[0], "containsTarget")
    },
  ],
  [
    "invalid physical containment",
    (data: ReturnType<typeof packet>) => {
      Object.assign(data.groups[0], { containsTarget: "false" })
    },
  ],
  [
    "foreign owner",
    (data: ReturnType<typeof packet>) => {
      data.groups = [{ ...data.groups[1], bindingId: "other" }]
    },
  ],
] as const)("rejects invalid native %s evidence", (_, mutate) => {
  const data = packet()
  mutate(data)
  expect(() => decodeNativeFieldInputPacket(JSON.stringify(data))).toThrow()
})

it.each([
  ["ltr", "ArrowLeft", "previous"],
  ["ltr", "ArrowRight", "next"],
  ["rtl", "ArrowLeft", "physical-left"],
  ["rtl", "ArrowRight", "physical-right"],
] as const)("routes the actual %s group %s action before its merged caller", (direction, key, kind) => {
  const f = setup(),
    original = event(packet(), { key, ctrlKey: true, shiftKey: true }),
    trace: string[] = []
  f.native.moveFieldFocus.mockImplementation((encoded) => {
    expect(JSON.parse(encoded).action).toEqual({ groupTarget: 2, kind })
    trace.push("native-focus")
    return JSON.stringify({
      requested: true,
      observed: true,
      current: true,
      target: 13,
      nativeInstance: "component:13",
      editorInstance: "editor:13",
      error: "",
    })
  })
  const handler = nativeFieldGroupKeyHandler(f.scope, {
    direction,
    onKeyDown: (received) => {
      expect(received).toBe(original)
      expect(received.isPropagationStopped()).toBe(true)
      trace.push("same-group-caller")
    },
  })
  expect(handler(original, 3)).toBe(true)
  expect(trace).toEqual(["native-focus", "same-group-caller"])
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ current: true, preventDefault: true })
})

it("retains nested input/outer callbacks from their actual group path and settles at the last ancestor", () => {
  const f = setup(),
    data = packet(),
    trace: string[] = []
  data.groups.push(
    { target: 21, bindingId: "parent", bindingRevision: "parent-revision", scopeTarget: 20, containsTarget: true },
    { target: 20, bindingId: "parent", bindingRevision: "parent-revision", scopeTarget: 20, containsTarget: true },
  )
  const parent = { ...f.scope, bindingId: "parent", bindingRevision: "parent-revision" }
  const original = event(data, { key: "2" })
  for (const [target, scope] of [
    [3, f.scope],
    [2, f.scope],
    [21, parent],
    [20, parent],
  ] as const) {
    nativeFieldGroupKeyHandler(scope, {
      direction: "ltr",
      onKeyDown: (received) => {
        expect(received).toBe(original)
        trace.push(String(target))
      },
    })(original, target)
    if (target !== 20) expect(f.native.settleField).not.toHaveBeenCalled()
  }
  expect(trace).toEqual(["3", "2", "21", "20"])
  expect(f.native.settleField).toHaveBeenCalledTimes(1)
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})

it("routes an admitted ancestor's action through its own scope and refuses cross-scope requests", () => {
  const f = setup(),
    data = packet()
  data.groups.push({
    target: 20,
    bindingId: "parent",
    bindingRevision: "parent-revision",
    scopeTarget: 20,
    containsTarget: true,
  })
  const parent = { ...f.scope, bindingId: "parent", bindingRevision: "parent-revision" }
  const original = event(data)
  expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 20, kind: "next" })).toBeNull()
  expect(moveNativeFieldFocus(parent, original, { groupTarget: 2, kind: "next" })).toBeNull()
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  expect(moveNativeFieldFocus(parent, original, { groupTarget: 20, kind: "previous" })?.observed).toBe(true)
  expect(JSON.parse(f.native.moveFieldFocus.mock.calls[0][0])).toMatchObject({
    identity: data.identity,
    action: { groupTarget: 20, kind: "previous" },
  })
})

it.each(["up", "cancel"])("preserves the original %s caller without starting group navigation", (phase) => {
  const f = setup(),
    data = packet(),
    down = jest.fn(),
    up = jest.fn()
  data.phase = phase
  const original = event(data)
  nativeFieldGroupKeyHandler(f.scope, { direction: "rtl", onKeyDown: down, onKeyUp: up })(original, 2)
  expect(down).not.toHaveBeenCalled()
  expect(up).toHaveBeenCalledWith(original)
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0]).preventDefault).toBe(false)
})

it("retires a group callback when the original focus notification unmounts its owner", () => {
  const f = setup(),
    caller = jest.fn(),
    original = event()
  f.native.moveFieldFocus.mockImplementation(() => {
    f.retire()
    return JSON.stringify({
      requested: true,
      observed: true,
      current: false,
      target: 13,
      nativeInstance: "component:13",
      editorInstance: "editor:13",
      error: "",
    })
  })
  nativeFieldGroupKeyHandler(f.scope, { direction: "ltr", onKeyDown: caller })(original, 3)
  expect(caller).not.toHaveBeenCalled()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ current: false, preventDefault: false })
})

const ownedInput = (kind = "insert", extra: Record<string, unknown> = {}) => {
  const value = { ...packet(), phase: "input" }
  const original = event() as unknown as TNativeFieldOwnedInputEvent
  Object.assign(original.nativeEvent, {
    kind,
    surfaceId: 11,
    windowId: "window:1",
    focused: true,
    active: true,
    fieldDispatch: JSON.stringify(value),
    ...extra,
  })
  return original
}
it.each(["insert", "delete", "marked", "unmark"])(
  "settles original %s input once without inventing a cancellable edit",
  (kind) => {
    const f = setup(),
      original = ownedInput(kind),
      callback = jest.fn(() => {
        expect(activeNativeFieldInputEvent(f.scope)).toBe(original)
        expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "next" })?.observed).toBe(true)
        original.preventDefault()
      })
    expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
    expect(receiveNativeFieldOwnedInput(f.scope, original, callback)).toBe(true)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
    expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({
      phase: "input",
      current: true,
      preventDefault: false,
    })
    expect(receiveNativeFieldOwnedInput(f.scope, original, callback)).toBe(false)
    expect(moveNativeFieldFocus(f.scope, original, { groupTarget: 2, kind: "next" })).toBeNull()
  },
)
it("retains the initiating key during original focus notifications and restores its stack after nested input", () => {
  const f = setup(),
    key = event(),
    input = ownedInput("unmark")
  receiveNativeFieldKey(f.scope, key, {
    target: 10,
    group: false,
    run: () => {
      expect(activeNativeFieldInputEvent(f.scope)).toBe(key)
      receiveNativeFieldOwnedInput(f.scope, input, () => {
        expect(activeNativeFieldInputEvent(f.scope)).toBe(input)
      })
      expect(activeNativeFieldInputEvent(f.scope)).toBe(key)
      f.retire()
      expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
    },
  })
  expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
})
it("reports a throwing original input as retired and releases its active scope", () => {
  const f = setup(),
    original = ownedInput()
  expect(() =>
    receiveNativeFieldOwnedInput(f.scope, original, () => {
      throw new Error("original failure")
    }),
  ).toThrow("original failure")
  expect(activeNativeFieldInputEvent(f.scope)).toBeNull()
  expect(JSON.parse(f.native.settleField.mock.calls[0][0])).toMatchObject({ current: false, preventDefault: false })
})
it.each([
  { kind: "focus" },
  { surfaceId: 12 },
  { windowId: "foreign" },
  { focused: false },
  { active: false },
  { target: 99 },
])("rejects foreign or inactive owned input %j before its original callback", (extra) => {
  const f = setup(),
    callback = jest.fn()
  expect(() => receiveNativeFieldOwnedInput(f.scope, ownedInput("insert", extra), callback)).toThrow(
    "invalid-native-field-input-packet",
  )
  expect(callback).not.toHaveBeenCalled()
  expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
})
it("rejects retired owned input and keeps key receivers out of direct input delivery", () => {
  const f = setup(),
    callback = jest.fn(),
    original = ownedInput()
  expect(
    receiveNativeFieldKey(f.scope, original as unknown as TNativeFieldKeyEvent, {
      target: 10,
      group: false,
      run: callback,
    }),
  ).toBe(false)
  f.retire()
  expect(receiveNativeFieldOwnedInput(f.scope, original, callback)).toBe(false)
  expect(callback).not.toHaveBeenCalled()
})

it.each([true, false])(
  "admits picker Alt+Arrow control only inside the original group while retaining its original caller (contained=%s)",
  (containsTarget) => {
    const f = setup(),
      data = packet(),
      contained = jest.fn((original: TNativeKeyboardEvent) => {
        original.preventDefault()
        original.stopPropagation()
      }),
      caller = jest.fn()
    data.groups.forEach((group) => {
      group.containsTarget = containsTarget
    })
    const original = event(data, { key: "ArrowDown", altKey: true })
    nativeFieldGroupKeyHandler(f.scope, { direction: "ltr", onContainedKeyDown: contained, onKeyDown: caller })(
      original,
      3,
    )
    expect(contained).toHaveBeenCalledTimes(containsTarget ? 1 : 0)
    expect(caller).toHaveBeenCalledWith(original)
    expect(original.isDefaultPrevented()).toBe(containsTarget)
    expect(f.native.moveFieldFocus).not.toHaveBeenCalled()
  },
)
