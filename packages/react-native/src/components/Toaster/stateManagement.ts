import { validateNativeToast } from "./model"
import type { TNativeExternalToast, TNativeToast, TNativeToastID, TNativeToastPublication } from "./types"

export const createNativeToasterObserver = () => {
  const subscribers = new Set<(publication: TNativeToastPublication) => void>()
  let toasts: TNativeToast[] = []
  let counter = 1
  const publish = (publication: TNativeToastPublication) => {
    for (const subscriber of [...subscribers]) subscriber(publication)
  }
  return {
    subscribe: (subscriber: (publication: TNativeToastPublication) => void) => {
      subscribers.add(subscriber)
      return () => {
        subscribers.delete(subscriber)
      }
    },
    snapshot: () => [...toasts],
    addToast: (data: TNativeToast) => {
      validateNativeToast(data)
      publish(data)
      const index = toasts.findIndex((toast) => toast.id === data.id)
      toasts =
        index < 0
          ? [...toasts, data]
          : toasts.map((toast, current) => (current === index ? { ...toast, ...data } : toast))
    },
    nextID: () => {
      while (toasts.some((toast) => toast.id === counter)) counter++
      return counter++
    },
    dismiss: (id?: TNativeToastID | null) => {
      const dismissed = id == null ? toasts : [{ id }]
      for (const toast of dismissed) publish({ id: toast.id, dismiss: true })
      toasts = id == null ? [] : toasts.filter((toast) => toast.id !== id)
      return id
    },
  }
}

export const ToasterObserver = createNativeToasterObserver()
export const toast = (data?: TNativeExternalToast) => {
  const id = data?.id ?? ToasterObserver.nextID()
  ToasterObserver.addToast({ ...data, id })
  return id
}
