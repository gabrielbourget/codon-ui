import {
  decodeNativeFieldInputPacket,
  moveNativeFieldFocus,
  nativeFieldGroupKeyHandler,
  receiveNativeFieldKey,
  type TNativeFieldKeyEvent,
} from "../fieldInput"

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
    { target: 3, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2 },
    { target: 2, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2 },
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
    { target: 21, bindingId: "parent", bindingRevision: "parent-revision", scopeTarget: 20 },
    { target: 20, bindingId: "parent", bindingRevision: "parent-revision", scopeTarget: 20 },
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
  data.groups.push({ target: 20, bindingId: "parent", bindingRevision: "parent-revision", scopeTarget: 20 })
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
