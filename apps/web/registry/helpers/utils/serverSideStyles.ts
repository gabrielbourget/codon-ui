// codon-ui-helper-file-marker

// --------- //
// - TYPES - //
// --------- //

type TPrimaryColor = {
  primary_p4: string
  primary_p3: string
  primary_p2: string
  primary_p1: string
  primary: string
  primary_m1: string
  primary_m2: string
}

type TSecondaryColor = {
  secondary_p4: string
  secondary_p3: string
  secondary_p2: string
  secondary_p1: string
  secondary: string
  secondary_m1: string
  secondary_m2: string
}

type TTertiaryColor = {
  tertiary_p4: string
  tertiary_p3: string
  tertiary_p2: string
  tertiary_p1: string
  tertiary: string
  tertiary_m1: string
  tertiary_m2: string
}

type TQuaternaryColor = {
  quaternary_p4: string
  quaternary_p3: string
  quaternary_p2: string
  quaternary_p1: string
  quaternary: string
  quaternary_m1: string
  quaternary_m2: string
}

type TQuintenaryColor = {
  quintenary_p4: string
  quintenary_p3: string
  quintenary_p2: string
  quintenary_p1: string
  quintenary: string
  quintenary_m1: string
  quintenary_m2: string
}

type TGrayScale = {
  white: string
  grey1: string
  grey2: string
  grey3: string
  grey4: string
  grey5: string
  grey6: string
  grey7: string
  grey8: string
  almost_black: string
  black: string
}

type TThemePaletteVariants = {
  foreground: string
  background: string
  neutral_1: string
  neutral_2: string
  neutral_3: string
  neutral_4: string
  neutral_5: string
  neutral_6: string
  neutral_7: string
  neutral_8: string
  errorOrDangerState: string
  color: string
  shadow_1: string
  shadow_2: string
  shadow_3: string
  shadow_4: string
  shadow_5: string
  drop_shadow_1: string
}

export type TPalette = {
  white: string
  grey1: string
  grey2: string
  grey3: string
  grey4: string
  grey5: string
  grey6: string
  grey7: string
  grey8: string
  almost_black: string
  black: string
  warningState: string
  successState: string
  primary_p4: string
  primary_p3: string
  primary_p2: string
  primary_p1: string
  primary: string
  primary_m1: string
  primary_m2: string
  secondary_p4: string
  secondary_p3: string
  secondary_p2: string
  secondary_p1: string
  secondary: string
  secondary_m1: string
  secondary_m2: string
  tertiary_p4: string
  tertiary_p3: string
  tertiary_p2: string
  tertiary_p1: string
  tertiary: string
  tertiary_m1: string
  tertiary_m2: string
  quaternary_p4: string
  quaternary_p3: string
  quaternary_p2: string
  quaternary_p1: string
  quaternary: string
  quaternary_m1: string
  quaternary_m2: string
  quintenary_p4: string
  quintenary_p3: string
  quintenary_p2: string
  quintenary_p1: string
  quintenary: string
  quintenary_m1: string
  quintenary_m2: string
  light: TThemePaletteVariants
  dark: TThemePaletteVariants
}

// ----------------- //
// - VARIABLE SETS - //
// ----------------- //

export const primaryColor: TPrimaryColor = {
  primary_p4: "#f6e7fd",
  primary_p3: "#ECCCFC",
  primary_p2: "#d289f6",
  primary_p1: "#ad2aee",
  primary: "#9611d8",
  primary_m1: "#730da5",
  primary_m2: "#520976",
}

export const secondaryColor: TSecondaryColor = {
  secondary_p4: "#bdf4ef",
  secondary_p3: "#65e6d9",
  secondary_p2: "#39dfce",
  secondary_p1: "#20c6b5",
  secondary: "#189689",
  secondary_m1: "#126e64",
  secondary_m2: "#0b423c",
}

export const tertiaryColor: TTertiaryColor = {
  tertiary_p4: "#e9fcf1",
  tertiary_p3: "#91eeb8",
  tertiary_p2: "#39e07f",
  tertiary_p1: "#1fc665",
  tertiary: "#17934b",
  tertiary_m1: "#116e38",
  tertiary_m2: "#0a4222",
}

