import type { ReactNode } from "react"
import type { ImageErrorEvent, ImageProps } from "react-native"

export type TNativeThumbnailImageErrorHandler = (event?: ImageErrorEvent) => void
type TNativeThumbnailImageHostProps = Omit<ImageProps, "alt" | "children" | "onError" | "source" | "src"> & {
  "data-testid"?: string
  source?: never
  children?: never
}
export type TNativeThumbnailImageRenderImageProps = TNativeThumbnailImageHostProps & {
  alt: string
  src: string
  onError: TNativeThumbnailImageErrorHandler
}
export type TNativeThumbnailImageRenderImageArgs = {
  alt: string
  src: string
  imageProps: TNativeThumbnailImageRenderImageProps
  onError: TNativeThumbnailImageErrorHandler
}
export type TNativeThumbnailImageProps = TNativeThumbnailImageHostProps & {
  alt?: string
  fallback: ReactNode
  onError?: (event: ImageErrorEvent) => void
  renderImage?: (args: TNativeThumbnailImageRenderImageArgs) => ReactNode
  src?: string
  srcCandidates?: readonly (string | null | undefined)[]
}
