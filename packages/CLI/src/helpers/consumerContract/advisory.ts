import {
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_ADVISORY_SEVERITY__INFO,
  CONSUMER_ADVISORY_SEVERITY__WARNING,
  CONSUMER_PACKAGE_MANAGER__UNKNOWN,
} from "./constants"
import { createDefaultConsumerConfig } from "./initSeed"
import { resolveConsumerLayout } from "./layout"
import { getConsumerProjectContext } from "./projectContext"
import { consumerInitAdvisorySchema, type TConsumerInitAdvisory } from "./schema"

export const createConsumerInitAdvisory = (cwd: string): TConsumerInitAdvisory => {
  const project = getConsumerProjectContext(cwd)
  const proposedConfig = createDefaultConsumerConfig()
  const layout = resolveConsumerLayout(proposedConfig)
  const findings = [...layout.findings]

  if (project.packageManager === CONSUMER_PACKAGE_MANAGER__UNKNOWN) {
    findings.push({
      code: "unknown-package-manager",
      message: "Could not infer a package manager from packageManager metadata or a known lockfile.",
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  if (project.hasConfigFile) {
    findings.push({
      code: "existing-config",
      message: `${CODON_UI_CONFIG_FILE_NAME} already exists. Advisory mode will not overwrite it.`,
      severity: CONSUMER_ADVISORY_SEVERITY__INFO,
    })
  }

  if (project.hasLockfile) {
    findings.push({
      code: "existing-lockfile",
      message: `${CODON_UI_LOCK_FILE_NAME} already exists. Advisory mode will not modify it.`,
      severity: CONSUMER_ADVISORY_SEVERITY__INFO,
    })
  }

  return consumerInitAdvisorySchema.parse({
    advisory: true,
    cwd,
    findings,
    packageManager: project.packageManager,
    project,
    proposedConfig,
    targetPaths: layout.targetPaths,
  })
}
