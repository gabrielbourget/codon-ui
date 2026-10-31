import { useEffect, useRef, useState } from "react"

import { getNativeButtonContent } from "../Button/content"

import { NativeThumbnailImage } from "./NativeThumbnailImage"
import type {
  TNativeThumbnailImageErrorHandler,
  TNativeThumbnailImageProps,
  TNativeThumbnailImageRenderImageProps,
} from "./types"

const resolveCandidates = (
  src: TNativeThumbnailImageProps["src"],
  supplied: TNativeThumbnailImageProps["srcCandidates"],
) => {
  const candidates = supplied && supplied.length > 0 ? supplied : [src]
  for (const candidate of candidates)
    if (candidate !== null && candidate !== undefined && typeof candidate !== "string")
      throw new TypeError("ThumbnailImage: source candidates must be strings, null or undefined")
  return [...new Set(candidates.filter((candidate): candidate is string => !!candidate))]
}
type TAttempt = { key: string; index: number; active: boolean }

export const ThumbnailImage = (props: TNativeThumbnailImageProps) => {
  const {
    src,
    srcCandidates,
    alt: suppliedAlt,
    fallback,
    onError: _onError,
    renderImage,
    source: _source,
    children: _children,
    ...hostProps
  } = props
  const alt = suppliedAlt ?? "Thumbnail image"
  const candidates = resolveCandidates(src, srcCandidates)
  const key = JSON.stringify(candidates)
  const [sequence, setSequence] = useState({ key, index: 0 })
  const index = sequence.key === key ? sequence.index : 0
  if (sequence.key !== key) setSequence({ key, index: 0 })
  const attempt = useRef<TAttempt | undefined>(undefined)
  const mounted = useRef(true)
  const currentProps = useRef(props)
  currentProps.current = props
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  if (attempt.current?.key !== key || attempt.current.index !== index) {
    if (attempt.current) attempt.current.active = false
    attempt.current = { key, index, active: true }
  }
  const currentAttempt = attempt.current
  const selected = candidates[index]
  if (selected === undefined) {
    currentAttempt.active = false
    return <>{getNativeButtonContent(fallback)}</>
  }
  const handleError: TNativeThumbnailImageErrorHandler = (event) => {
    if (!mounted.current || !currentAttempt.active || attempt.current !== currentAttempt) return
    currentAttempt.active = false
    try {
      if (event) currentProps.current.onError?.(event)
    } catch (error) {
      if (attempt.current === currentAttempt) currentAttempt.active = true
      throw error
    }
    if (!mounted.current || attempt.current !== currentAttempt) return
    setSequence((current) => (current.key === key ? { key, index: current.index + 1 } : current))
  }
  const imageProps: TNativeThumbnailImageRenderImageProps = { ...hostProps, alt, src: selected, onError: handleError }
  return renderImage ? (
    <>{getNativeButtonContent(renderImage({ alt, src: selected, imageProps, onError: handleError }))}</>
  ) : (
    <NativeThumbnailImage key={JSON.stringify([selected, hostProps.srcSet])} {...imageProps} />
  )
}
