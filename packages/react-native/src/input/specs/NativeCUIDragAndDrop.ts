import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
  getLease(): string
  readItems(request: string): Promise<string>
  adoptItems(request: string): boolean
  readText(request: string): Promise<string>
  readFile(request: string): Promise<string>
  adoptFile(request: string): boolean
  readDirectory(request: string): Promise<string>
  closeDirectory(request: string): void
  releaseData(request: string): void
}

export default TurboModuleRegistry.get<Spec>("CUIDragAndDrop")
