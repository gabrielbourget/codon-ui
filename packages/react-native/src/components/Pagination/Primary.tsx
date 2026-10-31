import type { ReactNode } from "react"
import { View, useWindowDimensions } from "react-native"

import { NativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { ClickPopover } from "../ClickPopover/ClickPopover"
import { NativeOptionList } from "../NativeOptionList"

import { NativePaginationAction } from "./Action"
import { NativePaginationGlyph } from "./icons"
import type { TNativePaginationLabels } from "./labels"
import type { TNativePaginationWindowItem } from "./model"
import type { getNativePaginationStyles } from "./styles"
import type { TNativePaginationProps } from "./types"

type TProps = {
  props: TNativePaginationProps
  count: number
  items: readonly TNativePaginationWindowItem[]
  labels: TNativePaginationLabels
  styles: ReturnType<typeof getNativePaginationStyles>
  requestPage: (page: number) => void
}
export const NativePaginationPrimary = ({ props, count, items, labels, styles, requestPage }: TProps) => {
  const { width } = useWindowDimensions()
  const names = labels.primaryControls
  const backward = props.rtl ? "right" : "left",
    forward = props.rtl ? "left" : "right"
  const back = props.rtl ? props.incrementUpIcon : props.incrementDownIcon
  const next = props.rtl ? props.incrementDownIcon : props.incrementUpIcon
  const first = props.rtl ? props.incrementAllUpIcon : props.incrementAllDownIcon
  const last = props.rtl ? props.incrementAllDownIcon : props.incrementAllUpIcon
  const controls = {
    first: {
      show: props.showFirstPageButton ?? false,
      edge: props.currentPage <= 1,
      edgeVisible: props.showFirstPageButtonOnFirstPage,
      page: 1,
      label: names.firstPageButtonAriaLabel,
      text: names.firstPageButton,
      icon: first === undefined ? <NativePaginationGlyph direction={backward} double /> : first,
      iconVisible: props.showFirstPageButtonIcon,
      textVisible: props.showFirstPageButtonLabel,
      style: props.customFirstPageButtonStyles,
    },
    previous: {
      show: props.showPrevPageButton ?? true,
      edge: props.currentPage <= 1,
      edgeVisible: props.showPrevPageButtonOnFirstPage,
      page: props.currentPage - 1,
      label: names.previousPageButtonAriaLabel,
      text: names.previousPageButton,
      icon: back === undefined ? <NativePaginationGlyph direction={backward} /> : back,
      iconVisible: props.showPrevPageButtonIcon,
      textVisible: props.showPrevPageButtonLabel,
      style: props.customPrevButtonStyles,
    },
    next: {
      show: props.showNextPageButton ?? true,
      edge: props.currentPage >= count,
      edgeVisible: props.showNextPageButtonOnLastPage,
      page: props.currentPage + 1,
      label: names.nextPageButtonAriaLabel,
      text: names.nextPageButton,
      icon: next === undefined ? <NativePaginationGlyph direction={forward} /> : next,
      iconVisible: props.showNextPageButtonIcon,
      textVisible: props.showNextPageButtonLabel,
      style: props.customNextButtonStyles,
    },
    last: {
      show: props.showLastPageButton ?? false,
      edge: props.currentPage >= count,
      edgeVisible: props.showLastPageButtonOnLastPage,
      page: count,
      label: names.lastPageButtonAriaLabel,
      text: names.lastPageButton,
      icon: last === undefined ? <NativePaginationGlyph direction={forward} double /> : last,
      iconVisible: props.showLastPageButtonIcon,
      textVisible: props.showLastPageButtonLabel,
      style: props.customLastPageButtonStyles,
    },
  }
  const row = (keys: readonly (keyof typeof controls)[], side: "left" | "right") => {
    if (props.showIncrementButtonsWithOnePage === false) return null
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5 }} testID={`${side}-increment-buttons`}>
        {keys.map((key) => {
          const item = controls[key]
          if (props.showIncrementButtons === false || !item.show || (item.edge && item.edgeVisible === false))
            return null
          const icon = item.iconVisible !== false ? item.icon : null,
            text = item.textVisible !== false ? item.text : null
          return (
            <NativePaginationAction
              key={key}
              props={props}
              target={styles.target}
              textStyle={styles.root.text}
              testID={`pagination-${key}`}
              label={item.label}
              disabled={item.edge}
              customStyles={item.style}
              onRequest={() => requestPage(item.page)}
            >
              {side === "left" ? (
                <>
                  {icon}
                  {text}
                </>
              ) : (
                <>
                  {text}
                  {icon}
                </>
              )}
            </NativePaginationAction>
          )
        })}
      </View>
    )
  }
  const overflowGlyph =
    props.overflowItemsButtonIcon === undefined ? <NativePaginationGlyph overflow /> : props.overflowItemsButtonIcon
  return (
    <View testID="primary-controls" style={{ flexDirection: "row", gap: 5, alignItems: "flex-end" }}>
      {row(props.rtl ? ["last", "next"] : ["first", "previous"], "left")}
      <View
        testID="page-number-controls"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          flexShrink: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: styles.gap,
          maxWidth: width < 450 ? 200 : 350,
        }}
      >
        {items.map((item, index): ReactNode => {
          if (typeof item === "number")
            return (
              <NativePaginationAction
                key={`page-${item}`}
                props={props}
                target={styles.target}
                textStyle={styles.root.text}
                testID={`pagination-page-${item}`}
                label={names.pageButtonAriaLabel(item)}
                selected={item === props.currentPage}
                currentPageValue={item === props.currentPage ? names.currentPageValue : undefined}
                colorMode={item === props.currentPage ? "fill" : "outline"}
                customStyles={props.customPageNumberButtonStyles}
                onRequest={() => requestPage(item)}
              >
                {item}
              </NativePaginationAction>
            )
          if (!item.length) return null
          if (item.length === 1)
            return (
              <NativePaginationAction
                key={`overflow-${item[0]}`}
                props={props}
                target={styles.target}
                textStyle={styles.root.text}
                testID="pagination-overflow-trigger"
                label={names.pageButtonAriaLabel(item[0])}
                colorMode="outline"
                customStyles={props.customClickPopoverTriggerButtonStyles}
                onRequest={() => requestPage(item[0])}
              >
                {overflowGlyph}
              </NativePaginationAction>
            )
          return (
            <NativePaginationOverflow
              key={`overflow-${item.join("-")}`}
              {...{ props, styles, requestPage }}
              pages={item}
              label={names.overflowListAriaLabel(index + 1)}
              triggerLabel={names.overflowButtonAriaLabel}
              pageLabel={names.pageButtonAriaLabel}
            >
              {overflowGlyph}
            </NativePaginationOverflow>
          )
        })}
      </View>
      {row(props.rtl ? ["previous", "first"] : ["next", "last"], "right")}
    </View>
  )
}

