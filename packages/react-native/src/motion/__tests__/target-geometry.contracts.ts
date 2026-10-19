import type { View } from "react-native"

import { readNativeMotionTargetGeometry } from "../measurement/targetGeometry"
import type { TNativeMotionResolutionToken } from "../value"

declare const owner: View, target: View, token: TNativeMotionResolutionToken

export const geometry = readNativeMotionTargetGeometry(owner, target, token)
// @ts-expect-error Geometry must come from an actual native ref.
readNativeMotionTargetGeometry(owner, { x: 0, y: 0, width: 100, height: 100 }, token)
// @ts-expect-error An owner cancellation lease is required.
readNativeMotionTargetGeometry(owner, target)
