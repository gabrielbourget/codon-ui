import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
const config = JSON.parse(readFileSync(new URL("./codon-ui.config.json", import.meta.url), "utf8"))
const utils = config.paths?.roles?.utils ?? (config.paths?.registry ?? "src/components/_codon-ui-registry") + "/utils"
export default { dependencies: { "@codon-ui/react-native": { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), utils, "native") } } }
