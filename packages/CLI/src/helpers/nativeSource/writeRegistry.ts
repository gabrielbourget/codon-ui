import path from "node:path"
import { fileURLToPath } from "node:url"

import { writeNativeRegistry } from "./registry"
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
console.log(await writeNativeRegistry(root))
