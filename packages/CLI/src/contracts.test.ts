import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  addDryRunSchema,
  CLI_JSON_REPORT_SCHEMA_NAMES,
  cliJsonReportSchemas,
  dependencyInstallPlanSchema,
  statusReportSchema,
  type TCliJsonReportSchemaName,
} from "./contracts"
import { HELPER_FILE_MARKER_REGEX } from "./helpers/constants/cli"
import {
  CONSUMER_TARGET_ROLE__THEME,
  CONSUMER_TARGET_ROLE__TOKENS,
  DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH,
  DEFAULT_REGISTRY_CONTAINED_TARGET_PATHS,
} from "./helpers/consumerContract"

const cliPackageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  bin: Record<string, string>
  files: string[]
  publishConfig: {
    access: string
  }
  scripts: Record<string, string>
  version: string
}

const expectedSchemaNames = [
  "initAdvisory",
  "initDryRun",
  "initStrict",
  "addAdvisory",
  "addDryRun",
  "addStrict",
  "status",
  "diff",
  "updateAdvisory",
  "updateAllAdvisory",
  "updateDryRun",
  "updateAllDryRun",
  "updateStrict",
  "updateAllStrict",
  "removeAdvisory",
  "removeDryRun",
  "removeStrict",
  "delete",
  "ejectAdvisory",
  "ejectDryRun",
  "ejectStrict",
] satisfies TCliJsonReportSchemaName[]

assert.deepEqual(cliPackageJson.bin, {
  "codon-ui": "./dist/index.js",
  cui: "./dist/index.js",
  codonui: "./dist/index.js",
})
assert.equal(cliPackageJson.version, "0.1.0")
assert.deepEqual(cliPackageJson.files, ["dist"])
assert.deepEqual(cliPackageJson.publishConfig, { access: "restricted" })
assert.equal(
  cliPackageJson.scripts["pack:check"],
  "pnpm build && node scripts/verify-pack-source.mjs && npm pack --dry-run",
)
assert.equal(cliPackageJson.scripts["pack:dry-run"], "pnpm build && npm pack --dry-run")
assert.equal(cliPackageJson.scripts.prepack, "node scripts/prepare-pack-source.mjs")
assert.equal(cliPackageJson.scripts.postpack, "node scripts/cleanup-pack-source.mjs")
assert.equal(cliPackageJson.scripts.prepublishOnly, "pnpm pack:check && pnpm release:check")
assert.deepEqual(CLI_JSON_REPORT_SCHEMA_NAMES, expectedSchemaNames)
assert.equal(cliJsonReportSchemas.addDryRun, addDryRunSchema)
assert.equal(cliJsonReportSchemas.status, statusReportSchema)
assert.equal(typeof dependencyInstallPlanSchema.safeParse, "function")
assert.equal(DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH, "src/components/_codon-ui-registry")
assert.equal(
  DEFAULT_REGISTRY_CONTAINED_TARGET_PATHS[CONSUMER_TARGET_ROLE__THEME],
  DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH,
)
assert.equal(
  DEFAULT_REGISTRY_CONTAINED_TARGET_PATHS[CONSUMER_TARGET_ROLE__TOKENS],
  `${DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH}/tokens`,
)

for (const schemaName of CLI_JSON_REPORT_SCHEMA_NAMES) {
  assert.equal(typeof cliJsonReportSchemas[schemaName].safeParse, "function")
}

assert.equal(HELPER_FILE_MARKER_REGEX.test("// codon-ui-helper-file-marker"), true)
assert.equal(HELPER_FILE_MARKER_REGEX.test("// amino-ui-helper-file-marker"), false)
