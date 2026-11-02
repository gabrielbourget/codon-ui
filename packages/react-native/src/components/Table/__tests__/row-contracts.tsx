import { createRef, type ComponentProps } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { TableRow } from "../TableRow"
import type { TNativeTableRowRenderState } from "../types"

const item = { name: "Alpha" }
const props = { item, columns: [{ id: "name", name: "Name" }] }
export const privateRowCalls = [
  <TableRow
    {...props}
    ref={createRef<View>()}
    ariaDescribedBy={["note"]}
    data-testid="row"
    render={(host, values: TNativeTableRowRenderState) => (
      <NativeFocusView {...host} style={[host.style, { opacity: values.isSelected ? 1 : 0.5 }]} />
    )}
    onPress={(event) => event.preventDefault()}
    onHoverStart={(event) => event.persist()}
    onKeyDown={(event) => event.nativeEvent.key}
  />,
  // @ts-expect-error Canonical wrapper style is plain, not a raw Row state function.
  <TableRow {...props} style={(values: TNativeTableRowRenderState) => ({ opacity: values.isSelected ? 1 : 0.5 })} />,
  // @ts-expect-error Row has no authored replacement children in the canonical wrapper.
  <TableRow {...props}>Replacement</TableRow>,
  // @ts-expect-error No new public native motion interface is advertised by TableRow.
  <TableRow {...props} animate={{ opacity: 0.5 }} />,
  // @ts-expect-error Native styles use logical dimensions.
  <TableRow {...props} style={{ width: "20px" }} />,
]

export const rejectDefaultChildren = (values: TNativeTableRowRenderState) => {
  // @ts-expect-error Raw row values never include defaultChildren.
  return values.defaultChildren
}

type TBrowserRowNavigation = "target" | "download" | "ping" | "referrerPolicy" | "rel" | "hrefLang" | "routerOptions"
type TRejectNavigation<T> = { [K in TBrowserRowNavigation]: K extends keyof T ? Exclude<T[K], undefined> : "missing" }
type TAssertNativeNavigation<T extends Record<TBrowserRowNavigation, never>> = T
type TRowHost = Parameters<NonNullable<ComponentProps<typeof TableRow>["render"]>>[0]
export type TNativeRowNavigationBoundaryCalls = [
  TAssertNativeNavigation<TRejectNavigation<ComponentProps<typeof TableRow>>>,
  TAssertNativeNavigation<TRejectNavigation<TRowHost>>,
]
const browserNavigation = { target: "_blank", download: "people.csv", ping: "/audit", referrerPolicy: "no-referrer" }
export const approvedRowNavigationCalls = [
  <TableRow {...props} onAction={() => {}} />,
  <TableRow {...props} href="../people" onNavigationError={(_error, href) => String(href)} />,
  <TableRow {...props} href="#people" routerOptions={undefined} />,
  // @ts-expect-error Exact-URI OS handoff has no browser target/download/ping/referrer policy, even through spreads.
  <TableRow {...props} {...browserNavigation} />,
  // @ts-expect-error No browser window target is delegated.
  <TableRow {...props} target="_blank" />,
  // @ts-expect-error The native URL handoff does not perform browser downloads.
  <TableRow {...props} download />,
  // @ts-expect-error Native navigation emits no browser ping request.
  <TableRow {...props} ping="/audit" />,
  // @ts-expect-error Native navigation has no browser referrer policy.
  <TableRow {...props} referrerPolicy="no-referrer" />,
  // @ts-expect-error rel is actual link metadata here, excluded as browser link policy rather than RDFa.
  <TableRow {...props} rel="noopener" />,
  // @ts-expect-error The pinned canonical Row filters hrefLang; no new native language hint is implied.
  <TableRow {...props} hrefLang="en" />,
  // @ts-expect-error Application routing uses onAction/onRowAction without href, not automatic RouterProvider options.
  <TableRow {...props} routerOptions={{ replace: true }} />,
]
