export type TFilterEditorLabels = {
  label: string
  placeholder: string
  booleanLabel: string
  minValueLabel: string
  minValuePlaceholder: string
  maxValueLabel: string
  maxValuePlaceholder: string
  addMultiInputItemButtonAriaLabel: string
  deleteMultiInputItemButtonAriaLabel: string
  multiInputItemAriaLabel: (args: { index: number }) => string
  multiInputItemPlaceholder: (args: { position: number }) => string
}

export const DEFAULT_FILTER_EDITOR_LABELS: TFilterEditorLabels = {
  label: "Filter Argument",
  placeholder: "Filter Argument",
  booleanLabel: "Filter Argument",
  minValueLabel: "Min Value",
  minValuePlaceholder: "Enter min value",
  maxValueLabel: "Max Value",
  maxValuePlaceholder: "Enter max value",
  addMultiInputItemButtonAriaLabel: "Add Filter Argument Entry",
  deleteMultiInputItemButtonAriaLabel: "Delete Filter Entry",
  multiInputItemAriaLabel: ({ index }) => `Filter Argument ${index}`,
  multiInputItemPlaceholder: ({ position }) => `Filter Argument Entry #${position}`,
}