const NativePaginationOverflow = ({
  props,
  styles,
  pages,
  label,
  triggerLabel,
  pageLabel,
  children,
  requestPage,
}: Pick<TProps, "props" | "styles" | "requestPage"> & {
  pages: readonly number[]
  label: string
  triggerLabel: string
  pageLabel: (page: number) => string
  children: ReactNode
}) => {
  const {
    isOpen,
    defaultOpen,
    onOpenChange,
    raised = false,
    placement = "bottom right",
    customStyles,
    ...popover
  } = props.customClickPopoverProps ?? {}
  return (
    <NativeDialogTrigger
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isDisabled={props.isDisabled}
      trigger={(state) => (
        <NativePaginationAction
          ref={state.triggerRef}
          nativeID={state.triggerProps.nativeID}
          expanded={state.isOpen}
          props={props}
          target={styles.target}
          textStyle={styles.root.text}
          testID="pagination-overflow-trigger"
          label={triggerLabel}
          colorMode="outline"
          customStyles={props.customClickPopoverTriggerButtonStyles}
          onRequest={state.triggerProps.onPress}
        >
          {children}
        </NativePaginationAction>
      )}
    >
      <ClickPopover
        {...popover}
        {...(popover.slot === null ? { isOpen, defaultOpen, onOpenChange } : {})}
        raised={raised}
        placement={placement}
        accessibilityLabel={popover.accessibilityLabel ?? popover["aria-label"] ?? label}
        customStyles={[{ maxWidth: 250 }, customStyles]}
      >
        <NativeOptionList
          prefix="pagination"
          items={pages.map((value) => ({
            id: `page-${value}`,
            content: String(value),
            ariaLabel: pageLabel(value),
            disabled: !!props.isDisabled,
            value,
          }))}
          label={label}
          style={styles.list}
          disabled={!!props.isDisabled}
          selectionOnly
          autoFocus={popover.initialFocusRef === undefined}
          onSelectionChange={(item) => {
            if (item) requestPage(item.value)
          }}
        />
      </ClickPopover>
    </NativeDialogTrigger>
  )
}
