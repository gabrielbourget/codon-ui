import type { EmblaCarouselType } from "./EmblaCarousel"
import type { CreateOptionsType, LooseOptionsType } from "./Options"
import type { OptionsHandlerType } from "./OptionsHandler"

export type LoosePluginType = Record<string, unknown>
export type CreatePluginType<A extends LoosePluginType, B extends LooseOptionsType> = A & {
  name: string
  options: Partial<CreateOptionsType<B>>
  init: (api: EmblaCarouselType, options: OptionsHandlerType) => void
  destroy: () => void
}
export type EmblaPluginsType = Record<string, CreatePluginType<LoosePluginType, Record<never, never>>>
export type EmblaPluginType = EmblaPluginsType[string]
