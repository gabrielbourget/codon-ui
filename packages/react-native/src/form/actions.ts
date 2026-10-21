import type { View } from "react-native"

import FormDocument from "../input/specs/NativeCUIFormDocument"

import { NativeFormController } from "./controller"
import { nativeFormRegistry } from "./registry"

const controller = new NativeFormController(nativeFormRegistry, async (request) => {
  if (!FormDocument) throw new Error("native-form-document-unavailable")
  return FormDocument.getSnapshot(JSON.stringify(request))
})

export const submitNativeForm = (form: View) => controller.request("submit", { origin: "programmatic", form })
export const resetNativeForm = (form: View) => controller.request("reset", { origin: "programmatic", form })
