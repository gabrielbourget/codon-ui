import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getSnapshot(request: string): Promise<string>
  getTargetGeometry(request: string): Promise<string>
  getPopFrame(request: string): string
  popPresentation(request: string): string
  getViewportSnapshot(request: string): string
}

export default TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
