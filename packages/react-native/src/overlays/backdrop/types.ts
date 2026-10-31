import type { ComponentType, RefAttributes, RefObject } from "react"
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native"

export type TNativeBackdropLease = Readonly<{
  /** Logical effect ownership, never an invented native window identifier. */
  ownerId: string
  generation: number
  isCurrent: () => boolean
}>
export type TNativeBackdropEffectProps = Readonly<{
  /** The retained parent window, excluding this effect's own native window. */
  targetRef: RefObject<View | null>
  /** Blur radius in native logical units; adapters own physical pixel conversion. */
  radius: number
  style: StyleProp<ViewStyle>
  /** Stop capture and retain the last complete output while paused. */
  isPaused: boolean
  /** Check before starting work and immediately before publishing asynchronous output. */
  lease: TNativeBackdropLease
}>
export type TNativeBackdropAdapter = Readonly<{
  /** Must forward a real native View ref and all supplied native view props. */
  Target: ComponentType<ViewProps & RefAttributes<View>>
  /** Must produce real backdrop blur, without an implicit color/tint fallback. */
  Effect: ComponentType<TNativeBackdropEffectProps>
}>
export type TNativeBackdropHostProps = ViewProps

export type TNativeBackdropSource = Readonly<{
  targetRef: RefObject<View | null>
  generation: number
  isCurrent: () => boolean
}>
