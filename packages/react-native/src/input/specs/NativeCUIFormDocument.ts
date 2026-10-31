import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getSnapshot(request: string): Promise<string>
  focusField(request: string): Promise<string>
  bindField(request: string): Promise<string>
  bindFieldInput(request: string): Promise<string>
  unbindFieldInput(request: string): Promise<boolean>
  unbindField(request: string): Promise<boolean>
}

export default TurboModuleRegistry.get<Spec>("CUIFormDocument")
