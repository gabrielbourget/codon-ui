import type { FC, PropsWithChildren } from "react"
import { ListBoxItem as AdobeListBoxItem } from "react-aria-components"

import { type TListBoxItemProps, calibrateComponent } from "./helpers"

const ListBoxItem: FC<PropsWithChildren<TListBoxItemProps<object>>> = (
  props: PropsWithChildren<TListBoxItemProps<object>>,
) => {
  const { customStyles, children, ...rest } = props
  const listBoxItemStyles = calibrateComponent(props)

  return (
    <AdobeListBoxItem className={listBoxItemStyles} style={customStyles} data-testid="listbox-item" {...rest}>
      {children}
    </AdobeListBoxItem>
  )
}

export default ListBoxItem
