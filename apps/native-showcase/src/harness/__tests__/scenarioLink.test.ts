import { parseShowcaseLink } from "../scenarioLink"

it("selects existing scene IDs and retains unspecified configuration", () => {
  for (const scene of ["foundation", "library", "avatar", "form-document", "search", "compact-search", "temporal"])
    expect(parseShowcaseLink(`codon-showcase://scenario/${scene}`)).toEqual({ scene, reset: false })
})

it("parses an explicit repeatable scenario with theme, fixture and focused controls", () => {
  expect(
    parseShowcaseLink("codon-showcase://scenario/avatar?theme=dark&fixture=compact&controls=hidden&reset=1"),
  ).toEqual({ scene: "avatar", theme: "dark", fixture: "compact", controls: "hidden", reset: true })
  expect(
    parseShowcaseLink("codon-showcase://scenario/library?fixture=vertical%2Dblock&controls=shown&reset=0"),
  ).toEqual({
    scene: "library",
    fixture: "vertical-block",
    controls: "shown",
    reset: false,
  })
})

it.each([
  "https://example.com/scenario/avatar",
  "exp+codon-native-showcase://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081",
  "codon-showcase://scenario/unknown",
  "codon-showcase://scenario/avatar/extra",
  "codon-showcase://scenario/avatar#reset=1",
  "codon-showcase://scenario/avatar?theme=unknown",
  "codon-showcase://scenario/avatar?fixture=unknown",
  "codon-showcase://scenario/avatar?controls=unknown",
  "codon-showcase://scenario/avatar?reset=true",
  "codon-showcase://scenario/avatar?theme=dark&theme=light",
  "codon-showcase://scenario/avatar?theme=dark&%74heme=light",
  "codon-showcase://scenario/avatar?theme=dark=light",
  "codon-showcase://scenario/avatar?unknown=1",
  "codon-showcase://scenario/avatar?theme",
  "codon-showcase://scenario/avatar?theme=%",
  "codon-showcase://scenario/%",
])("rejects an unsupported or malformed request atomically: %s", (url) => {
  expect(parseShowcaseLink(url)).toBeNull()
})
