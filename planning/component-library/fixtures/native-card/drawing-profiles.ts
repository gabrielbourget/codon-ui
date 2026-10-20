import type { ViewStyle } from "react-native"

export type TDrawingProfile = {
  name: string
  control: "plain" | "border" | "outline" | "outer-shadow" | "inset-shadow"
  style: ViewStyle
  numeric: boolean
  defaultRaised?: boolean
}

const profiles: TDrawingProfile[] = []
for (const curve of ["circular", "continuous"] as const) {
  const base: ViewStyle = { borderRadius: 16, borderCurve: curve, backgroundColor: "#e0e8f0" }
  profiles.push({ name: `solid-${curve}`, control: "plain", style: base, numeric: true })
  profiles.push({
    name: `native-border-${curve}`,
    control: "border",
    style: { ...base, borderWidth: 3, borderColor: "#102030", overflow: "hidden" },
    numeric: true,
  })
  profiles.push({
    name: `outline-${curve}`,
    control: "outline",
    style: { ...base, outlineWidth: 2, outlineOffset: 1, outlineColor: "#8090a0" },
    numeric: true,
  })
  profiles.push({
    name: `asymmetric-${curve}`,
    control: "border",
    style: {
      ...base,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: 5,
      borderBottomRightRadius: 22,
      borderTopWidth: 2,
      borderRightWidth: 5,
      borderBottomWidth: 7,
      borderLeftWidth: 3,
      borderTopColor: "#ff0000",
      borderRightColor: "#00ff00",
      borderBottomColor: "#0000ff",
      borderLeftColor: "#ffff00",
    },
    numeric: true,
  })
  for (const inset of [false, true])
    profiles.push({
      name: `${inset ? "inset" : "outer"}-${curve}`,
      control: inset ? "inset-shadow" : "outer-shadow",
      style: {
        ...base,
        boxShadow: [{ offsetX: 2, offsetY: 2, blurRadius: 4, spreadDistance: 1, color: "rgba(0,0,0,0.6)", inset }],
      },
      numeric: true,
    })
  for (const borderStyle of ["dashed", "dotted"] as const)
    profiles.push({
      name: `${borderStyle}-${curve}`,
      control: "border",
      style: { ...base, borderWidth: 3, borderColor: "#102030", borderStyle },
      numeric: true,
    })
  profiles.push({
    name: `percentage-${curve}`,
    control: "plain",
    style: { ...base, borderRadius: "25%" },
    numeric: false,
  })
}
profiles.push({
  name: "raised-default",
  control: "outer-shadow",
  style: {
    borderRadius: 10,
    backgroundColor: "#e0e8f0",
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.12)" },
      { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.24)" },
    ],
  },
  numeric: true,
  defaultRaised: true,
})

export const DRAWING_PAIRS = profiles.flatMap((profile) =>
  (profile.numeric ? (["authored", "identity"] as const) : (["authored"] as const)).map((mode) => ({ profile, mode })),
)
export const DRAWING_STEPS = DRAWING_PAIRS.flatMap((pair, pairIndex) =>
  (["calibration", "owned"] as const).map((kind) => ({ ...pair, pairIndex, kind })),
)

export const identityRadii = (style: ViewStyle) => {
  const radius = style.borderRadius ?? 0
  const corner = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error("Numeric identity radius required")
    return { x: value, y: value }
  }
  return JSON.stringify({
    topLeft: corner(style.borderTopLeftRadius ?? radius),
    topRight: corner(style.borderTopRightRadius ?? radius),
    bottomLeft: corner(style.borderBottomLeftRadius ?? radius),
    bottomRight: corner(style.borderBottomRightRadius ?? radius),
  })
}
