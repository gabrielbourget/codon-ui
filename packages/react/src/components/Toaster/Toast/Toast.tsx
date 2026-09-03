"use client"

import type { FC } from "react"
import { Heading } from "react-aria-components"

import Button from "../../Button/Button"
import Text from "../../Text/Text"

import { ToastDefaultCloseIcon } from "./DefaultToastIcons"
import type { TToastProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"
import styles from "./ToastStyles.module.css"

const Toast: FC<TToastProps> = (props: TToastProps) => {
  const { content, root, topRibbon } = useCalibratedComponent(props)
  const { body, bottomRow } = content
  const { actions, timestamp } = bottomRow
  const { cancel, confirm } = actions
  const { closeAction, leftContent, title } = topRibbon

  return (
    <li
      aria-live={root.ariaLive}
      aria-atomic="true"
      role={root.role}
      ref={root.ref}
      tabIndex={0}
      className={root.className}
      data-testid="toast"
      data-mounted={root.dataMounted ? "true" : "false"}
      data-removed={root.dataRemoved}
      data-visible={root.dataVisible}
      data-y-position={root.dataYPosition}
      data-x-position={root.dataXPosition}
      data-index={root.dataIndex}
      data-front={root.dataFront}
      data-dismissable={root.dataDismissable}
      data-type={root.dataType}
      data-dragging={root.dataDragging}
      data-dragging-out={root.dataDraggingOut}
      data-expanded={root.dataExpanded}
      style={root.style}
      onPointerDown={root.onPointerDown}
      onPointerMove={root.onPointerMove}
      onPointerUp={root.onPointerUp}
    >
      <div className={topRibbon.className} style={topRibbon.style}>
        <div className={leftContent.className} style={leftContent.style}>
          {leftContent.icon}
          <Heading slot="title" style={{ color: title.color, ...title.style }} className={title.className}>
            {title.text}
          </Heading>
        </div>
        {closeAction ? (
          <Button
            {...closeAction.props}
            aria-label={closeAction.ariaLabel}
            raised={false}
            onPress={closeAction.onPress}
          >
            {closeAction.icon ?? (
              <ToastDefaultCloseIcon
                customClassName={styles["toast__icon--white"]}
                size={15}
                data-testid="toast-default-close-icon"
              />
            )}
          </Button>
        ) : undefined}
      </div>
      <div className={content.className} style={content.style}>
        <Text variant="b11" {...body.props}>
          {body.text}
        </Text>
        <div className={bottomRow.className} style={bottomRow.style}>
          <Text variant="b13" color={timestamp.color} {...timestamp.props}>
            {timestamp.text}
          </Text>
          <div className={actions.className} style={actions.style}>
            {actions.isVisible ? (
              <>
                {cancel ? (
                  <Button
                    {...cancel.props}
                    order="primary"
                    aria-label={cancel.ariaLabel}
                    onPress={cancel.onPress}
                    transparent
                    raised={false}
                  >
                    <Text fontWeight="bold" color={confirm.color} customStyles={{ textDecoration: "underline" }}>
                      {cancel.text}
                    </Text>
                  </Button>
                ) : null}
                <Button
                  {...confirm.props}
                  raised={false}
                  aria-label={confirm.ariaLabel}
                  color={confirm.color}
                  onPress={confirm.onPress}
                >
                  <Text fontWeight="bold" color={confirm.textColor}>
                    {confirm.text}
                  </Text>
                </Button>
              </>
            ) : undefined}
          </div>
        </div>
      </div>
    </li>
  )
}

export default Toast
