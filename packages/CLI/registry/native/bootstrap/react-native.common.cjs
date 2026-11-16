const path = require("node:path")
const config = require("./codon-ui.config.json")
const utils = config.paths?.roles?.utils ?? (config.paths?.registry ?? "src/components/_codon-ui-registry") + "/utils"
module.exports = { dependencies: { "@codon-ui/react-native": { root: path.resolve(__dirname, utils, "native") } } }
