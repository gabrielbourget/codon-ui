import { screen } from "@testing-library/react"

import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../../tokens/theme-order"
import {
  COLOR_MODE__FILL,
  COLOR_MODE__OUTLINE,
  STEPPER_TYPE__COHESIVE,
  STEPPER_TYPE__SEGMENTED,
  type TAvailableColorModes,
  type TAvailableStepperTypes,
} from "../helpers"

export type TStepperTestInfo = {
  colorMode: TAvailableColorModes
  stepperType: TAvailableStepperTypes
  themingOrder?: TThemingOrderCode
}

export const getStepperButtons = () => [
  screen.getByRole("button", { name: "Decrease stepper" }),
  screen.getByRole("button", { name: "Increase stepper" }),
]

export const stepperColorModeTestData: TStepperTestInfo[] = [
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__PRIMARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
  { colorMode: COLOR_MODE__OUTLINE, stepperType: STEPPER_TYPE__COHESIVE, themingOrder: undefined },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__PRIMARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
]

export const stepperThemingOrderTestData: TStepperTestInfo[] = [
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__PRIMARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__COHESIVE,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__PRIMARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__FILL,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__PRIMARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__SECONDARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__TERTIARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__QUATERNARY,
  },
  {
    colorMode: COLOR_MODE__OUTLINE,
    stepperType: STEPPER_TYPE__SEGMENTED,
    themingOrder: THEME_ORDER_CODE__QUINTENARY,
  },
]
