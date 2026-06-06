import type { TToastToDismiss } from "./helpers"
import type { TToast } from "./Toast/helpers"

let toastsCounter = 1

class Observer {
  subscribers: Array<(toast: TToast | TToastToDismiss) => void>
  toasts: Array<TToast | TToastToDismiss>

  constructor() {
    this.subscribers = []
    this.toasts = []
  }

  // -> Subscribers are the mounted Toaster roots. The observer stays UI-agnostic
  // -> and only publishes toast payloads or dismiss instructions.
  subscribe = (subscriber: (toast: TToast | TToastToDismiss) => void) => {
    this.subscribers.push(subscriber)

    return () => {
      const index = this.subscribers.indexOf(subscriber)
      if (index !== -1) this.subscribers.splice(index, 1)
    }
  }

  publish = (data: TToast) => {
    this.subscribers.forEach((subscriber) => subscriber(data))
  }

  // -> The queue mirrors the latest toast payload per id so dismiss-all can
  // -> target the currently known toasts. The rendered Toaster state remains
  // -> the source of truth for animation and removal timing.
  addToast = (data: TToast) => {
    this.publish(data)
    const indexOfExistingToast = this.toasts.findIndex((toast) => toast.id === data.id)

    if (indexOfExistingToast === -1) {
      this.toasts = [...this.toasts, data]
      return
    }

    this.toasts = [
      ...this.toasts.slice(0, indexOfExistingToast),
      { ...this.toasts[indexOfExistingToast], ...data },
      ...this.toasts.slice(indexOfExistingToast + 1),
    ]
  }

  // -> Dismiss sends instructions through the same subscriber channel instead
  // -> of mutating rendered state directly, which keeps exit animations inside
  // -> the Toast/Toaster components.
  dismiss = (id?: number | string) => {
    if (id === undefined || id === null) {
      this.toasts.forEach((toast) => {
        this.subscribers.forEach((subscriber) => subscriber({ id: toast.id, dismiss: true }))
      })
      this.toasts = []
      return id
    }

    this.subscribers.forEach((subscriber) => subscriber({ id, dismiss: true }))
    this.toasts = this.toasts.filter((toast) => toast.id !== id)
    return id
  }
}

export type ExternalToast = Omit<TToast, "id"> & {
  id?: number | string
}

export const ToasterObserver = new Observer()

// bind this to the toast function
const toastFunction = (data?: ExternalToast) => {
  const id = data?.id || toastsCounter++

  ToasterObserver.addToast({ ...data, id })
  return id
}

export const toast = toastFunction
