import { useCallback, useEffect, useRef, useState } from "react"

export type TNativeCarouselDotsWindowInput = Readonly<{
  selectedIndex: number
  itemCount: number
  largeZoneCount: number
  neighbors: number
  minPinned: number
  maxStart: number
  initialWindowStart: number
}>

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value))

export const useNativeCarouselDotsWindow = (input: TNativeCarouselDotsWindowInput) => {
  const { selectedIndex, itemCount, largeZoneCount, neighbors, minPinned, maxStart, initialWindowStart } = input
  const [windowStart, setWindowStart] = useState(initialWindowStart)
  const [noTransition, setNoTransition] = useState(false)
  const previousSelection = useRef(selectedIndex)
  const lastDirection = useRef<1 | -1 | 0>(0)
  const flipCooldown = useRef(0)
  const firstFrame = useRef<number | undefined>(undefined)
  const secondFrame = useRef<number | undefined>(undefined)
  const frameGeneration = useRef(0)
  const mounted = useRef(false)
  const retireFrames = useCallback(() => {
    frameGeneration.current += 1
    if (firstFrame.current !== undefined) cancelAnimationFrame(firstFrame.current)
    if (secondFrame.current !== undefined) cancelAnimationFrame(secondFrame.current)
    firstFrame.current = undefined
    secondFrame.current = undefined
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      retireFrames()
    }
  }, [retireFrames])

  useEffect(() => {
    retireFrames()
    setNoTransition(false)
  }, [itemCount, largeZoneCount, neighbors, minPinned, maxStart, retireFrames])

  const delta = selectedIndex - previousSelection.current
  const currDir: 1 | -1 | 0 = delta > 0 ? 1 : delta < 0 ? -1 : lastDirection.current
  const wrappedThisRender = itemCount > 1 && (delta === itemCount - 1 || delta === -(itemCount - 1))
  if (lastDirection.current !== 0 && currDir !== 0 && currDir !== lastDirection.current) flipCooldown.current = 2

  useEffect(() => {
    if (wrappedThisRender) {
      const target = selectedIndex <= minPinned ? 0 : maxStart
      if (windowStart !== target) setWindowStart(target)
      retireFrames()
      setNoTransition(true)
      const generation = frameGeneration.current
      firstFrame.current = requestAnimationFrame(() => {
        if (!mounted.current || frameGeneration.current !== generation) return
        firstFrame.current = undefined
        secondFrame.current = requestAnimationFrame(() => {
          if (!mounted.current || frameGeneration.current !== generation) return
          secondFrame.current = undefined
          setNoTransition(false)
        })
      })
      previousSelection.current = selectedIndex
      if (delta !== 0) lastDirection.current = currDir
      return
    }
    if (selectedIndex <= minPinned) {
      if (windowStart !== 0) setWindowStart(0)
    } else if (selectedIndex >= itemCount - minPinned - 1) {
      if (windowStart !== maxStart) setWindowStart(maxStart)
    } else {
      const zoneStart = windowStart + neighbors
      const zoneEnd = zoneStart + (largeZoneCount - 1)
      if (flipCooldown.current === 0) {
        if (currDir > 0 && selectedIndex >= zoneStart && selectedIndex <= zoneEnd) {
          const target = clamp(selectedIndex - (largeZoneCount - 1) - neighbors, maxStart)
          if (target !== windowStart) setWindowStart(target)
        } else if (currDir < 0 && selectedIndex >= zoneStart && selectedIndex <= zoneEnd) {
          const target = clamp(selectedIndex - neighbors, maxStart)
          if (target !== windowStart) setWindowStart(target)
        }
      }
      if (selectedIndex > zoneEnd) setWindowStart(clamp(selectedIndex - (largeZoneCount - 1) - neighbors, maxStart))
      else if (selectedIndex < zoneStart) setWindowStart(clamp(selectedIndex - neighbors, maxStart))
    }
    previousSelection.current = selectedIndex
    if (delta !== 0) {
      lastDirection.current = currDir
      if (flipCooldown.current > 0) flipCooldown.current -= 1
    }
  }, [
    selectedIndex,
    itemCount,
    windowStart,
    largeZoneCount,
    neighbors,
    minPinned,
    maxStart,
    wrappedThisRender,
    currDir,
    delta,
    retireFrames,
  ])

  useEffect(() => {
    if (windowStart > maxStart) setWindowStart(maxStart)
  }, [windowStart, maxStart])

  return {
    windowStart,
    setWindowStart,
    noTransition,
    wrappedThisRender,
    currDir,
    isFlipCooldownActive: flipCooldown.current > 0,
  }
}
