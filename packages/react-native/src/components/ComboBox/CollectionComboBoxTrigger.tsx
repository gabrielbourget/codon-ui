import { useEffect, useInsertionEffect, useRef, type RefObject } from "react"
import type { ColorValue, TextInput, View } from "react-native"
import Svg, { Polyline } from "react-native-svg"

import { focusNativeTarget } from "../../input/focus"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"

import type { TNativeCollectionComboBoxProps } from "./collectionTypes"
import type { ComboBoxState } from "./state/types"

type TOrigin = "touch" | "mouse" | "pen" | "keyboard" | "virtual"
export const NativeCollectionComboBoxTrigger = <T extends object>({
  owner,
  state,
  input,
  identity,
  foreground,
}: {
  owner: TNativeCollectionComboBoxProps<T>
  state: ComboBoxState<T>
  input: RefObject<TextInput | null>
  identity: string
  foreground: ColorValue
}) => {
  const target = useRef<View>(null)
  const scope = useNativeKeyScope()
  const current = useRef({ owner, state })
  const live = useRef(false)
  const pointer = useRef<{ origin: TOrigin; target: View | null; window: string; suppressed: () => boolean } | null>(
    null,
  )
  const cycle = useRef<{
    origin: TOrigin
    target: View | null
    input: TextInput | null
    window: string
    suppressed: () => boolean
  } | null>(null)
  const windowStamp = () => JSON.stringify(scope?.acknowledgedSession() ?? null)
  useInsertionEffect(() => {
    current.current = { owner, state }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      pointer.current = null
      cycle.current = null
    }
  }, [])
  useEffect(
    () =>
      scope?.subscribe(() => {
        if (scope.isWindowActive() === false) {
          pointer.current = null
          cycle.current = null
        }
      }),
    [scope],
  )
  const origin = (event: TNativePressEvent): TOrigin => {
    if ("kind" in event.nativeEvent) return event.nativeEvent.kind === "keyboard" ? "keyboard" : "virtual"
    return pointer.current?.target === target.current && pointer.current.window === windowStamp()
      ? pointer.current.origin
      : "touch"
  }
  const admitted = () =>
    !!(
      live.current &&
      !current.current.owner.isDisabled &&
      !current.current.owner.isReadOnly &&
      scope?.isWindowActive() !== false &&
      cycle.current?.target &&
      cycle.current.target === target.current &&
      cycle.current.input === input.current &&
      cycle.current.window === windowStamp() &&
      !cycle.current.suppressed()
    )
  const toggle = () => {
    if (!admitted()) return
    const strategy = cycle.current?.origin === "keyboard" || cycle.current?.origin === "virtual" ? "first" : null
    focusNativeTarget(input.current)
    if (admitted()) current.current.state.toggle(strategy, "manual")
  }
  return (
    <NativeButton
      ref={target}
      testID={`${identity}-trigger`}
      accessibilityLabel={owner.triggerLabel ?? "Show suggestions"}
      isDisabled={owner.isDisabled || owner.isReadOnly}
      focusable={false}
      raised={false}
      customStyles={[{ backgroundColor: "transparent" }, owner.customButtonStyles]}
      onPointerDown={(event) => {
        event.persist?.()
        const type = event.nativeEvent.pointerType
        pointer.current = {
          origin: type === "mouse" || type === "pen" ? type : "touch",
          target: target.current,
          window: windowStamp(),
          suppressed: () => event.defaultPrevented || event.isDefaultPrevented?.() === true,
        }
      }}
      onPressStart={(event) => {
        event.persist?.()
        const kind = origin(event),
          source =
            kind !== "keyboard" &&
            kind !== "virtual" &&
            pointer.current?.target === target.current &&
            pointer.current.window === windowStamp()
              ? pointer.current
              : null
        cycle.current = {
          origin: kind,
          target: target.current,
          input: input.current,
          window: windowStamp(),
          suppressed: () =>
            event.defaultPrevented || event.isDefaultPrevented?.() === true || source?.suppressed() === true,
        }
        if (kind !== "touch") toggle()
      }}
      onPressEnd={() => {
        pointer.current = null
      }}
      onPress={() => {
        if (cycle.current?.origin === "touch") toggle()
        cycle.current = null
        pointer.current = null
      }}
    >
      {owner.ComponentIcon ? (
        getNativeButtonContent(owner.ComponentIcon)
      ) : (
        <Svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke={foreground}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Polyline points="6 9 12 15 18 9" />
        </Svg>
      )}
    </NativeButton>
  )
}
