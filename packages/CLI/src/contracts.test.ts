import assert from "node:assert/strict"

import {
  addDryRunSchema,
  CLI_JSON_REPORT_SCHEMA_NAMES,
  cliJsonReportSchemas,
  dependencyInstallPlanSchema,
  statusReportSchema,
  type TCliJsonReportSchemaName,
} from "./contracts"
import { HELPER_FILE_MARKER_REGEX } from "./helpers/constants/cli"

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

assert.deepEqual(CLI_JSON_REPORT_SCHEMA_NAMES, expectedSchemaNames)
assert.equal(cliJsonReportSchemas.addDryRun, addDryRunSchema)
assert.equal(cliJsonReportSchemas.status, statusReportSchema)
assert.equal(typeof dependencyInstallPlanSchema.safeParse, "function")

for (const schemaName of CLI_JSON_REPORT_SCHEMA_NAMES) {
  assert.equal(typeof cliJsonReportSchemas[schemaName].safeParse, "function")
}

assert.equal(HELPER_FILE_MARKER_REGEX.test("// codon-ui-helper-file-marker"), true)
assert.equal(HELPER_FILE_MARKER_REGEX.test("// amino-ui-helper-file-marker"), true)
