// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { progress } from "../../../../utils/index"
import { mixNumber } from "../../../utils/mix/number"

export function fillOffset(offset: number[], remaining: number): void {
  const min = offset[offset.length - 1]
  for (let i = 1; i <= remaining; i++) {
    const offsetProgress = progress(0, remaining, i)
    offset.push(mixNumber(min, 1, offsetProgress))
  }
}
