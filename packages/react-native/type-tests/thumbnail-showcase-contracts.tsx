import { createRef } from "react"
import { PlatformColor, StyleSheet, type View } from "react-native"

import {
  Text,
  ThumbnailShowcase,
  THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY,
  type ThumbnailShowcaseProps,
  type ThumbnailShowcaseSecondaryItem,
} from "../src"

const styles = StyleSheet.create({ slot: { borderRadius: 5, backgroundColor: "purple" } })
export const showcaseItems: readonly ThumbnailShowcaseSecondaryItem[] = [
  { id: 0, content: false },
  { id: "", content: 0 },
  { id: 1n, content: <Text>Photo</Text> },
]
export const showcaseProps: ThumbnailShowcaseProps = {
  primaryContent: false,
  primaryPlaceholder: null,
  secondaryItems: showcaseItems,
  secondarySlotCount: 0,
  secondaryColumnCount: 2,
  width: "50%",
  style: [{ opacity: 0 }, { borderColor: PlatformColor("systemBlueColor") }],
  primarySlotStyle: styles.slot,
  secondaryRowStyle: { padding: 5, columnGap: "10%", rowGap: 0 },
  secondarySlotStyle: [styles.slot, { width: 40 }],
  renderSecondaryPlaceholder: ({ index }) => <Text>{index}</Text>,
  renderOverflow: ({ hiddenItemCount }) => <Text>{hiddenItemCount}</Text>,
  onLayout: (event) => event.nativeEvent.layout.width,
}
export const ValidShowcase = <ThumbnailShowcase {...showcaseProps} />
export const SecondaryShowcase = (
  <ThumbnailShowcase primaryPlaceholder={0} renderingMode={THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY} width={0} />
)
// @ts-expect-error The primary placeholder is a required contract even in secondary mode.
export const MissingShowcasePlaceholder = <ThumbnailShowcase />
// @ts-expect-error Modes retain the canonical finite vocabulary.
export const InvalidShowcaseMode = <ThumbnailShowcase primaryPlaceholder={null} renderingMode="gallery" />
// @ts-expect-error Native named dimensions replace CSS lengths.
export const DOMShowcaseDimension = <ThumbnailShowcase primaryPlaceholder={null} width="20rem" />
// @ts-expect-error Native styles replace root DOM classes.
export const DOMShowcaseClass = <ThumbnailShowcase primaryPlaceholder={null} className="root" />
// @ts-expect-error Native styles replace slot DOM classes.
export const DOMShowcaseSlotClass = <ThumbnailShowcase primaryPlaceholder={null} secondarySlotClassName="slot" />
// @ts-expect-error Native event payloads replace DOM click events.
export const DOMShowcaseEvent = <ThumbnailShowcase primaryPlaceholder={null} onClick={() => undefined} />
// @ts-expect-error Explicit content owners replace free root children.
export const ReplacedShowcaseChildren = <ThumbnailShowcase primaryPlaceholder={null}>Other</ThumbnailShowcase>
// @ts-expect-error Secondary identities remain explicit React keys.
export const MissingShowcaseItemKey = <ThumbnailShowcase primaryPlaceholder={null} secondaryItems={[{ content: 0 }]} />
// @ts-expect-error The canonical wrapper does not expose a root ref; authored content may own refs.
export const UniversalShowcaseRef = <ThumbnailShowcase primaryPlaceholder={null} ref={createRef<View>()} />
