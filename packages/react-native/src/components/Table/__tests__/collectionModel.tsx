import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useState, type ReactElement } from "react"
import type * as RN from "react-native"

import {
  NativeCollectionActionAdmissionContext,
  type TNativeCollectionActionAdmission,
} from "../../../collection/actions"
import type { TNativeCollectionActionScope } from "../../../collection/model"

export { screen, userEvent } from "@testing-library/react-native"

type TOwner = {
  ownerId: string
  generation: string
  revision: string
  items: { itemId: string; itemRevision: string }[]
}
let restoreFindNodeHandle: (() => void) | undefined
beforeEach(() => {
  const native = jest.requireActual<typeof RN>("react-native")
  const original = native.findNodeHandle
  const spy = jest.spyOn(native, "findNodeHandle").mockImplementation(original)
  restoreFindNodeHandle = () => spy.mockRestore()
})
afterEach(() => restoreFindNodeHandle?.())
const queues = new Map<() => void, { binding: string; visibleTarget: number }>()
export const pendingCollectionActions = () => [...queues.values()]
// Explicit source-only admission model. It exercises committed logical membership,
// visible bindings and retirement; it does not prove native hierarchy/window/tag identity.
export const createTableModelAdmission = (): TNativeCollectionActionAdmission => {
  const owners = new Map<string, { data: TOwner; original: object; lifetime: string }>()
  const listeners = new Set<() => void>()
  let version = 0
  const notify = () => {
    version++
    for (const listener of listeners) listener()
  }
  const scopeCurrent = (scope: TNativeCollectionActionScope) => {
    const owner = owners.get(scope.ownerId)
    return owner &&
      owner.data.generation === scope.generation &&
      owner.data.revision === scope.revision &&
      (!scope.itemId ||
        owner.data.items.some((item) => item.itemId === scope.itemId && item.itemRevision === scope.itemRevision))
      ? owner
      : undefined
  }
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: (binding, original) => {
      const data = JSON.parse(binding) as TOwner
      const owner = { data, original, lifetime: `${data.ownerId}:${data.generation}:source-window:${++version}` }
      owners.set(data.ownerId, owner)
      notify()
      return () => {
        if (owners.get(data.ownerId) === owner) {
          owners.delete(data.ownerId)
          notify()
        }
      }
    },
    ownerLifetimeFor: (ownerId, generation) => {
      const owner = owners.get(ownerId)
      return owner && owner.data.generation === generation ? owner.lifetime : ""
    },
    bindingFor: (scope) => {
      const owner = scopeCurrent(scope)
      return owner ? JSON.stringify({ ...scope, lifetime: owner.lifetime }) : ""
    },
    request: (scope, binding, target, receive) => {
      const ack = () => {
        queues.delete(ack)
        const visible = screen.container.queryAll((host) => host.props.nativeCollectionBinding === binding).length > 0
        receive(target > 0 && visible && !!scopeCurrent(scope) && admission.bindingFor(scope) === binding)
      }
      queues.set(ack, { binding, visibleTarget: target })
      return () => {
        queues.delete(ack)
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => version,
  }
  return admission
}
const Admission = ({ children }: { children: React.ReactNode }) => {
  const [admission] = useState(createTableModelAdmission)
  return (
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      {children}
    </NativeCollectionActionAdmissionContext.Provider>
  )
}
afterEach(() => queues.clear())
export const flushNativeCollectionActions = async () => {
  const pending = [...queues.keys()]
  await act(() => pending.forEach((ack) => ack()))
  return pending.length
}
export const actWithNativeCollections = async <T,>(callback: () => T | Promise<T>): Promise<T> => {
  const result = await act(callback)
  for (let turn = 0; turn < 8; turn++) if (!(await flushNativeCollectionActions())) return result
  throw new Error("Synthetic visible-owner actions did not settle")
}
export const fireEventWithNativeCollections: typeof fireEvent = Object.assign(
  (...args: Parameters<typeof fireEvent>) => actWithNativeCollections(() => fireEvent(...args)),
  {
    press: (...args: Parameters<typeof fireEvent.press>) => actWithNativeCollections(() => fireEvent.press(...args)),
    changeText: (...args: Parameters<typeof fireEvent.changeText>) =>
      actWithNativeCollections(() => fireEvent.changeText(...args)),
    scroll: (...args: Parameters<typeof fireEvent.scroll>) => actWithNativeCollections(() => fireEvent.scroll(...args)),
  },
)
export const rerenderWithNativeCollections = (...args: Parameters<typeof screen.rerender>) =>
  actWithNativeCollections(() => screen.rerender(...args))
export const renderWithNativeCollections: typeof render = (element: ReactElement, options) => {
  const Wrapper = options?.wrapper
  return render(element, {
    ...options,
    wrapper: ({ children }) => <Admission>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</Admission>,
  })
}
