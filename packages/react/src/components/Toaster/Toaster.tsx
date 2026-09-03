"use client"

import type { FC } from "react"

import { type TExternalToast, type TToasterProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"
import { toast } from "./stateManagement"
import type { TToast } from "./Toast/helpers"
import Toast from "./Toast/Toast"

const Toaster: FC<TToasterProps> = (props) => {
  const { isVisible, root, stacks } = useCalibratedComponent(props)

  if (!isVisible) return null

  return (
    <section
      {...root.nativeProps}
      aria-label={root.ariaLabel}
      aria-labelledby={root.ariaLabelledBy}
      aria-describedby={root.ariaDescribedBy}
      aria-details={root.ariaDetails}
      tabIndex={-1}
      className={root.className}
      style={root.style}
      data-testid={root.dataTestID}
    >
      {stacks.map((stack) => (
        <ol
          key={stack.key}
          tabIndex={-1}
          ref={stack.list.ref}
          data-y-position={stack.list.dataYPosition}
          data-x-position={stack.list.dataXPosition}
          data-expanded={stack.list.dataExpanded}
          onFocus={stack.list.onFocus}
          onBlur={stack.list.onBlur}
          onMouseEnter={stack.list.onMouseEnter}
          onMouseMove={stack.list.onMouseMove}
          onMouseLeave={stack.list.onMouseLeave}
          onPointerDown={stack.list.onPointerDown}
          onPointerUp={stack.list.onPointerUp}
          style={stack.list.style}
          className={stack.list.className}
        >
          {stack.toastItems.map((toastItem) => (
            <Toast key={toastItem.key} {...toastItem.props} />
          ))}

          {/* Ghost hover bridges to maintain expanded toaster state when moving cursor between toasts. */}
          {stack.bridges.map((bridge) => (
            <div
              key={bridge.key}
              className={bridge.className}
              aria-hidden
              style={bridge.style}
              onMouseEnter={bridge.onMouseEnter}
              onMouseMove={bridge.onMouseMove}
            />
          ))}
        </ol>
      ))}
    </section>
  )
}

export { Toaster, toast, type TExternalToast, type TToast }
export default Toaster
