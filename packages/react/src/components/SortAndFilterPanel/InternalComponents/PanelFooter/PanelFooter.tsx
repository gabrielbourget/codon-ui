import type { FC } from "react"

import Button from "../../../Button/Button"
import Text from "../../../Text/Text"

import type { TPanelFooterProps } from "./helpers"
import styles from "./PanelFooterStyles.module.css"

const { panelFooter, panelFooter__rightContent } = styles
const SORT_AND_FILTER_PANEL_GEOMETRY__ROUNDED = "rounded"
const SORT_AND_FILTER_PANEL_PRIMARY_COLOR = "var(--cui-color-primary-500)"

const PanelFooter: FC<TPanelFooterProps> = (props) => {
  const { labels, onClearAllSortAndFilterParameters, onCancelPendingChanges, onApplyPendingChanges } = props

  return (
    <div className={panelFooter}>
      <Button
        transparent
        geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUNDED}
        onPress={onClearAllSortAndFilterParameters}
        raised={false}
      >
        <Text
          variant="b10"
          color={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
          customStyles={{
            borderBottom: `1px solid ${SORT_AND_FILTER_PANEL_PRIMARY_COLOR}`,
            paddingBottom: 2,
          }}
        >
          {labels.clearAllButton}
        </Text>
      </Button>

      <div className={panelFooter__rightContent}>
        <Button
          transparent
          geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUNDED}
          onPress={onCancelPendingChanges}
          raised={false}
        >
          <Text
            variant="b10"
            color={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
            customStyles={{
              borderBottom: `1px solid ${SORT_AND_FILTER_PANEL_PRIMARY_COLOR}`,
              paddingBottom: 2,
            }}
          >
            {labels.cancelButton}
          </Text>
        </Button>
        <Button
          geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUNDED}
          onPress={() => onApplyPendingChanges()}
          raised={false}
          order="primary"
        >
          <Text variant="b10" fontWeight="bold">
            {labels.applyButton}
          </Text>
        </Button>
      </div>
    </div>
  )
}

export default PanelFooter
