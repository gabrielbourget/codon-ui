import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getLease(): string
  settle(request: string): boolean
}

export default TurboModuleRegistry.get<Spec>("CUIEditorKeyboardDefaults")
