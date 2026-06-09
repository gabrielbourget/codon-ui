"use client"

import classNames from "classnames"
import { useState, type FC } from "react"
import {
  Breadcrumb as AdobeBreadcrumb,
  Breadcrumbs as AdobeBreadcrumbs,
  DialogTrigger,
  ListBox,
} from "react-aria-components"
import { flushSync } from "react-dom"

import { ROUND } from "../../tokens/geometry"
import Button from "../Button/Button"
import ClickPopover from "../ClickPopover/ClickPopover"
import Link from "../Link/Link"
import ListBoxItem from "../ListBoxItem/ListBoxItem"
import Text from "../Text/Text"

import { BreadcrumbDefaultChevronRightIcon, BreadcrumbDefaultOverflowIcon } from "./DefaultBreadcrumbIcons"
import { calibrateComponent, type TBreadcrumbsProps } from "./helpers"
import { resolveBreadcrumbsLabels } from "./labels"

const Breadcrumbs: FC<TBreadcrumbsProps> = (props) => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className,
    color,
    consolidationPlacement,
    customBreadcrumbClassName,
    customBreadcrumbStyles: customBreadcrumbStyles__props,
    customClassName,
    customOptionsListClassName,
    order,
    items,
    isDisabled = false,
    customStyles: customStyles__props,
    customOptionsListStyles,
    customOverflowItemsPopoverButtonClassName,
    geometry = ROUND,
    customBreadcrumbLinkProps = {},
    customClickPopoverProps = {},
    linkTarget = "_blank",
    labels,
    maxVisibleItems,
    onNavigate,
    style,
    customPopoverClassName,
    customOverflowItemsPopoverButtonStyles,
    ...rest
  } = props

  const [internalItemListOpen, setInternalItemListOpen] = useState(false)
  const resolvedLabels = resolveBreadcrumbsLabels(labels)
  const resolvedIsDisabled = isDisabled
  const rootAriaLabel = ariaLabel ?? ariaLabelAlias ?? resolvedLabels.navAriaLabel
  const {
    className: clickPopoverClassName,
    customClassName: clickPopoverCustomClassName,
    customDialogStyles: clickPopoverDialogStyles,
    customStyles: clickPopoverCustomStyles,
    placement: clickPopoverPlacement = "bottom right",
    style: clickPopoverStyle,
    ...restCustomClickPopoverProps
  } = customClickPopoverProps

  const {
    className: breadcrumbLinkClassName,
    customClassName: breadcrumbLinkCustomClassName,
    customStyles: breadcrumbLinkCustomStyles,
    style: breadcrumbLinkStyle,
    ...restCustomBreadcrumbLinkProps
  } = customBreadcrumbLinkProps

  const {
    breadcrumbsStyles,
    popoverStyles,
    breadcrumbsListStyles,
    breadcrumbStyles,
    internalBreadcrumbItems,
    customStyles,
    customBreadcrumbStyles,
  } = calibrateComponent(props)

  const BreadcrumbsContent = () => (
    <AdobeBreadcrumbs
      className={breadcrumbsStyles}
      style={{ ...customStyles }}
      {...rest}
      aria-label={rootAriaLabel}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      isDisabled={resolvedIsDisabled || undefined}
      data-disabled={resolvedIsDisabled ? "true" : undefined}
      data-testid={dataTestID ?? "breadcrumbs"}
    >
      {internalBreadcrumbItems.map((internalItem, index) => {
        // -> Consolidated breadcrumbs (which overflowed the maximum visible allowed) arranged into an
        //    array to be shown in a click popover list.
        if (Array.isArray(internalItem)) {
          return (
            <AdobeBreadcrumb
              id={index}
              key={index}
              data-testid="breadcrumb"
              data-overflowbreadcrumb="true"
              className={breadcrumbStyles}
              style={{ ...customBreadcrumbStyles }}
              data-disabled={resolvedIsDisabled ? "true" : undefined}
              aria-label={resolvedLabels.overflowBreadcrumbAriaLabel}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <DialogTrigger isOpen={internalItemListOpen} onOpenChange={setInternalItemListOpen}>
                  <Button
                    raisedOnHover
                    aria-label={resolvedLabels.overflowButtonAriaLabel}
                    geometry={geometry}
                    transparent
                    raised={false}
                    isDisabled={resolvedIsDisabled}
                    customClassName={customOverflowItemsPopoverButtonClassName}
                    customStyles={{ aspectRatio: "1/1", ...customOverflowItemsPopoverButtonStyles }}
                    onClick={() => setInternalItemListOpen(true)}
                  >
                    <BreadcrumbDefaultOverflowIcon size={15} />
                  </Button>
                  <ClickPopover
                    {...restCustomClickPopoverProps}
                    className={classNames(popoverStyles, clickPopoverClassName)}
                    customClassName={clickPopoverCustomClassName}
                    customStyles={clickPopoverCustomStyles}
                    placement={clickPopoverPlacement}
                    style={clickPopoverStyle}
                    customDialogStyles={{ outlineOffset: 2, ...clickPopoverDialogStyles }}
                  >
                    <ListBox
                      aria-label={resolvedLabels.overflowListAriaLabel}
                      data-testid="Consolidated Breadcrumb Items"
                      items={internalItem}
                      shouldFocusWrap={true}
                      className={breadcrumbsListStyles}
                      style={customOptionsListStyles}
                      data-overflowlistbox
                      selectionMode="single"
                      onAction={(key) => {
                        const selectedItem = items.find((item) => item.id === key)
                        if (!selectedItem) return

                        flushSync(() => setInternalItemListOpen(false))

                        if (onNavigate) {
                          onNavigate({ href: selectedItem.href, item: selectedItem, target: linkTarget })
                          return
                        }

                        window.open(selectedItem.href, linkTarget, "noopener,noreferrer")
                      }}
                    >
                      {(item) => (
                        <ListBoxItem
                          key={item.id}
                          id={item.id}
                          href={item.href}
                          aria-label={item.content}
                          data-disabled={item.disabled ? "true" : undefined}
                          target={linkTarget}
                        >
                          <Text>{item.content}</Text>
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </ClickPopover>
                  <BreadcrumbDefaultChevronRightIcon aria-hidden={true} size={15} />
                </DialogTrigger>
              </div>
            </AdobeBreadcrumb>
          )
        }

        // -> Early return above guards against the item being an array of breadcrumbs
        const { id, href, content } = internalItem
        const itemDisabled = internalItem.disabled === true
        const isLastBreadcrumb = index === internalBreadcrumbItems.length - 1

        return (
          <AdobeBreadcrumb
            key={index}
            id={id}
            data-testid="breadcrumb"
            className={breadcrumbStyles}
            style={{ ...customBreadcrumbStyles }}
            aria-label={content}
          >
            {isLastBreadcrumb ? (
              <Text data-current="true">{content}</Text>
            ) : (
              <Link
                {...restCustomBreadcrumbLinkProps}
                href={href}
                order={order}
                target={linkTarget}
                isDisabled={itemDisabled || resolvedIsDisabled}
                className={breadcrumbLinkClassName}
                customClassName={breadcrumbLinkCustomClassName}
                customStyles={{ ...customBreadcrumbStyles, ...breadcrumbLinkCustomStyles }}
                style={breadcrumbLinkStyle}
              >
                <Text>{content}</Text>
                {index < internalBreadcrumbItems.length - 1 ? (
                  <BreadcrumbDefaultChevronRightIcon aria-hidden={true} size={15} />
                ) : null}
              </Link>
            )}
          </AdobeBreadcrumb>
        )
      })}
    </AdobeBreadcrumbs>
  )

  return (
    <>
      {resolvedIsDisabled ? (
        <BreadcrumbsContent />
      ) : (
        <nav aria-label={rootAriaLabel}>
          <BreadcrumbsContent />
        </nav>
      )}
    </>
  )
}

export default Breadcrumbs
