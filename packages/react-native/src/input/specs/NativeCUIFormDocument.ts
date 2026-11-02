import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  admitForm(request: string): Promise<string>
  readFocusParticipants(request: string): Promise<string>
  focusField(request: string): Promise<string>
  bindField(request: string): Promise<string>
  unbindField(request: string): Promise<boolean>
}

export default TurboModuleRegistry.get<Spec>("CUIFormDocument")
