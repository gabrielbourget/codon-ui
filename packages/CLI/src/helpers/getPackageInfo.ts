import path from "path"

import fs from "fs-extra"
import { type PackageJson } from "type-fest"

export const getPackageInfo = () => {
  const packageJSONPath = path.join("package.json")

  return fs.readJSONSync(packageJSONPath) as PackageJson
}
