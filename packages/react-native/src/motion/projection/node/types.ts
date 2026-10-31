import type { NodeStack } from "../shared/stack"
import type {
  Box,
  Delta,
  Point,
  Process,
  JSAnimation,
  NativeProjectionInstance,
  NativeProjectionStyle,
  ResolvedValues,
  MotionStyle,
  Transition,
  ValueTransition,
  VisualElement,
  MotionPath,
} from "../types"
import type { FlatTree } from "../utils/flat-tree"
export interface Measurements {
  animationId: number
  measuredBox: Box
  layoutBox: Box
  latestValues: ResolvedValues
  source: number
}
export type Phase = "snapshot" | "measure"
export interface ScrollMeasurements {
  animationId: number
  phase: Phase
  offset: Point
  isRoot: boolean
  wasRoot: boolean
}
export type LayoutEvents =
  | "willUpdate"
  | "didUpdate"
  | "beforeMeasure"
  | "measure"
  | "projectionUpdate"
  | "animationStart"
  | "animationComplete"
export interface IProjectionNode<I extends NativeProjectionInstance = NativeProjectionInstance> {
  linkedParentVersion: number
  layoutVersion: number
  id: number
  animationId: number
  animationCommitId: number
  parent?: IProjectionNode
  relativeParent?: IProjectionNode
  root?: IProjectionNode
  children: Set<IProjectionNode>
  path: IProjectionNode[]
  nodes?: FlatTree
  depth: number
  instance: I | undefined
  mount: (node: I, isLayoutDirty?: boolean) => void
  unmount: () => void
  options: ProjectionNodeOptions
  setOptions(options: ProjectionNodeOptions): void
  layout?: Measurements
  snapshot?: Measurements
  target?: Box
  relativeTarget?: Box
  relativeTargetOrigin?: Box
  targetDelta?: Delta
  targetWithTransforms?: Box
  scroll?: ScrollMeasurements
  treeScale?: Point
  projectionDelta?: Delta
  projectionDeltaWithTransform?: Delta
  latestValues: ResolvedValues
  isLayoutDirty: boolean
  isProjectionDirty: boolean
  isSharedProjectionDirty: boolean
  isTransformDirty: boolean
  resolvedRelativeTargetAt?: number
  shouldResetTransform: boolean
  prevTransformTemplateValue: undefined
  isUpdateBlocked(): boolean
  updateManuallyBlocked: boolean
  updateBlockedByResize: boolean
  blockUpdate(): void
  unblockUpdate(): void
  isUpdating: boolean
  needsReset: boolean
  startUpdate(): void
  willUpdate(notifyListeners?: boolean): void
  didUpdate(): void
  update(): void
  measure(removeTransform?: boolean): Measurements
  measurePageBox(): Box
  updateLayout(): void
  updateSnapshot(): void
  clearSnapshot(): void
  updateScroll(phase?: Phase): void
  scheduleUpdateProjection(): void
  scheduleCheckAfterUnmount(): void
  checkUpdateFailed(): void
  sharedNodes: Map<string, NodeStack>
  registerSharedNode(id: string, node: IProjectionNode): void
  getStack(): NodeStack | undefined
  isVisible: boolean
  hide(): void
  show(): void
  scheduleRender(notifyAll?: boolean): void
  getClosestProjectingParent(): IProjectionNode | undefined
  setTargetDelta(delta: Delta): void
  resetTransform(): void
  resetSkewAndRotation(): void
  applyTransform(box: Box, transformOnly?: boolean, output?: Box): Box
  resolveTargetDelta(force?: boolean): void
  calcProjection(): void
  applyProjectionStyles(targetStyle: NativeProjectionStyle, styleProp?: MotionStyle): void
  clearMeasurements(): void
  resetTree(): void
  isProjecting(): boolean
  animationValues?: ResolvedValues
  currentAnimation?: JSAnimation<number>
  pendingAnimation?: Process
  isTreeAnimating?: boolean
  isAnimationBlocked?: boolean
  isTreeAnimationBlocked: () => boolean
  setAnimationOrigin(delta: Delta, hasOnlyRelativeTargetChanged?: boolean, pathFn?: MotionPath): void
  startAnimation(transition: ValueTransition): void
  finishAnimation(): void
  hasCheckedOptimisedAppear: boolean
  isLead(): boolean
  getLead(): IProjectionNode
  applyTransformsToTarget(): void
  promote(options?: { needsReset?: boolean; transition?: Transition; preserveFollowOpacity?: boolean }): void
  relegate(): boolean
  resumeFrom?: IProjectionNode
  resumingFrom?: IProjectionNode
  isPresent?: boolean
  addEventListener<N extends LayoutEvents>(
    name: N,
    handler: (...args: NativeProjectionEventArgs[N]) => void,
  ): () => void
  notifyListeners<N extends LayoutEvents>(name: N, ...args: NativeProjectionEventArgs[N]): void
  hasListeners(name: LayoutEvents): boolean
  hasTreeAnimated: boolean
  preserveOpacity?: boolean
}
export interface LayoutUpdateData {
  layout: Box
  snapshot: Measurements
  delta: Delta
  layoutDelta: Delta
  hasLayoutChanged: boolean
  hasRelativeLayoutChanged: boolean
}
export type LayoutUpdateHandler = (data: LayoutUpdateData) => void
export interface ProjectionNodeConfig<I extends NativeProjectionInstance> {
  defaultParent?: () => IProjectionNode
  attachResizeListener?: (instance: I, notifyResize: () => void) => () => void
  measureScroll: (instance: I) => Point
  checkIsScrollRoot: (instance: I) => boolean
}
/**
 * Configuration for initial promotion of shared layout elements.
 * This was originally in React's SwitchLayoutGroupContext but is now
 * framework-agnostic to support vanilla JS usage.
 */
export interface InitialPromotionConfig {
  /**
   * The initial transition to use when the elements in this group mount (and automatically promoted).
   * Subsequent updates should provide a transition in the promote method.
   */
  transition?: Transition
  /**
   * If the follow tree should preserve its opacity when the lead is promoted on mount
   */
  shouldPreserveFollowOpacity?: (member: IProjectionNode) => boolean
}
export interface ProjectionNodeOptions {
  animate?: boolean
  layoutScroll?: boolean
  layoutRoot?: boolean
  alwaysMeasureLayout?: boolean
  onExitComplete?: () => void
  animationType?: "size" | "position" | "both" | "preserve-aspect" | "x" | "y"
  layoutId?: string
  layout?: boolean | string
  visualElement?: VisualElement
  crossfade?: boolean
  transition?: Transition
  initialPromotionConfig?: InitialPromotionConfig
  layoutDependency?: unknown
  layoutAnchor?: Point | false
}

export type NativeProjectionEventArgs = {
  willUpdate: []
  didUpdate: [LayoutUpdateData]
  beforeMeasure: []
  measure: [Box]
  projectionUpdate: [Box]
  animationStart: []
  animationComplete: []
}
