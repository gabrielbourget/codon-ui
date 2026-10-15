export const AVAILABLE_LAYOUT_FIXTURES = ["live", "compact", "expanded", "vertical-block", "horizontal-block"] as const
export type TLayoutFixture = (typeof AVAILABLE_LAYOUT_FIXTURES)[number]

export const LAYOUT_FIXTURE_LABELS: Record<TLayoutFixture, string> = {
  live: "Live window",
  compact: "Compact width",
  expanded: "Expanded width",
  "vertical-block": "Vertical blocked region",
  "horizontal-block": "Horizontal blocked region",
}
