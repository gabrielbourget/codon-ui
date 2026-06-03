export type TStepperLabels = {
  inputButtonGroupAriaLabel: string
}

export type TPartialStepperLabels = Partial<TStepperLabels>

export const DEFAULT_STEPPER_LABELS: TStepperLabels = {
  inputButtonGroupAriaLabel: "Stepper Input Button Group",
}

export const resolveStepperLabels = (labels?: TPartialStepperLabels): TStepperLabels => ({
  ...DEFAULT_STEPPER_LABELS,
  ...labels,
})
