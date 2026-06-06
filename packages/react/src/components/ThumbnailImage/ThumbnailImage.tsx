"use client"

import { createElement, type ImgHTMLAttributes, type ReactNode, type SyntheticEvent, useEffect, useState } from "react"

export type TThumbnailImageErrorHandler = (event?: SyntheticEvent<HTMLImageElement, Event>) => void

type TThumbnailImageNativeProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "children" | "onError" | "src">

export type TThumbnailImageRenderImageProps = TThumbnailImageNativeProps & {
  alt: string
  src: string
  onError: TThumbnailImageErrorHandler
}

export type TThumbnailImageRenderImageArgs = {
  alt: string
  src: string
  imageProps: TThumbnailImageRenderImageProps
  onError: TThumbnailImageErrorHandler
}

export type TThumbnailImageProps = TThumbnailImageNativeProps & {
  alt?: string
  fallback: ReactNode
  onError?: (event: SyntheticEvent<HTMLImageElement, Event>) => void
  renderImage?: (args: TThumbnailImageRenderImageArgs) => ReactNode
  src?: string
  srcCandidates?: readonly (string | null | undefined)[]
}

const resolveThumbnailImageSrcCandidates = ({
  src,
  srcCandidates,
}: {
  src?: string
  srcCandidates?: readonly (string | null | undefined)[]
}) => {
  const candidates = srcCandidates && srcCandidates.length > 0 ? srcCandidates : [src]

  return Array.from(new Set(candidates.filter((candidate): candidate is string => !!candidate)))
}

const ThumbnailImage = (props: TThumbnailImageProps) => {
  const { alt, fallback, onError, renderImage, src, srcCandidates, ...imageProps } = props
  const resolvedSrcCandidates = resolveThumbnailImageSrcCandidates({ src, srcCandidates })
  const resolvedSrcCandidatesKey = JSON.stringify(resolvedSrcCandidates)
  const [srcCandidateIndex, setSrcCandidateIndex] = useState(0)
  const resolvedSrc = resolvedSrcCandidates[srcCandidateIndex]
  const resolvedAlt = alt ?? "Thumbnail image"

  useEffect(() => {
    setSrcCandidateIndex(0)
  }, [resolvedSrcCandidatesKey])

  const handleImageError: TThumbnailImageErrorHandler = (event) => {
    if (event) onError?.(event)
    setSrcCandidateIndex((currentIndex) => currentIndex + 1)
  }

  if (!resolvedSrc) return <>{fallback}</>

  const resolvedImageProps: TThumbnailImageRenderImageProps = {
    ...imageProps,
    alt: resolvedAlt,
    src: resolvedSrc,
    onError: handleImageError,
  }

  if (renderImage) {
    return (
      <>
        {renderImage({ alt: resolvedAlt, src: resolvedSrc, imageProps: resolvedImageProps, onError: handleImageError })}
      </>
    )
  }

  return createElement("img", resolvedImageProps)
}

export default ThumbnailImage
