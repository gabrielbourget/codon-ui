"use client"

import { type FC, type PropsWithChildren } from "react"
import { Dialog } from "react-aria-components"

import FormField from "../FormField/FormField"
import Panel from "../Panel/Panel"
import Select from "../Select/Select"
// -> Registry consumers place LineSegment under VisualUtilities, so keep its transformed import order lint-safe.
// eslint-disable-next-line import/order
import LineSegment from "../LineSegment/LineSegment"

import type { TSortAndFilterPanelProps } from "./helpers"
import { useCalibratedComponent } from "./hooks"
import ActiveFilters from "./InternalComponents/ActiveFilters/ActiveFilters"
import ActiveSorts from "./InternalComponents/ActiveSorts/ActiveSorts"
import PanelFooter from "./InternalComponents/PanelFooter/PanelFooter"
import PanelHeader from "./InternalComponents/PanelHeader/PanelHeader"

const SortAndFilterPanel: FC<PropsWithChildren<TSortAndFilterPanelProps>> = (props) => {
  const { panel, form, sorts, filters, footer } = useCalibratedComponent(props)

  return (
    <Panel {...panel.rootProps}>
      <Dialog {...panel.dialogProps}>
        {({ close: closePanel }) => (
          <>
            <PanelHeader {...panel.headerProps} onCloseSortAndFilterPanel={closePanel} />

            <LineSegment {...panel.dividerProps} />

            <FormField {...form.sortCriteria.fieldProps}>
              <Select {...form.sortCriteria.selectProps}>{form.sortCriteria.renderItem}</Select>
            </FormField>

            <FormField {...form.filterCriteria.fieldProps}>
              <Select {...form.filterCriteria.selectProps}>{form.filterCriteria.renderItem}</Select>
            </FormField>

            <LineSegment {...panel.dividerProps} />

            <ActiveSorts {...sorts} />

            <LineSegment {...panel.dividerProps} />

            <ActiveFilters {...filters} />

            <LineSegment {...panel.dividerProps} />

            <PanelFooter
              labels={footer.labels}
              onClearAllSortAndFilterParameters={footer.onClearAllSortAndFilterParameters}
              onCancelPendingChanges={() => footer.onCancelPendingChanges(closePanel)}
              onApplyPendingChanges={() => footer.onApplyPendingChanges(closePanel)}
            />
          </>
        )}
      </Dialog>
    </Panel>
  )
}

export default SortAndFilterPanel
