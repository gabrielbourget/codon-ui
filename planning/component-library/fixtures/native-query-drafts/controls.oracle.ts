import { deepStrictEqual, equal } from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { DEFAULT_SORT_AND_FILTER_PANEL_LABELS as canonical } from "../../../../packages/react/src/components/SortAndFilterPanel/labels.ts"
import { DEFAULT_QUERY_CONTROL_LABELS as native } from "../../../../packages/react-native/src/components/SortAndFilterPanel/controlLabels.ts"
const root = fileURLToPath(new URL("../../../../", import.meta.url))
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
let fields = 0
for (const [section, labels] of Object.entries(native))
  for (const [key, value] of Object.entries(labels)) {
    const original = (canonical as Record<string, Record<string, unknown>>)[section][key]
    if (typeof value === "function") {
      for (const criteriaName of ["", "City", "Événements\n長い名前"])
        for (const sortDirection of ["Ascending", "Descending"] as const)
          equal(value({ criteriaName, sortDirection }), (original as typeof value)({ criteriaName, sortDirection }))
    } else deepStrictEqual(value, original)
    fields++
  }
const paths: Record<string, string> = {
  ascending: "packages/react/src/components/Table/components/TableHeader/DefaultTableHeaderIcons.tsx",
  descending: "packages/react/src/components/Table/components/TableHeader/DefaultTableHeaderIcons.tsx",
  delete: "packages/react/src/components/Filtering/FilterClauseRow/DefaultDeleteIcon.tsx",
  grip: "packages/react/src/components/Table/components/TableRow/DefaultDragIndicatorIcon.tsx",
  close: "packages/react/src/components/SortAndFilterPanel/InternalComponents/PanelHeader/DefaultCloseIcon.tsx",
}
const nativeGlyphs = readFileSync(root + "packages/react-native/src/components/SortAndFilterPanel/glyphs.tsx", "utf8")
const glyphs: Record<string, unknown> = {}
for (const [kind, path] of Object.entries(paths)) {
  const original = execFileSync("git", ["show", "ddc9f066f67af4742e05e04bd870726141c44129:" + path], {
    cwd: root,
    encoding: "utf8",
  })
  equal(original, readFileSync(root + path, "utf8"))
  const code =
    kind === "ascending" || kind === "descending"
      ? original.split(
          "export const TableHeaderDefaultSort" + (kind === "ascending" ? "Ascending" : "Descending") + "Icon",
        )[1]
      : original
  const expected = code.match(/<path\s+(?:[^>]*?)d="([^"]+)"/s)![1]
  const actual = JSON.parse(nativeGlyphs.match(new RegExp(kind + ':\\s*("[^"]*")'))![1])
  equal(actual, expected)
  glyphs[kind] = { canonical: path, canonicalSHA256: sha(original), pathSHA256: sha(expected) }
}
const result = {
  kind: "DATA ONLY — exact canonical label/glyph mapping; no native pixels or delivery",
  labelsCompared: fields,
  formatterVectors: 6,
  glyphsCompared: 5,
  glyphs,
  nativeGlyphSourceSHA256: sha(nativeGlyphs),
  canonicalLabelsSHA256: sha(readFileSync(root + "packages/react/src/components/SortAndFilterPanel/labels.ts")),
  nativeLabelsSHA256: sha(
    readFileSync(root + "packages/react-native/src/components/SortAndFilterPanel/controlLabels.ts"),
  ),
}
const output = process.env.CODON_QUERY_CONTROLS_ORACLE_OUTPUT
if (!output?.startsWith("/private/tmp/codon-native-query-controls-"))
  throw new Error("Use a mutable task-owned oracle output")
writeFileSync(output, JSON.stringify(result, null, 2) + "\n")
console.log("PASS", fields, "canonical label fields, six formatter vectors and five original glyph paths")
