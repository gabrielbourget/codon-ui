import { createRef } from "react"
import { Image, PlatformColor, StyleSheet } from "react-native"

import { Text, ThumbnailImage, type ThumbnailImageProps, type ThumbnailImageRenderImageArgs } from "../src"

const styles = StyleSheet.create({ image: { width: "50%", height: "auto", tintColor: "red" } })
export const thumbnailProps: ThumbnailImageProps = {
  src: "file:///thumbnail.png",
  srcCandidates: [null, undefined, "", "file:///thumbnail.png"],
  alt: "",
  fallback: 0,
  width: 0,
  height: 80,
  tintColor: PlatformColor("systemBlueColor"),
  style: [styles.image, { borderRadius: 5 }],
  resizeMode: "contain",
  onError: (event) => event.nativeEvent.error,
  onLoad: (event) => event.nativeEvent.source.width,
}
export const ValidThumbnail = <ThumbnailImage {...thumbnailProps} />
export const AdapterThumbnail = (
  <ThumbnailImage
    fallback={<Text>Missing</Text>}
    src="x"
    renderImage={({ imageProps, onError }: ThumbnailImageRenderImageArgs) => (
      <Image {...imageProps} ref={createRef<Image>()} onError={onError} />
    )}
  />
)
export const SkipThumbnail = (
  <ThumbnailImage
    fallback={null}
    renderImage={({ onError }) => {
      onError()
      return null
    }}
  />
)
// @ts-expect-error Fallback content is required even when a source is supplied.
export const MissingThumbnailFallback = <ThumbnailImage src="x" />
// @ts-expect-error The source model owns URI candidates; raw native sources belong to an injected renderer.
export const ReplacedThumbnailSource = <ThumbnailImage fallback={null} source={{ uri: "x" }} />
// @ts-expect-error Candidate values retain the canonical string/null/undefined surface.
export const UnsupportedThumbnailCandidate = <ThumbnailImage fallback={null} srcCandidates={[0]} />
// @ts-expect-error Null is allowed as a candidate entry, not the candidate array.
export const NullThumbnailCandidates = <ThumbnailImage fallback={null} srcCandidates={null} />
// @ts-expect-error Standard native width is numeric; percentage/auto dimensions belong to style.
export const DOMThumbnailDimension = <ThumbnailImage fallback={null} width="80px" />
// @ts-expect-error Native style arrays replace DOM classes.
export const DOMThumbnailClass = <ThumbnailImage fallback={null} className="image" />
// @ts-expect-error Native load/error payloads replace DOM click events.
export const DOMThumbnailClick = <ThumbnailImage fallback={null} onClick={() => undefined} />
// @ts-expect-error Core native Image does not implement browser lazy loading policy.
export const DOMThumbnailLoading = <ThumbnailImage fallback={null} loading="lazy" />
// @ts-expect-error Core native Image does not implement browser sizes selection.
export const DOMThumbnailSizes = <ThumbnailImage fallback={null} sizes="100vw" />
// @ts-expect-error Image children are owned by the candidate/render/fallback model.
export const ReplacedThumbnailChildren = <ThumbnailImage fallback={null}>Other content</ThumbnailImage>
// @ts-expect-error Arbitrary injected/fallback content has no universal image ref.
export const UniversalThumbnailRef = <ThumbnailImage fallback={null} ref={createRef<Image>()} />
// @ts-expect-error Canonical top-level onError receives a genuine native event.
export const InvalidThumbnailErrorCall = thumbnailProps.onError?.()
