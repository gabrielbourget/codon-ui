import type { TNativeCarouselWindow } from "./nativeEnvironment"
import type { CreateOptionsType, LooseOptionsType } from "./Options"
import { objectsMergeDeep } from "./utils"

type TOptions = Partial<CreateOptionsType<LooseOptionsType>>
export type OptionsHandlerType = {
  mergeOptions: <A extends TOptions, B extends TOptions>(first: A, second?: B) => A
  optionsAtMedia: <T extends TOptions>(options: T) => T
  optionsMediaQueries: (
    options: TOptions[],
  ) => readonly { matches: () => boolean; subscribe: (receive: () => void) => () => void }[]
}
export const OptionsHandler = (window: TNativeCarouselWindow): OptionsHandlerType => {
  const mergeOptions: OptionsHandlerType["mergeOptions"] = (first, second) =>
    objectsMergeDeep(first, second ?? {}) as typeof first
  return {
    mergeOptions,
    optionsAtMedia: (options) =>
      Object.values(options.breakpoints ?? {})
        .filter((entry) => entry.when(window.state()))
        .reduce((current, entry) => mergeOptions(current, entry.options), options),
    optionsMediaQueries: (options) =>
      options
        .flatMap((entry) => Object.values(entry.breakpoints ?? {}))
        .map((entry) => ({
          matches: () => entry.when(window.state()),
          subscribe: (receive) => {
            let previous = entry.when(window.state())
            return window.events.subscribe("window", () => {
              const next = entry.when(window.state())
              if (next !== previous) {
                previous = next
                receive()
              }
            })
          },
        })),
  }
}
