import type { View } from "react-native"

import { NativeFormController } from "./controller"
import { nativeFormRegistry, type NativeFormRegistry } from "./registry"
import { readNativeFormDocument } from "./runtime"

const controllers = new WeakMap<NativeFormRegistry, NativeFormController>()
export const nativeFormControllerFor = (registry: NativeFormRegistry) => {
  let controller = controllers.get(registry)
  if (!controller) {
    controller = new NativeFormController(registry, readNativeFormDocument)
    controllers.set(registry, controller)
  }
  return controller
}

export const submitNativeForm = (form: View) =>
  nativeFormControllerFor(nativeFormRegistry).request("submit", { origin: "programmatic", form })
export const resetNativeForm = (form: View) =>
  nativeFormControllerFor(nativeFormRegistry).request("reset", { origin: "programmatic", form })
