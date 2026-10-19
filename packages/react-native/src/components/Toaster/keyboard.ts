import type { TNativeObservedKeyData } from "../../input/keyboardObservation"

const truthyMethods = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  "composedPath",
  "getModifierState",
  "initEvent",
  "initUIEvent",
  "initKeyboardEvent",
  "preventDefault",
  "stopPropagation",
  "stopImmediatePropagation",
])
const propertyValue = (name: string, data: TNativeObservedKeyData): unknown => {
  if (truthyMethods.has(name)) return true
  switch (name) {
    case "key":
      return data.key
    case "code":
      return data.code
    case "location":
      return data.location
    case "repeat":
      return data.repeat
    case "isComposing":
      return data.isComposing
    case "altKey":
      return data.altKey
    case "ctrlKey":
      return data.ctrlKey
    case "metaKey":
      return data.metaKey
    case "shiftKey":
      return data.shiftKey
    case "defaultPrevented":
      return data.defaultCaptured
    case "returnValue":
      return !data.defaultCaptured
    case "keyCode":
    case "which":
      return data.legacyKeyCode
    case "charCode":
    case "detail":
      return 0
    case "eventPhase":
      return 3
    case "timeStamp":
      return data.timestamp
    case "type":
      return "keydown"
    case "bubbles":
    case "cancelable":
    case "composed":
    case "isTrusted":
      return true
    case "target":
    case "srcElement":
    case "currentTarget":
      return data.target !== 0 && data.target !== -1
    case "view":
      return data.windowId.length > 0
    case "cancelBubble":
      return false
    default:
      return undefined
  }
}

export const matchesNativeToastObservedHotkey = (data: TNativeObservedKeyData, keys: readonly string[]) =>
  keys.every((key) => Boolean(propertyValue(key, data)) || data.code === key)
