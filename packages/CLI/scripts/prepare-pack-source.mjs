import path from "node:path"
import { fileURLToPath } from "node:url"

import { preparePackSource, readRequiredRegistryFileNames } from "./pack-source.mjs"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const result = preparePackSource({
  packageRoot,
  repoRoot: path.resolve(packageRoot, "../.."),
  requiredFileNames: ["local-native.registry.json", ...readRequiredRegistryFileNames(process.argv.slice(2))],
})

console.log(
  `[codon-ui-cli-pack] prepared ${result.snapshotFileNames.length} registry snapshot(s) and ${result.sourceFileCount} source file(s).`,
)
