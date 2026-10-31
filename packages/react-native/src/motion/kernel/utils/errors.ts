// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
import { formatErrorMessage } from "./format-error-message"

export type DevMessage = (check: boolean, message: string, errorCode?: string) => void

let warning: DevMessage = () => {}
let invariant: DevMessage = () => {}

if (__DEV__) {
  warning = (check, message, errorCode) => {
    if (!check && typeof console !== "undefined") {
      console.warn(formatErrorMessage(message, errorCode))
    }
  }

  invariant = (check, message, errorCode) => {
    if (!check) {
      throw new Error(formatErrorMessage(message, errorCode))
    }
  }
}

export { invariant, warning }
