import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getLease(): string
  settle(request: string): boolean
  settleField(request: string): boolean
  acceptsField(request: string): boolean
  moveFieldFocus(request: string): string
}

export default TurboModuleRegistry.get<Spec>("CUIEditorKeyboardDefaults")
