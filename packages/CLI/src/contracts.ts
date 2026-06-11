import type { ZodTypeAny } from "zod"

import {
  consumerConfigSchema,
  consumerInitAdvisorySchema,
  consumerInitDryRunResultSchema,
  consumerInitSeedResultSchema,
  consumerLockfileSchema,
} from "./helpers/consumerContract/schema"
import { diffReportSchema } from "./helpers/diff"
import { ejectAdvisoryReportSchema } from "./helpers/ejectAdvisory"
import { ejectDryRunReportSchema } from "./helpers/ejectDryRun"
import { ejectStrictReportSchema } from "./helpers/ejectStrict"
import {
  addAdvisorySchema,
  addDryRunSchema,
  addStrictSchema,
  dependencyInstallCommandFailureSchema,
  dependencyInstallCommandSchema,
  dependencyInstallPlanSchema,
  registryInstallPlanSchema,
} from "./helpers/installPlan/schema"
import { removeAdvisoryReportSchema } from "./helpers/removeAdvisory"
import { removeDryRunReportSchema } from "./helpers/removeDryRun"
import { removeStrictReportSchema } from "./helpers/removeStrict"
import { statusReportSchema } from "./helpers/status"
import { updateAdvisoryReportSchema, updateAllAdvisoryReportSchema } from "./helpers/updateAdvisory"
import { updateAllDryRunReportSchema, updateDryRunReportSchema } from "./helpers/updateDryRun"
import { updateAllStrictReportSchema, updateStrictReportSchema } from "./helpers/updateStrict"

export {
  addAdvisorySchema,
  addDryRunSchema,
  addStrictSchema,
  consumerConfigSchema,
  consumerInitAdvisorySchema,
  consumerInitDryRunResultSchema,
  consumerInitSeedResultSchema,
  consumerLockfileSchema,
  dependencyInstallCommandFailureSchema,
  dependencyInstallCommandSchema,
  dependencyInstallPlanSchema,
  diffReportSchema,
  ejectAdvisoryReportSchema,
  ejectDryRunReportSchema,
  ejectStrictReportSchema,
  registryInstallPlanSchema,
  removeAdvisoryReportSchema,
  removeDryRunReportSchema,
  removeStrictReportSchema,
  statusReportSchema,
  updateAdvisoryReportSchema,
  updateAllAdvisoryReportSchema,
  updateAllDryRunReportSchema,
  updateAllStrictReportSchema,
  updateDryRunReportSchema,
  updateStrictReportSchema,
}

export const CLI_JSON_REPORT_SCHEMA_NAMES = [
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
] as const

export type TCliJsonReportSchemaName = (typeof CLI_JSON_REPORT_SCHEMA_NAMES)[number]

export const cliJsonReportSchemas = {
  addAdvisory: addAdvisorySchema,
  addDryRun: addDryRunSchema,
  addStrict: addStrictSchema,
  delete: removeStrictReportSchema,
  diff: diffReportSchema,
  ejectAdvisory: ejectAdvisoryReportSchema,
  ejectDryRun: ejectDryRunReportSchema,
  ejectStrict: ejectStrictReportSchema,
  initAdvisory: consumerInitAdvisorySchema,
  initDryRun: consumerInitDryRunResultSchema,
  initStrict: consumerInitSeedResultSchema,
  removeAdvisory: removeAdvisoryReportSchema,
  removeDryRun: removeDryRunReportSchema,
  removeStrict: removeStrictReportSchema,
  status: statusReportSchema,
  updateAdvisory: updateAdvisoryReportSchema,
  updateAllAdvisory: updateAllAdvisoryReportSchema,
  updateAllDryRun: updateAllDryRunReportSchema,
  updateAllStrict: updateAllStrictReportSchema,
  updateDryRun: updateDryRunReportSchema,
  updateStrict: updateStrictReportSchema,
} satisfies Record<TCliJsonReportSchemaName, ZodTypeAny>
