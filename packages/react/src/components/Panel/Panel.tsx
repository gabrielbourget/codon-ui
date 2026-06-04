"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, type FC, type PropsWithChildren } from "react"
import { Modal, ModalOverlay } from "react-aria-components"

import { DEFAULT_MICROANIMATION_DURATION } from "../../tokens/motion"

import type { TPanelProps } from "./helpers"
import { calibrateComponent } from "./helpers"

const MotionModal = motion.create(Modal)
const MotionModalOverlay = motion.create(ModalOverlay)

const Panel: FC<PropsWithChildren<TPanelProps>> & { handleClickOutside?: () => unknown } = (props) => {
  const {
    "data-testid": dataTestID,
    children,
    isOpen,
    onOpenChange,
    isDismissable,
    isKeyboardDismissDisabled,
    customOverlayStyles,
  } = props

  const { customStyles, panelAnimationX, panelStyles, overlayStyles } = calibrateComponent(props)
  const resolvedPanelOpen = isOpen ?? false
  const resolvedOnOpenChange = useMemo(() => onOpenChange ?? (() => undefined), [onOpenChange])
  const resolvedIsDismissable = isDismissable ?? true
  const resolvedIsKeyboardDismissDisabled = isKeyboardDismissDisabled ?? false

  useEffect(() => {
    if (!resolvedPanelOpen || resolvedIsKeyboardDismissDisabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      event.stopPropagation()
      resolvedOnOpenChange(false)
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [resolvedIsKeyboardDismissDisabled, resolvedOnOpenChange, resolvedPanelOpen])

  return (
    <AnimatePresence>
      {resolvedPanelOpen && (
        <MotionModalOverlay
          isOpen={resolvedPanelOpen}
          onOpenChange={resolvedOnOpenChange}
          className={overlayStyles}
          style={customOverlayStyles}
          onPointerDown={(event) => {
            if (!resolvedIsDismissable || event.target !== event.currentTarget) return

            resolvedOnOpenChange(false)
          }}
        >
          <MotionModal
            className={panelStyles}
            data-testid={dataTestID ?? "panel"}
            isDismissable={resolvedIsDismissable}
            isKeyboardDismissDisabled={resolvedIsKeyboardDismissDisabled}
            style={customStyles}
            initial={{ transform: `translateX(${panelAnimationX})` }}
            animate={{ transform: "translateX(0)" }}
            exit={{ transform: `translateX(${panelAnimationX})` }}
            transition={{ ease: "easeInOut", duration: DEFAULT_MICROANIMATION_DURATION }}
          >
            {children}
          </MotionModal>
        </MotionModalOverlay>
      )}
    </AnimatePresence>
  )
}

export default Panel
