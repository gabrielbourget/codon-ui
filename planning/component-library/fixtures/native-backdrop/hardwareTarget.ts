import { requireNativeComponent } from "react-native"

import { createHardwareCaptureFixture, type THardwareTargetProps } from "./HardwareCapture"

export const hardwareCaptureFixture = createHardwareCaptureFixture(
  requireNativeComponent<THardwareTargetProps>("CUIBackdropHardwareTarget"),
)
