import { useEffect, useRef, useState } from "react"
import { Image, type ImageLoadEvent } from "react-native"

import {
  getNativeThumbnailGeometry,
  getNativeThumbnailMetadataCandidates,
  isNativeThumbnailDimensions,
  type TNativeThumbnailDimensions,
} from "./geometry"
import type { TNativeThumbnailImageRenderImageProps } from "./types"

export const NativeThumbnailImage = (props: TNativeThumbnailImageRenderImageProps) => {
  const {
    alt,
    src,
    onError,
    onLoad,
    onLoadStart,
    onLoadEnd,
    onProgress,
    onPartialLoad,
    onLayout,
    "aria-label": aliasLabel,
    accessibilityLabel,
    accessible,
    "aria-labelledby": aliasLabelledBy,
    accessibilityLabelledBy,
    "data-testid": aliasID,
    testID,
    style: _style,
    ...rest
  } = props
  const [natural, setNatural] = useState<TNativeThumbnailDimensions>()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const geometry = getNativeThumbnailGeometry(props, natural)
  const { srcSet, crossOrigin, referrerPolicy } = props
  useEffect(() => {
    if (srcSet === undefined || !geometry.needsIntrinsic || natural !== undefined) return
    let active = true
    const headers: Record<string, string> = {}
    if (crossOrigin === "use-credentials") headers["Access-Control-Allow-Credentials"] = "true"
    if (referrerPolicy !== undefined) headers["Referrer-Policy"] = referrerPolicy
    void (async () => {
      for (const uri of getNativeThumbnailMetadataCandidates(src, srcSet)) {
        try {
          const size = Object.keys(headers).length
            ? await Image.getSizeWithHeaders(uri, headers)
            : await Image.getSize(uri)
          if (!active) return
          if (!isNativeThumbnailDimensions(size)) continue
          setNatural({ width: size.width, height: size.height })
          return
        } catch {
          if (!active) return
        }
      }
      // Give core Image a frame to deliver its genuine load/error event; metadata errors never fabricate callbacks.
      if (active) setNatural({ width: 1, height: 1 })
    })()
    return () => {
      active = false
    }
  }, [src, srcSet, crossOrigin, referrerPolicy, geometry.needsIntrinsic, natural])
  const guard = <TArgs extends unknown[]>(callback: ((...args: TArgs) => void) | undefined) =>
    callback
      ? (...args: TArgs) => {
          if (mounted.current) callback(...args)
        }
      : undefined
  const handleLoad = (event: ImageLoadEvent) => {
    if (!mounted.current) return
    const size = event.nativeEvent.source
    if (isNativeThumbnailDimensions(size)) {
      const { width, height } = size
      setNatural((current) => (current?.width === width && current.height === height ? current : { width, height }))
    }
    onLoad?.(event)
  }
  const label = accessibilityLabel ?? aliasLabel ?? alt
  const labelledBy = accessibilityLabelledBy ?? aliasLabelledBy
  const associatedLabel = Array.isArray(labelledBy) ? labelledBy.length > 0 : !!labelledBy
  return (
    <Image
      {...rest}
      src={src}
      alt={undefined}
      accessibilityLabel={label}
      accessibilityLabelledBy={labelledBy}
      accessible={accessible ?? (label !== "" || associatedLabel)}
      testID={testID ?? aliasID}
      style={geometry.style}
      resizeMode={props.resizeMode ?? geometry.style.resizeMode ?? "stretch"}
      resizeMethod={props.resizeMethod ?? "scale"}
      fadeDuration={props.fadeDuration ?? 0}
      onLoad={handleLoad}
      onError={(event) => {
        if (mounted.current) onError(event)
      }}
      onLoadStart={guard(onLoadStart)}
      onLoadEnd={guard(onLoadEnd)}
      onProgress={guard(onProgress)}
      onPartialLoad={guard(onPartialLoad)}
      onLayout={guard(onLayout)}
    />
  )
}
