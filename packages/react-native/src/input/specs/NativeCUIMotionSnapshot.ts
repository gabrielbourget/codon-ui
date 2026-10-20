import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getSnapshot(request: string): Promise<string>
  getTargetGeometry(request: string): Promise<string>
}

export default TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
