import type { TNativeCardProps } from "../../../../packages/react-native/dist/components/Card/types"
import type { Box } from "../../../../packages/react-native/dist/motion/projection/types"
import type { TCardProps } from "../../../../packages/react/src/components/Card/helpers"

type TCallbacks<T> = Pick<T, Extract<keyof T, "onBeforeLayoutMeasure" | "onLayoutMeasure">>
const before = (box: Box) => void box.x.min
const measure = (box: Box, previous: Box) => void [box.y.max, previous.x.min]

export const canonical: TCallbacks<TCardProps> = { onBeforeLayoutMeasure: before, onLayoutMeasure: measure }
export const native: TCallbacks<TNativeCardProps> = canonical
export const roundTrip: TCallbacks<TCardProps> = native
export const nativeRequiredArguments: TCallbacks<TNativeCardProps> = {
  onBeforeLayoutMeasure: before,
  onLayoutMeasure: measure,
}
// @ts-expect-error Source/native callbacks receive boxes, not a DOM event.
export const invalidEvent: TCallbacks<TNativeCardProps> = { onBeforeLayoutMeasure: (_event: Event) => {} }
// @ts-expect-error Source/native layout callbacks do not receive scalar bounds.
export const invalidScalar: TCallbacks<TNativeCardProps> = { onLayoutMeasure: (_box: number, _previous: number) => {} }
