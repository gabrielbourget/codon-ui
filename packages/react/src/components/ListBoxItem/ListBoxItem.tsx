import { type FC } from "react"
import { ListBoxItem as AdobeListBoxItem } from "react-aria-components"

import { type TListBoxItemProps, calibrateComponent } from "./helpers"

const ListBoxItem: FC<TListBoxItemProps<object>> = (props) => {
  const { customStyles: customStyles__props, textSize, className, style, "data-testid": dataTestID, ...rest } = props
  const { listBoxItemStyles, listBoxItemStyle } = calibrateComponent(props)

  return (
    <AdobeListBoxItem
      {...rest}
      className={listBoxItemStyles}
      style={listBoxItemStyle}
      data-testid={dataTestID ?? "listbox-item"}
    />
  )
}

export default ListBoxItem
