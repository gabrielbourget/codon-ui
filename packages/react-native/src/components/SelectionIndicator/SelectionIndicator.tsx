import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { StyleSheet, type TextStyle, type View } from "react-native"

import {
  NativeSelectionIndicatorContext,
  useNativeCollectionRefs,
  useNativeContextProps,
} from "../../collection/context"
import { observeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { getValueTransition, nativeAnimationControls } from "../../motion/animation"
import type { TNativeMotionTarget } from "../../motion/animation/types"
import { useNativeMotionReducedMotion } from "../../motion/config"
import { motionValue } from "../../motion/kernel"
import type { MotionValue } from "../../motion/kernel"
import { NativeMotionOwnerHost } from "../../motion/owner/NativeMotionOwnerHost"
import { animateNativeMotionValue } from "../../motion/value/animateValue"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { useNativeContentContext } from "../NativeContentContext"
import type { TNativeSharedElementSnapshot, TNativeSharedElementWindow } from "../SharedElementTransition/scope"
import { NativeSharedElementTransitionContext } from "../SharedElementTransition/SharedElementTransition"

import { NativeSelectionIndicatorPropsContext } from "./context"
import type { TNativeSelectionIndicatorProps, TNativeSelectionIndicatorRef } from "./types"

const offset = (value: MotionValue<unknown>) => {
  const current = value.get()
  if (typeof current !== "number" || !Number.isFinite(current))
    throw new Error("SelectionIndicator: temporary translation must remain a finite number")
  return current
}
const DEFAULT_PROPERTIES = ["all"] as const
type TPhase = "hidden" | "entering" | "visible" | "exiting"
const originalWindow = (record: TNativeMotionGeometryRecord): TNativeSharedElementWindow => ({
  windowId: record.windowId,
  scopeOwnerId: record.scopeOwnerId,
  epoch: record.epoch,
  rootIdentity: record.snapshot!.rootIdentity,
})
const rectangle = (record: TNativeMotionGeometryRecord) => (record.snapshot!.presentation ?? record.snapshot!.model).box

export const SelectionIndicator = forwardRef<TNativeSelectionIndicatorRef, TNativeSelectionIndicatorProps>(
  (ownProps, forwardedRef) => {
    const scope = useContext(NativeSharedElementTransitionContext)
    if (!scope) throw new Error("SelectionIndicator: SharedElementTransition scope is required")
    const inheritedSelection = useContext(NativeSelectionIndicatorContext).isSelected
    const [props, callerRef] = useNativeContextProps(ownProps, forwardedRef, NativeSelectionIndicatorPropsContext)
    const {
      slot: _slot,
      isSelected = inheritedSelection,
      transitionProperties = DEFAULT_PROPERTIES,
      transition,
      children,
      render,
      customStyles,
      style,
      testID,
      "data-testid": aliasID,
      ...host
    } = props
    const [phase, setPhase] = useState<TPhase>(isSelected ? "visible" : "hidden")
    const [failure, setFailure] = useState<Error | null>(null)
    if (isSelected && phase === "hidden") setPhase("visible")
    const renderState = { isEntering: phase === "entering", isExiting: phase === "exiting" }
    const baseline = resolveNativeStyle(customStyles, "SelectionIndicator", "customStyles")
    const resolved = resolveNativeStyle(
      [baseline, typeof style === "function" ? style({ ...renderState, defaultStyle: baseline }) : style],
      "SelectionIndicator",
      "style",
    )
    const content = typeof children === "function" ? children({ ...renderState, defaultChildren: undefined }) : children
    const theme = useNativeTheme()
    const inheritedContent = useNativeContentContext()
    const foreground = resolved.color ?? inheritedContent?.foregroundColor ?? theme.colors.foreground
    const reduced = useNativeMotionReducedMotion()
    const [controls] = useState(nativeAnimationControls)
    const [foregroundValue] = useState(() => motionValue<unknown>(foreground))
    const [translateX] = useState(() => motionValue<unknown>(0))
    const [translateY] = useState(() => motionValue<unknown>(0))
    const [bindings, setBindings] = useState<Record<string, MotionValue<unknown>>>(() => ({ color: foregroundValue }))
    const ownedBindings = useRef(new Set<MotionValue<unknown>>())
    const restoration = useRef<Record<string, unknown>>({})
    const subscribeX = useCallback((notify: () => void) => translateX.on("change", notify), [translateX])
    const subscribeY = useCallback((notify: () => void) => translateY.on("change", notify), [translateY])
    const offsetX = useSyncExternalStore(
      subscribeX,
      () => offset(translateX),
      () => 0,
    )
    const offsetY = useSyncExternalStore(
      subscribeY,
      () => offset(translateY),
      () => 0,
    )
    const [root, setRoot] = useState<View | null>(null)
    const ref = useNativeCollectionRefs(callerRef, setRoot)
    const geometry = useRef<TNativeMotionGeometryRecord | undefined>(undefined)
    const paint = useRef<Record<string, unknown>>({})
    const owner = useRef(Symbol("selection-indicator"))
    const lifetime = useRef(0)
    const animation = useRef(0)
    const enteringFrame = useRef<number | undefined>(undefined)
    const mounted = useRef(false)
    const initialized = useRef(false)
    const current = useRef({ isSelected, resolved, transitionProperties, transition, reduced, phase })
    useInsertionEffect(() => {
      current.current = { isSelected, resolved, transitionProperties, transition, reduced, phase }
    })
    const updatePaint = useCallback((values: Readonly<Record<string, unknown>>) => {
      paint.current = { ...current.current.resolved, ...values }
    }, [])
    const capture = useCallback(() => {
      const latest = current.current
      if (latest.transitionProperties.includes("none")) return undefined
      const record = geometry.current
      if (!record?.attached || record.error || !record.snapshot || !record.windowId) return undefined
      const values = Object.fromEntries(
        latest.transitionProperties
          .filter((property) => property !== "translate" && property !== "all")
          .map((property) => [property, paint.current[property] ?? latest.resolved[property as keyof TextStyle]])
          .filter(([, value]) => value !== undefined),
      )
      const snapshot: TNativeSharedElementSnapshot = {
        owner: owner.current,
        window: originalWindow(record),
        rectangle: [...rectangle(record)],
        translates: latest.transitionProperties.includes("translate"),
        values,
        consumed: () => {
          if (mounted.current && !current.current.isSelected) {
            animation.current++
            controls.stop()
            translateX.stop()
            translateY.stop()
            setPhase("hidden")
          }
        },
      }
      scope.store(snapshot)
      return snapshot
    }, [scope, controls, translateX, translateY])
    useLayoutEffect(() => {
      mounted.current = true
      const unmountControls = controls.mount()
      return () => {
        if (current.current.isSelected) capture()
        mounted.current = false
        lifetime.current++
        animation.current++
        if (enteringFrame.current !== undefined) cancelAnimationFrame(enteringFrame.current)
        translateX.stop()
        translateY.stop()
        unmountControls()
        foregroundValue.destroy()
        ownedBindings.current.forEach((value) => value.destroy())
        translateX.destroy()
        translateY.destroy()
      }
    }, [controls, foregroundValue, translateX, translateY, capture])
    useLayoutEffect(() => {
      if (!root) return
      const stop = observeNativeMotionGeometry(root, (record) => {
        const previous = geometry.current
        geometry.current = record?.attached && !record.error && record.snapshot ? record : undefined
        if (
          previous &&
          (!geometry.current ||
            JSON.stringify(originalWindow(previous)) !== JSON.stringify(originalWindow(geometry.current)))
        ) {
          lifetime.current++
          animation.current++
          if (enteringFrame.current !== undefined) cancelAnimationFrame(enteringFrame.current)
          enteringFrame.current = undefined
          controls.stop()
          translateX.stop()
          translateY.stop()
          translateX.set(0)
          translateY.set(0)
          scope.withdraw(owner.current)
          restoration.current = {}
          controls.set(target())
          setPhase(current.current.isSelected ? "visible" : "hidden")
        }
      })
      return () => {
        stop()
        geometry.current = undefined
      }
    }, [root, controls, translateX, translateY, scope])
    useLayoutEffect(() => {
      const authored = transitionProperties.includes("none")
        ? []
        : transitionProperties.filter(
            (name) => name !== "all" && name !== "translate" && resolved[name as keyof TextStyle] !== undefined,
          )
      const keys = new Set(["color", ...authored, ...Object.keys(restoration.current)])
      const next = Object.fromEntries(Object.entries(bindings).filter(([name]) => keys.has(name)))
      let changed = Object.keys(next).length !== Object.keys(bindings).length
      for (const name of keys) {
        if (!next[name]) {
          const value = motionValue<unknown>(resolved[name as keyof TextStyle] ?? restoration.current[name])
          next[name] = value
          ownedBindings.current.add(value)
          changed = true
        }
      }
      if (changed) setBindings(next)
      if (!transitionProperties.includes("translate") || transitionProperties.includes("none")) {
        translateX.stop()
        translateY.stop()
        translateX.set(0)
        translateY.set(0)
      }
    }, [bindings, resolved, transitionProperties, translateX, translateY])
    useLayoutEffect(() => {
      if (!transitionProperties.includes("color")) foregroundValue.set(foreground)
    }, [foreground, foregroundValue, transitionProperties])
    useLayoutEffect(() => {
      if (!root) return
      const revision = ++lifetime.current
      const valid = () => mounted.current && lifetime.current === revision
      if (!isSelected) {
        const snapshot = capture()
        void Promise.resolve().then(() => {
          if (!valid()) return
          if (snapshot && scope.peek() !== snapshot) setPhase("hidden")
          else setPhase("exiting")
        })
        return () => {
          lifetime.current++
        }
      }
      scope.withdraw(owner.current)
      void Promise.resolve().then(() => {
        if (!valid()) return
        const pending = scope.peek()
        if (!pending || current.current.transitionProperties.includes("none")) {
          setPhase("entering")
          enteringFrame.current = requestAnimationFrame(() => {
            enteringFrame.current = undefined
            if (valid()) setPhase("visible")
          })
          return
        }
        void readNativeMotionGeometry(root, { isCurrent: valid, onCancel: () => () => {} })
          .then(
            (record) => {
              if (!valid() || !record.attached || record.error || !record.snapshot) return
              geometry.current = record
              const expected = scope.peek()
              if (!expected) return
              const restored = Object.fromEntries(
                Object.keys(expected.values)
                  .filter((name) => current.current.resolved[name as keyof TextStyle] != null)
                  .map((name) => [name, current.current.resolved[name as keyof TextStyle]]),
              )
              if (!valid() || scope.peek() !== expected) return
              const previous = scope.take(originalWindow(record))
              initialized.current = true
              if (!previous) return
              restoration.current = restored
              const from: Record<string, unknown> = Object.fromEntries(
                Object.keys(restored).map((name) => [name, previous.values[name]]),
              )
              if (previous.translates && current.current.transitionProperties.includes("translate")) {
                const next = rectangle(record)
                translateX.set(previous.rectangle[0]! - next[0]!)
                translateY.set(previous.rectangle[1]! - next[1]!)
              }
              controls.stop()
              controls.set(from as TNativeMotionTarget)
              setBindings((existing) => {
                const next = { ...existing }
                for (const [name, value] of Object.entries(from)) {
                  if (name === "color") continue
                  const binding = motionValue(value)
                  ownedBindings.current.add(binding)
                  next[name] = binding
                }
                return next
              })
              enteringFrame.current = requestAnimationFrame(() => {
                enteringFrame.current = undefined
                if (valid()) setPhase("visible")
                if (valid()) void play()
              })
            },
            (error: unknown) => {
              if (valid()) setFailure(error instanceof Error ? error : new Error(String(error)))
            },
          )
          .catch((error: unknown) => {
            if (valid()) setFailure(error instanceof Error ? error : new Error(String(error)))
          })
      })
      return () => {
        lifetime.current++
        if (current.current.isSelected) capture()
        if (enteringFrame.current !== undefined) cancelAnimationFrame(enteringFrame.current)
        enteringFrame.current = undefined
      }
    }, [isSelected, root, scope, controls, capture])
    const target = () => {
      const latest = current.current
      if (latest.transitionProperties.includes("none")) return {}
      const values: Record<string, unknown> = Object.fromEntries(
        latest.transitionProperties
          .filter((property) => property !== "all" && property !== "translate")
          .map((property) => [property, latest.resolved[property as keyof TextStyle]])
          .filter(([, value]) => value !== undefined),
      )
      return { ...restoration.current, ...values } as TNativeMotionTarget
    }
    const currentTransition = () => {
      const authored = current.current.transition
      const timing = { duration: authored?.type === "spring" ? undefined : 0, ...authored }
      return {
        ...timing,
        ...(current.current.reduced ? { duration: 0, delay: 0, type: false as const } : {}),
        ...Object.fromEntries(
          Object.keys(restoration.current)
            .filter((name) => !current.current.transitionProperties.includes(name as keyof TextStyle))
            .map((name) => [name, { duration: 0 }]),
        ),
        ...(current.current.reduced
          ? Object.fromEntries(
              [...Object.keys(target()), "x", "y"].map((name) => [
                name,
                {
                  ...getValueTransition(timing, name),
                  duration: 0,
                  delay: 0,
                  type: false as const,
                  repeat: 0,
                  repeatDelay: 0,
                },
              ]),
            )
          : {}),
      }
    }
    const play = () => {
      const revision = ++animation.current
      controls.stop()
      translateX.stop()
      translateY.stop()
      const currentGeometry = geometry.current
      const valid = () =>
        mounted.current &&
        animation.current === revision &&
        (!currentGeometry ||
          (geometry.current?.windowId === currentGeometry.windowId &&
            geometry.current?.epoch === currentGeometry.epoch))
      const context = {
        isCurrent: valid,
        shouldSkipAnimations: current.current.reduced,
        readValue: () => {
          throw new Error("SelectionIndicator: temporary translation must have an explicit initial value")
        },
      }
      const playback: Promise<unknown>[] = [controls.start(target(), currentTransition())]
      if (translateX.get() !== 0)
        playback.push(translateX.start(animateNativeMotionValue("x", translateX, 0, currentTransition(), context)))
      if (translateY.get() !== 0)
        playback.push(translateY.start(animateNativeMotionValue("y", translateY, 0, currentTransition(), context)))
      return Promise.all(playback).then(() => {
        if (valid() && Object.keys(restoration.current).length) {
          restoration.current = {}
          setBindings((existing) =>
            Object.fromEntries(
              Object.entries(existing).filter(
                ([name]) =>
                  name === "color" ||
                  (current.current.transitionProperties.includes(name as keyof TextStyle) &&
                    current.current.resolved[name as keyof TextStyle] !== undefined),
              ),
            ),
          )
        }
        if (valid() && !current.current.isSelected && current.current.phase === "exiting") {
          scope.withdraw(owner.current)
          setPhase("hidden")
        }
      })
    }
    const signature = JSON.stringify([phase, resolved, transitionProperties, transition, reduced])
    useLayoutEffect(() => {
      if (!root || phase === "hidden") return
      if (phase === "entering") {
        initialized.current = true
        controls.stop()
        controls.set(target())
      } else if (initialized.current) void play()
    }, [root, phase, signature, controls])
    if (failure) throw failure
    if (phase === "hidden") return null
    return (
      <NativeMotionOwnerHost
        {...host}
        ref={ref}
        testID={testID ?? aliasID ?? "selection-indicator"}
        style={resolved}
        values={bindings}
        motion={{ initial: false, animate: controls }}
        nativeRender={(nativeProps) => {
          if (phase === "entering") nativeProps = { ...nativeProps, style: [nativeProps.style, resolved] }
          const nativeStyle = StyleSheet.flatten(nativeProps.style) ?? {}
          const originalProps = transitionProperties.includes("translate")
            ? {
                ...nativeProps,
                style: [
                  nativeProps.style,
                  {
                    transform: [
                      { translateX: offsetX },
                      { translateY: offsetY },
                      ...((nativeStyle.transform as []) ?? []),
                    ],
                  },
                ],
              }
            : nativeProps
          return render ? render(originalProps, renderState) : <NativeFocusHost {...originalProps} />
        }}
        onUpdate={updatePaint}
      >
        {content}
      </NativeMotionOwnerHost>
    )
  },
)
SelectionIndicator.displayName = "SelectionIndicator"