export const quaternaryColor: TQuaternaryColor = {
  quaternary_p4: "#eae9fc",
  quaternary_p3: "#9590ef",
  quaternary_p2: "#6a63e8",
  quaternary_p1: "#4037e2",
  quaternary: "#261dc6",
  quaternary_m1: "#1e179c",
  quaternary_m2: "#15106f",
}

export const quintenaryColor: TQuintenaryColor = {
  quintenary_p4: "#FFFFFF",
  quintenary_p3: "#FFFFFF",
  quintenary_p2: "#FFFFFF",
  quintenary_p1: "#FFFFFF",
  quintenary: "#EFF6F9",
  quintenary_m1: "#D6DDE0",
  quintenary_m2: "#BDC4C7",
}

export const greyScale: TGrayScale = {
  white: "#FFF",
  grey1: "#efefef",
  grey2: "#C6C6C6",
  grey3: "#9E9E9E",
  grey4: "#878787",
  grey5: "#707070",
  grey6: "#474747",
  grey7: "#3D3D3D",
  grey8: "#2C2C2C",
  almost_black: "#171717",
  black: "#000",
}

export const otherColors: Record<string, string> = {
  TWITTER_BLUE: "#1DA1F2",
  FACEBOOK_BLUE: "#4267B2",
  SOUNDCLOUD_ORANGE: "#FF3C03",
  APPLE_MUSIC_RED: "#FA2E48",
  BANDCAMP_TURQUOISE: "#1AA1C2",
  SPOTIFY_GREEN: "#1CD760",
  BEATPORT_GREEN: "#A8E00F",
  MAP_MARKER_RED: "#EA4435",
}

const light = {
  foreground: greyScale.black,
  background: greyScale.white,
  neutral_1: greyScale.grey1,
  neutral_2: greyScale.grey2,
  neutral_3: greyScale.grey3,
  neutral_4: greyScale.grey4,
  neutral_5: greyScale.grey5,
  neutral_6: greyScale.grey6,
  neutral_7: greyScale.grey7,
  neutral_8: greyScale.grey8,
  errorOrDangerState: "#B73434",
  color: greyScale.black,

  shadow_1: "0 2px 3px rgba(0,0,0,0.12), 0 2px 2px rgba(0,0,0,0.24)",
  shadow_2: "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)",
  shadow_3: "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
  shadow_4: "0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)",
  shadow_5: "0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)",
  drop_shadow_1: "drop-shadow(0px 2px 3px rgb(0 0 0 / 0.12))",
}

const dark = {
  foreground: greyScale.white,
  background: greyScale.almost_black,
  neutral_1: greyScale.grey8,
  neutral_2: greyScale.grey7,
  neutral_3: greyScale.grey6,
  neutral_4: greyScale.grey5,
  neutral_5: greyScale.grey4,
  neutral_6: greyScale.grey3,
  neutral_7: greyScale.grey2,
  neutral_8: greyScale.grey1,
  errorOrDangerState: "#fc2f20",
  color: greyScale.white,

  shadow_1: "0 2px 3px rgba(255,255,255,35%), 0 2px 3.5px rgba(255,255,255,24%)",
  shadow_2: "0 3px 6px rgba(255,255,255,16%), 0 3px 6px rgba(255,255,255,23%)",
  shadow_3: "0 10px 20px rgba(255,255,255,19%), 0 6px 6px rgba(255,255,255,23%)",
  shadow_4: "0 14px 28px rgba(255,255,255,25%), 0 10px 10px rgba(255,255,255,22%)",
  shadow_5: "0 19px 38px rgba(255,255,255,30%), 0 15px 12px rgba(255,255,255,22%)",
  drop_shadow_1: "drop-shadow(0 2px 3px rgb(255 255 255 / 0.35))",
}

export const palette: TPalette = {
  ...greyScale,
  ...otherColors,
  warningState: "#e8af20",
  successState: "#319606",
  ...primaryColor,
  ...secondaryColor,
  ...tertiaryColor,
  ...quaternaryColor,
  ...quintenaryColor,
  light,
  dark,
}
