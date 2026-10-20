import { SubscriptionManager } from "../kernel/utils/subscription-manager"

import type { TNativeMotionLayoutProps } from "./layoutTypes"
import type { Box } from "./types"

type TCallbacks = Pick<TNativeMotionLayoutProps, "onBeforeLayoutMeasure" | "onLayoutMeasure">

// Pinned VisualElement uses SubscriptionManager's three argument slots even when boxes are absent.
export class NativeMotionLayoutCallbacks {
  private readonly before = new SubscriptionManager<NonNullable<TCallbacks["onBeforeLayoutMeasure"]>>()
  private readonly measure = new SubscriptionManager<NonNullable<TCallbacks["onLayoutMeasure"]>>()
  private releaseBefore?: () => void
  private releaseMeasure?: () => void

  update = (props: TCallbacks) => {
    this.clear()
    if (props.onBeforeLayoutMeasure) this.releaseBefore = this.before.add(props.onBeforeLayoutMeasure)
    if (props.onLayoutMeasure) this.releaseMeasure = this.measure.add(props.onLayoutMeasure)
  }

  notify = (event: string, ...args: unknown[]) => {
    if (event === "BeforeLayoutMeasure") this.before.notify()
    if (event === "LayoutMeasure") this.measure.notify(args[0] as Box, args[1] as Box)
  }

  clear = () => {
    this.releaseBefore?.()
    this.releaseMeasure?.()
    this.releaseBefore = undefined
    this.releaseMeasure = undefined
  }
}
