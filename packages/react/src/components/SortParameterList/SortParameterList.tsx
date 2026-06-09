import { useEffect, useState, type FC } from "react"
import type { DragEndEvent } from "react-aria"

import { DROP_OPERATION__MOVE } from "../../tokens/drag"

import {
  calibrateComponent,
  initState,
  reorderSortParameterList,
  type TSortParameterListProps,
  type TSortParameterListState,
} from "./helpers"
import SortParameterListItem from "./SortParameterListItem/SortParameterListItem"

// - TODO: -> Once it's a good time, refactor component to update list state based on
//            functions passed in by props.
const SortParameterList: FC<TSortParameterListProps> = (props) => {
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
    customClassName,
    customItemClassName,
    customItemIconClassName,
    customItemIconStyles,
    customItemStyles,
    customItemTextClassName,
    customItemTextStyles,
    customStyles,
    onSortParameterListChange,
    sortParameterList: sortParameterList__props,
    style,
    ...rest
  } = props
  const [state, setState] = useState<TSortParameterListState>(initState)
  const { sortParameterListStyles, sortParameterListStyle } = calibrateComponent({
    ...props,
    className,
    customClassName,
    customStyles,
    style,
  })

  useEffect(() => {
    setState((prevState) => ({ ...prevState, sortParameterList: sortParameterList__props }))
  }, [sortParameterList__props])

  const handleDragStart = (ID: string) => {
    setState((prevState) => ({ ...prevState, draggedID: ID }))
  }

  const handleDrop = (targetID: string) => {
    setState((prevState) => {
      const updatedSortItems = reorderSortParameterList(prevState.sortParameterList, prevState.draggedID, targetID)

      if (updatedSortItems !== prevState.sortParameterList) {
        onSortParameterListChange?.(updatedSortItems)
      }

      return { ...prevState, sortParameterList: updatedSortItems, draggedID: null }
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    if (e.dropOperation === DROP_OPERATION__MOVE) {
      setState((prevState) => ({ ...prevState, draggedID: null }))
    }
  }

  const { sortParameterList: sortParameterList__state } = state

  return (
    <div
      {...rest}
      aria-label={ariaLabel ?? ariaLabelAlias}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      className={sortParameterListStyles}
      data-testid={dataTestID ?? "sort-parameter-list"}
      style={sortParameterListStyle}
    >
      {sortParameterList__state.map((item) => (
        <SortParameterListItem
          key={item.ID}
          item={item}
          customClassName={customItemClassName}
          customIconClassName={customItemIconClassName}
          customIconStyles={customItemIconStyles}
          customStyles={customItemStyles}
          customTextClassName={customItemTextClassName}
          customTextStyles={customItemTextStyles}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  )
}

export default SortParameterList
