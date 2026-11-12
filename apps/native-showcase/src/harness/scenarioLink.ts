import { AVAILABLE_LAYOUT_FIXTURES, type TLayoutFixture } from "../fixtures/layout"

export const SHOWCASE_LINK_PREFIX = "codon-showcase://scenario/"

export const AVAILABLE_SHOWCASE_SCENES = [
  "foundation",
  "form-document",
  "library",
  "controls",
  "select",
  "combo-box",
  "multiline",
  "number",
  "overlay",
  "range",
  "display",
  "loading",
  "toggle",
  "avatar",
  "tag",
  "tag-group",
  "tag-combo-box",
  "carousel",
  "panel",
  "sort-filter",
  "table",
  "card",
  "link",
  "thumbnail",
  "gallery",
  "stepper",
  "slider",
  "field",
  "search",
  "compact-search",
  "circular",
  "tooltip",
  "popover",
  "breadcrumbs",
  "pagination",
  "toaster",
  "menu",
] as const

export type TShowcaseScene = (typeof AVAILABLE_SHOWCASE_SCENES)[number]
export type TShowcaseRequest = {
  scene: TShowcaseScene
  theme?: "light" | "dark"
  fixture?: TLayoutFixture
  controls?: "shown" | "hidden"
  reset: boolean
}

const isMember = <T extends string>(values: readonly T[], value: string): value is T => values.includes(value as T)

export const parseShowcaseLink = (url: string): TShowcaseRequest | null => {
  // The pinned RN URL host/path implementation handles HTTP(S), not this custom scheme.
  const match = /^codon-showcase:\/\/scenario\/([^/?#]+)(?:\?([^#]*))?$/.exec(url)
  if (!match) return null
  try {
    const scene = decodeURIComponent(match[1])
    if (!isMember(AVAILABLE_SHOWCASE_SCENES, scene)) return null
    const options = new Map<string, string>()
    for (const entry of match[2] ? match[2].split("&") : []) {
      const pair = /^([^=]+)=([^=]*)$/.exec(entry)
      if (!pair) return null
      const key = decodeURIComponent(pair[1].replace(/\+/g, " "))
      const value = decodeURIComponent(pair[2].replace(/\+/g, " "))
      if (!isMember(["theme", "fixture", "controls", "reset"], key) || options.has(key)) return null
      options.set(key, value)
    }
    const theme = options.get("theme")
    const fixture = options.get("fixture")
    const controls = options.get("controls")
    const reset = options.get("reset")
    if (theme !== undefined && theme !== "light" && theme !== "dark") return null
    if (fixture !== undefined && !isMember(AVAILABLE_LAYOUT_FIXTURES, fixture)) return null
    if (controls !== undefined && controls !== "shown" && controls !== "hidden") return null
    if (reset !== undefined && reset !== "0" && reset !== "1") return null
    return {
      scene,
      reset: reset === "1",
      ...(theme === undefined ? {} : { theme }),
      ...(fixture === undefined ? {} : { fixture }),
      ...(controls === undefined ? {} : { controls }),
    }
  } catch {
    return null
  }
}
