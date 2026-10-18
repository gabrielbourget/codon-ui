import { getNativeFloatingPlacement, type TNativeFloatingPlacementInput } from "../placement"

import oracle from "./fixtures/margin-oracle.json"

it.each(oracle.cases)("matches pinned margin-box positioning for $id", ({ input, expected }) => {
  const result = getNativeFloatingPlacement(input as TNativeFloatingPlacementInput)
  expect(result?.placement).toBe(expected.placement)
  for (const key of ["x", "y", "width", "height"] as const)
    expect(result?.frame[key]).toBeCloseTo(expected.frame[key], 6)
  expect(result?.maxHeight).toBeCloseTo(expected.maxHeight, 6)
  expect(result?.arrowCrossOffset).toBeCloseTo(expected.arrowCrossOffset, 6)
  expect(result?.anchorPoint.x).toBeCloseTo(expected.anchorPoint.x, 6)
  expect(result?.anchorPoint.y).toBeCloseTo(expected.anchorPoint.y, 6)
  for (const key of ["top", "right", "bottom", "left"] as const) {
    if (expected.positionStyle[key] === undefined) expect(result?.positionStyle[key]).toBeUndefined()
    else expect(result?.positionStyle[key]).toBeCloseTo(expected.positionStyle[key]!, 6)
  }
})
