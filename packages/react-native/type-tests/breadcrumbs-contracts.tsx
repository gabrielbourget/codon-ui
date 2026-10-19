import { createRef } from "react"
import type { View } from "react-native"

import { Breadcrumbs, type BreadcrumbItemData, type BreadcrumbsProps } from "../src"

const items: readonly BreadcrumbItemData[] = [{ id: "", href: "", content: "", disabled: false }]
export const trail = (
  <Breadcrumbs
    ref={createRef<View>()}
    items={items}
    maxVisibleItems={3}
    consolidationPlacement="left"
    isDisabled={false}
    onNavigate={({ href, item, target }) => {
      href.toLowerCase()
      item.id.toLowerCase()
      target.toLowerCase()
    }}
    style={{ width: 0, gap: 0 }}
    customBreadcrumbLinkProps={{ isVisited: false }}
    customClickPopoverProps={{ isOpen: false, showOverlayArrow: false, offset: 0 }}
    labels={{ navAriaLabel: "", descriptionLabel: "" }}
  />
)
export const typedTrail: BreadcrumbsProps = {
  items,
  "aria-describedby": "description",
  "aria-details": "details",
  customOptionsListStyles: { color: "purple", padding: 0 },
}
// @ts-expect-error Catalogue item identity remains a string.
export const noNumericID = <Breadcrumbs items={[{ id: 0, href: "", content: "", disabled: false }]} />
export const noElementContent = (
  // @ts-expect-error Content is the canonical string value rather than a cloned render node.
  <Breadcrumbs items={[{ id: "", href: "", content: <Breadcrumbs items={[]} />, disabled: false }]} />
)
// @ts-expect-error Native style owners replace CSS classes.
export const noClass = <Breadcrumbs items={items} className="trail" />
// @ts-expect-error Public refs retain actual native View methods.
export const noDOMRef = <Breadcrumbs items={items} ref={createRef<HTMLOListElement>()} />
export const noVirtualRef = (
  // @ts-expect-error Virtual browser anchors cannot be used for the native popup.
  <Breadcrumbs items={items} customClickPopoverProps={{ triggerRef: createRef<{ measureInWindow: () => void }>() }} />
)
