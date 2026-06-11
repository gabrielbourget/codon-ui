import assert from "node:assert/strict"

import { cliJsonReportSchemas, type TCliJsonReportSchemaName } from "../contracts"

const formatZodIssuePath = (issuePath: readonly (string | number)[]) =>
  issuePath.length > 0 ? issuePath.join(".") : "<root>"

export const assertCliJsonReportContract = ({
  report,
  schemaName,
}: {
  report: unknown
  schemaName: TCliJsonReportSchemaName
}) => {
  const parsedReport = cliJsonReportSchemas[schemaName].safeParse(report)

  assert.equal(
    parsedReport.success,
    true,
    `${schemaName} JSON contract failed: ${
      parsedReport.success
        ? ""
        : parsedReport.error.issues.map((issue) => `${formatZodIssuePath(issue.path)} ${issue.message}`).join("; ")
    }`,
  )
}
