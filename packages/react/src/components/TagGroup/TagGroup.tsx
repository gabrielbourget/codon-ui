"use client"

import { type ForwardedRef, forwardRef } from "react"
import { TagGroup as AdobeTagGroup, TagList } from "react-aria-components"

import { type TTagGroupProps, calibrateComponent } from "./helpers"

export default forwardRef(function TagGroup<T extends object>(
  props: TTagGroupProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "data-testid": dataTestID,
    children,
    className,
    customClassName,
    customStyles: customStyles__props,
    customTagListClassName,
    customTagListStyles: customTagListStyles__props,
    emptyListMessage,
    height,
    items,
    onRemove,
    onSelectionChange,
    orientation,
    render: tagGroupRender,
    renderEmptyState,
    selectedKeys,
    selectionBehavior,
    selectionMode,
    style,
    width,
    ...rest
  } = props

  const { tagGroupStyles, tagListStyles, customStyles, customTagListStyles } = calibrateComponent(props)
  const resolvedRenderEmptyState = renderEmptyState ?? (emptyListMessage ? () => emptyListMessage : undefined)

  return (
    <AdobeTagGroup
      {...rest}
      ref={forwardedRef}
      onRemove={onRemove}
      onSelectionChange={onSelectionChange}
      selectionBehavior={selectionBehavior}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      data-testid={dataTestID ?? "tag-group"}
      className={tagGroupStyles}
      style={{ ...customStyles }}
      render={tagGroupRender}
    >
      <TagList
        className={tagListStyles}
        style={{ ...customTagListStyles }}
        data-testid="tag-list"
        items={items}
        renderEmptyState={resolvedRenderEmptyState}
      >
        {children}
      </TagList>
    </AdobeTagGroup>
  )
})
