import { type TConsumerConfig, type TConsumerDependencyPolicy } from "./consumerContract"
import {
  type TInstallPlanFinding,
  type TRegistryInstallPlan,
  createRegistryInstallPlan,
  readConsumerConfigForStrictAdd,
  readLocalRegistrySource,
} from "./installPlan"
import {
  createDependencyInstallPlan,
  createDependencyInstallPolicyPlan,
  resolveDependencyInstallTarget,
  type TDependencyInstallCommand,
  type TDependencyInstallCommandFailure,
  type TDependencyInstallPackageManager,
  type TDependencyInstallPackageManagerExecution,
} from "./packageManagerHelpers"

export type TUpdateDependencyPlanningOptions = {
  cwd: string
  dependencyPolicyOverride?: TConsumerDependencyPolicy
  executedDependencyCommands?: readonly TDependencyInstallCommand[]
  failedDependencyCommands?: readonly TDependencyInstallCommandFailure[]
  installDependencies?: boolean
  itemName: string
  nonInteractive?: boolean
  packageJsonPath?: string
  packageManager?: TDependencyInstallPackageManager
  packageManagerExecution?: TDependencyInstallPackageManagerExecution
  packageManagerWrites?: boolean
  registrySourcePath?: string
}

export type TUpdateDependencyPlan = {
  config: TConsumerConfig
  dependencyInstallPlan: ReturnType<typeof createDependencyInstallPlan>
  findings: TInstallPlanFinding[]
  installPlan?: TRegistryInstallPlan
  sourceRoot?: string
}

export const createUpdateDependencyPlan = async ({
  cwd,
  dependencyPolicyOverride,
  executedDependencyCommands = [],
  failedDependencyCommands = [],
  installDependencies = false,
  itemName,
  nonInteractive = false,
  packageJsonPath,
  packageManager,
  packageManagerExecution,
  packageManagerWrites,
  registrySourcePath,
}: TUpdateDependencyPlanningOptions): Promise<TUpdateDependencyPlan> => {
  const configPlan = await readConsumerConfigForStrictAdd(cwd)
  const dependencyInstallTarget = resolveDependencyInstallTarget({
    consumerRoot: cwd,
    packageJsonPath,
  })
  const dependencyPolicy = createDependencyInstallPolicyPlan({
    configPolicy: configPlan.config.dependencies.policy,
    configSource: configPlan.configSource,
    packageManagerExecution,
    packageManagerWrites,
    policyOverride: dependencyPolicyOverride,
  })

  if (!registrySourcePath) {
    return {
      config: configPlan.config,
      dependencyInstallPlan: createDependencyInstallPlan({
        consumerRoot: cwd,
        dependencyPlan: [],
        dependencyPolicy,
        executedCommands: [...executedDependencyCommands],
        failedCommands: [...failedDependencyCommands],
        installDependencies,
        nonInteractive,
        packageManager,
        targetManifest: dependencyInstallTarget,
      }),
      findings: configPlan.findings,
    }
  }

  const { registrySource, sourceRoot } = await readLocalRegistrySource(registrySourcePath)
  const installPlan = createRegistryInstallPlan({
    config: configPlan.config,
    consumerRoot: cwd,
    dependencyPackageJsonPath: dependencyInstallTarget.absolutePath,
    registrySource,
    requestedItems: [itemName],
    sourceRoot,
  })

  return {
    config: configPlan.config,
    dependencyInstallPlan: createDependencyInstallPlan({
      consumerRoot: cwd,
      dependencyPlan: installPlan.dependencyPlan,
      dependencyPolicy,
      executedCommands: [...executedDependencyCommands],
      failedCommands: [...failedDependencyCommands],
      installDependencies,
      nonInteractive,
      packageManager,
      targetManifest: dependencyInstallTarget,
    }),
    findings: [...configPlan.findings, ...installPlan.findings],
    installPlan,
    sourceRoot,
  }
}
