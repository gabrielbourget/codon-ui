"use client"

import type { FC } from "react"
import { TooltipTrigger } from "react-aria-components"

import Button from "../../../Button/Button"
import Text from "../../../Text/Text"
import Tooltip from "../../../Tooltip/Tooltip"

import DefaultCloseIcon from "./DefaultCloseIcon"
import type { TPanelHeaderProps } from "./helpers"
import styles from "./PanelHeaderStyles.module.css"

const { panelHeader, titleWrapper } = styles
const SORT_AND_FILTER_PANEL_GEOMETRY__ROUND = "round"
const SORT_AND_FILTER_PANEL_BACKGROUND_COLOR = "var(--aui-background)"
const SORT_AND_FILTER_PANEL_FOREGROUND_COLOR = "var(--aui-foreground)"
const SORT_AND_FILTER_PANEL_PRIMARY_COLOR = "var(--aui-color-primary-500)"
const SORT_AND_FILTER_PANEL_TOOLTIP_OPEN_DELAY = 1000

const PanelHeader: FC<TPanelHeaderProps> = (props) => {
  const { title, labels, onCloseSortAndFilterPanel } = props

  return (
    <div className={panelHeader}>
      <span className={titleWrapper}>
        <Text variant="b8" fontWeight="bold">
          {title}
        </Text>
      </span>

      <TooltipTrigger delay={SORT_AND_FILTER_PANEL_TOOLTIP_OPEN_DELAY}>
        <Button
          aria-label={labels.closeButtonAriaLabel}
          raised={false}
          raisedOnHover
          color={SORT_AND_FILTER_PANEL_BACKGROUND_COLOR}
          customStyles={{ aspectRatio: "1/1", padding: 4 }}
          geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUND}
          onPress={onCloseSortAndFilterPanel}
          hoverColor={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
        >
          <DefaultCloseIcon size={20} color={SORT_AND_FILTER_PANEL_FOREGROUND_COLOR} />
        </Button>
        <Tooltip>
          <Text>{labels.closeButtonAriaLabel}</Text>
        </Tooltip>
      </TooltipTrigger>
    </div>
  )
}

export default PanelHeader
