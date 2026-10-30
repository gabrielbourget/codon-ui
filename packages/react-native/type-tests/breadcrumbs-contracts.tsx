import { createRef } from "react"
import type { View } from "react-native"

import {
  Breadcrumbs,
  NativeBreadcrumbsContext,
  NativeFocusView,
  type BreadcrumbItemData,
  type BreadcrumbsProps,
} from "../src"

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
  linkTarget: "_self",
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

export const contextualTrail = (
  <NativeBreadcrumbsContext.Provider
    value={{
      slots: {
        trail: {
          ref: createRef<View>(),
          style: [{ gap: 0, letterSpacing: 0 }],
          items,
          children: (item) => item.content,
          isDisabled: false,
          onAction: (key) => key.toString(),
          render: (props, state) => {
            const noState: undefined = state
            void noState
            // @ts-expect-error Root renderers do not receive an invented state object.
            void state.isDisabled
            return <NativeFocusView {...props} />
          },
        },
      },
    }}
  >
    <Breadcrumbs items={items} slot="trail" />
    <Breadcrumbs items={items} slot={null} />
  </NativeBreadcrumbsContext.Provider>
)
export const noContextDOMRef = (
  // @ts-expect-error Context refs must retain the real native View API.
  <NativeBreadcrumbsContext.Provider value={{ ref: createRef<HTMLOListElement>() }} />
)
export const noContextStyleFunction = (
  // @ts-expect-error Canonical root context style is static.
  <NativeBreadcrumbsContext.Provider value={{ style: () => ({}) }} />
)
// @ts-expect-error Root rendering is supplied through context, not a new owned prop.
export const noOwnRenderer = <Breadcrumbs items={items} render={(props) => <NativeFocusView {...props} />} />
// @ts-expect-error The wrapper retains its caller-owned collection and fixed child composition.
export const noOwnChildren = <Breadcrumbs items={items}>{() => null}</Breadcrumbs>

// @ts-expect-error Browser window contexts are excluded by the native OS URL contract.
export const noBrowserTarget = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ target: "_blank" }} />
// @ts-expect-error OS URL handoff does not implement browser rel policy.
export const noBrowserRel = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ rel: "noreferrer" }} />
export const noBrowserReferrer = (
  // @ts-expect-error OS URL handoff does not implement browser referrer policy.
  <Breadcrumbs items={items} customBreadcrumbLinkProps={{ referrerPolicy: "no-referrer" }} />
)
// @ts-expect-error OS URL handoff does not implement browser downloads.
export const noBrowserDownload = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ download: "file" }} />
// @ts-expect-error Hyperlink language hints are excluded by the native OS URL contract.
export const noBrowserHrefLang = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ hrefLang: "fr" }} />
// @ts-expect-error Hyperlink media hints are excluded by the native OS URL contract.
export const noBrowserMedia = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ media: "print" }} />
// @ts-expect-error Browser hyperlink ping requests are excluded by the native OS URL contract.
export const noBrowserPing = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ ping: "https://example.test" }} />
// @ts-expect-error Hyperlink resource-type hints are excluded by the native OS URL contract.
export const noBrowserType = <Breadcrumbs items={items} customBreadcrumbLinkProps={{ type: "text/html" }} />
