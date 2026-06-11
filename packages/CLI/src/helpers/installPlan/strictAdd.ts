import crypto from "crypto"
import { existsSync, promises as fs } from "fs"
import path from "path"

import { Project, ScriptKind } from "ts-morph"

import {
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  CONSUMER_DEPENDENCY_ACTION__INSTALLED,
  CONSUMER_DEPENDENCY_ACTION__NONE,
  CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT,
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  consumerConfigSchema,
  consumerLockfileSchema,
  type TConsumerConfig,
  type TConsumerLockfile,
} from "@/src/helpers/consumerContract"
import {
  DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
  DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
} from "@/src/helpers/packageManagerHelpers"

import {
  INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED,
  INSTALL_PLAN_FILE_STATUS__EXISTING,
  INSTALL_PLAN_FINDING__TARGET_FILE_EXISTS,
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
  INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_INVALID,
  INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_MISSING,
  INSTALL_PLAN_FINDING__STRICT_ADD_DEPENDENCY_BLOCKER,
  INSTALL_PLAN_FINDING__STRICT_ADD_EXISTING_TARGET_BLOCKER,
  INSTALL_PLAN_FINDING__STRICT_ADD_PLAN_BLOCKER,
  INSTALL_PLAN_FINDING__STRICT_ADD_SOURCE_BLOCKER,
  INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  INSTALL_PLAN_SOURCE_STATUS__MISSING,
  INSTALL_PLAN_TARGET_COMPATIBILITY__CONTENT_HASH_MATCH,
  INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
} from "./constants"
import {
  type TInstallPlanFile,
  type TInstallPlanFinding,
  type TRegistryInstallPlan,
  type TAddStrict,
  addStrictSchema,
  registryInstallPlanSchema,
} from "./schema"

const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx"] as const
const STRICT_ADD_BLOCKED_WARNING_CODES = new Set(["unsupported-layout-mode"])

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const REUSABLE_LOCKFILE_OWNERSHIP_STATES = new Set([
  CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED,
  CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT,
])

const normalizePosixPath = (filePath: string) => filePath.replace(/\\/gu, "/")

const stripTypeScriptExtension = (filePath: string) => {
  const extension = TYPESCRIPT_EXTENSIONS.find((candidateExtension) => filePath.endsWith(candidateExtension))

  return extension ? filePath.slice(0, -extension.length) : filePath
}

const createRelativeModuleSpecifier = ({ fromPath, toPath }: { fromPath: string; toPath: string }) => {
  const relativePath = normalizePosixPath(
    path.posix.relative(path.posix.dirname(normalizePosixPath(fromPath)), stripTypeScriptExtension(toPath)),
  )

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`
}

const getScriptKind = (filePath: string) => {
  if (filePath.endsWith(".tsx")) return ScriptKind.TSX
  if (filePath.endsWith(".ts")) return ScriptKind.TS

  return undefined
}

const rewriteInstallPlanImportSpecifiers = ({
  content,
  file,
  installPlan,
}: {
  content: string
  file: TInstallPlanFile
  installPlan: TRegistryInstallPlan
}) => {
  const scriptKind = getScriptKind(file.sourcePath)

  if (!scriptKind) return content

  const importRewrites = new Map<string, string>()

  installPlan.files.forEach((candidateFile) => {
    if (candidateFile.sourcePath === file.sourcePath) return

    importRewrites.set(
      createRelativeModuleSpecifier({
        fromPath: file.sourcePath,
        toPath: candidateFile.sourcePath,
      }),
      createRelativeModuleSpecifier({
        fromPath: file.resolvedPath,
        toPath: candidateFile.resolvedPath,
      }),
    )
  })

  if (importRewrites.size === 0) return content

  const project = new Project({ compilerOptions: {} })
  const sourceFile = project.createSourceFile(file.sourcePath, content, { overwrite: true, scriptKind })

  sourceFile.getImportDeclarations().forEach((importDeclaration) => {
    const replacement = importRewrites.get(importDeclaration.getModuleSpecifierValue())

    if (replacement) importDeclaration.setModuleSpecifier(replacement)
  })

  sourceFile.getExportDeclarations().forEach((exportDeclaration) => {
    const moduleSpecifier = exportDeclaration.getModuleSpecifierValue()
    const replacement = moduleSpecifier ? importRewrites.get(moduleSpecifier) : undefined

    if (replacement) exportDeclaration.setModuleSpecifier(replacement)
  })

  return sourceFile.getFullText()
}

export const createStrictInstalledFileContent = rewriteInstallPlanImportSpecifiers

export const readConsumerConfigForStrictAdd = async (
  cwd: string,
): Promise<{
  config: TConsumerConfig
  configSource: typeof DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG | typeof DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT
  findings: TInstallPlanFinding[]
}> => {
  const configPath = path.join(cwd, CODON_UI_CONFIG_FILE_NAME)
  const fallbackConfig = consumerConfigSchema.parse({})

  if (!existsSync(configPath)) {
    return {
      config: fallbackConfig,
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
          message: `${CODON_UI_CONFIG_FILE_NAME} is missing. Run strict init before strict add.`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: CODON_UI_CONFIG_FILE_NAME,
        },
      ],
    }
  }

  try {
    return {
      config: consumerConfigSchema.parse(JSON.parse(await fs.readFile(configPath, "utf8"))),
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
      findings: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown config parse error."

    return {
      config: fallbackConfig,
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
          message: `${CODON_UI_CONFIG_FILE_NAME} could not be read as a consumer config. ${message}`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: CODON_UI_CONFIG_FILE_NAME,
        },
      ],
    }
  }
}

export const readConsumerLockfileForStrictAdd = async (
  cwd: string,
): Promise<{ lockfileData: TConsumerLockfile; findings: TInstallPlanFinding[] }> => {
  const lockfilePath = path.join(cwd, CODON_UI_LOCK_FILE_NAME)
  const fallbackLockfile = consumerLockfileSchema.parse({})

  if (!existsSync(lockfilePath)) {
    return {
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_MISSING,
          message: `${CODON_UI_LOCK_FILE_NAME} is missing. Run strict init before strict add.`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: CODON_UI_LOCK_FILE_NAME,
        },
      ],
      lockfileData: fallbackLockfile,
    }
  }

  try {
    return {
      findings: [],
      lockfileData: consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8"))),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lockfile parse error."

    return {
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_LOCKFILE_INVALID,
          message: `${CODON_UI_LOCK_FILE_NAME} could not be read as a Codon lockfile. ${message}`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
          targetPath: CODON_UI_LOCK_FILE_NAME,
        },
      ],
      lockfileData: fallbackLockfile,
    }
  }
}

export const createStrictAddBlockerFindings = (installPlan: TRegistryInstallPlan): readonly TInstallPlanFinding[] => {
  const blockerFindings: TInstallPlanFinding[] = []

  installPlan.findings.forEach((finding) => {
    if (
      finding.severity !== INSTALL_PLAN_FINDING_SEVERITY__ERROR &&
      !STRICT_ADD_BLOCKED_WARNING_CODES.has(finding.code)
    ) {
      return
    }

    blockerFindings.push({
      ...finding,
      code: INSTALL_PLAN_FINDING__STRICT_ADD_PLAN_BLOCKER,
      message: `Strict add cannot continue because the install plan has an error: ${finding.message}`,
    })
  })

  installPlan.files.forEach((file) => {
    if (
      file.targetStatus === INSTALL_PLAN_FILE_STATUS__EXISTING &&
      file.targetResolution !== INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING
    ) {
      blockerFindings.push({
        code: INSTALL_PLAN_FINDING__STRICT_ADD_EXISTING_TARGET_BLOCKER,
        itemName: file.itemName,
        message: `Strict add will not overwrite existing target file ${file.resolvedPath}.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        targetPath: file.resolvedPath,
      })
    }

    if (file.sourceStatus === INSTALL_PLAN_SOURCE_STATUS__MISSING) {
      blockerFindings.push({
        code: INSTALL_PLAN_FINDING__STRICT_ADD_SOURCE_BLOCKER,
        itemName: file.itemName,
        message: `Strict add cannot write ${file.resolvedPath} because source file ${file.sourcePath} is missing.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: file.sourcePath,
        targetPath: file.resolvedPath,
      })
    }
  })

  installPlan.dependencyPlan.forEach((dependency) => {
    if (dependency.status === INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED) return

    blockerFindings.push({
      code: INSTALL_PLAN_FINDING__STRICT_ADD_DEPENDENCY_BLOCKER,
      message: `Strict add requires ${dependency.kind} dependency "${dependency.name}" to be satisfied before file writes. Current status is "${dependency.status}".`,
      severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
    })
  })

  return blockerFindings
}

const getStrictAddReusableLockfileFile = ({
  file,
  installPlan,
  lockfileData,
}: {
  file: TInstallPlanFile
  installPlan: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
}) => {
  if (file.targetStatus !== INSTALL_PLAN_FILE_STATUS__EXISTING) return undefined
  if (!file.contentHash || !file.targetContentHash) return undefined

  const lockfileItem = lockfileData.items[file.itemName]
  const lockfileFile = lockfileItem?.files.find((candidateFile) => candidateFile.path === file.resolvedPath)

  if (lockfileItem?.sourceIdentity !== installPlan.sourceIdentity) return undefined
  if (!lockfileFile) return undefined
  if (lockfileFile.targetRole !== file.targetRole) return undefined
  if (lockfileFile.sourceHash !== file.contentHash) return undefined
  if (lockfileFile.installedHash !== file.targetContentHash) return undefined
  if (!REUSABLE_LOCKFILE_OWNERSHIP_STATES.has(lockfileFile.ownershipState)) return undefined

  return lockfileFile
}

const createLockfileDependencyKey = (dependency: Pick<TConsumerLockfile["dependencies"][number], "kind" | "name">) =>
  `${dependency.kind}:${dependency.name}`

export const mergeStrictAddLockfileDependencies = ({
  installedDependencies = [],
  installPlan,
  lockfileData,
}: {
  installedDependencies?: readonly Pick<TConsumerLockfile["dependencies"][number], "kind" | "name">[]
  installPlan: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
}): TConsumerLockfile["dependencies"] => {
  const dependencyEntriesByKey = new Map<string, TConsumerLockfile["dependencies"][number]>()
  const installedDependencyKeys = new Set(installedDependencies.map(createLockfileDependencyKey))

  lockfileData.dependencies.forEach((dependency) => {
    dependencyEntriesByKey.set(createLockfileDependencyKey(dependency), dependency)
  })

  installPlan.dependencyPlan.forEach((dependency) => {
    const dependencyKey = createLockfileDependencyKey(dependency)

    dependencyEntriesByKey.set(createLockfileDependencyKey(dependency), {
      ...dependency,
      action: installedDependencyKeys.has(dependencyKey)
        ? CONSUMER_DEPENDENCY_ACTION__INSTALLED
        : CONSUMER_DEPENDENCY_ACTION__NONE,
    })
  })

  return [...dependencyEntriesByKey.values()]
}

export const createStrictAddLockfileReusePlan = ({
  installPlan,
  lockfileData,
}: {
  installPlan: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
}): TRegistryInstallPlan => {
  const reusablePaths = new Set<string>()
  const files = installPlan.files.map((file) => {
    if (!getStrictAddReusableLockfileFile({ file, installPlan, lockfileData })) return file

    reusablePaths.add(file.resolvedPath)

    return {
      ...file,
      targetCompatibility: file.targetCompatibility ?? INSTALL_PLAN_TARGET_COMPATIBILITY__CONTENT_HASH_MATCH,
      targetResolution: INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
    }
  })

  return registryInstallPlanSchema.parse({
    ...installPlan,
    files,
    findings: installPlan.findings.filter(
      (finding) =>
        finding.code !== INSTALL_PLAN_FINDING__TARGET_FILE_EXISTS ||
        !finding.targetPath ||
        !reusablePaths.has(finding.targetPath),
    ),
    items: installPlan.items.map((item) => ({
      ...item,
      files: files.filter((file) => file.itemName === item.name),
    })),
  })
}

export const writeStrictRegistryInstall = async ({
  consumerRoot,
  installedDependencies = [],
  installPlan,
  lockfileData,
  sourceRoot,
  themeTier,
}: {
  consumerRoot: string
  installedDependencies?: readonly Pick<TConsumerLockfile["dependencies"][number], "kind" | "name">[]
  installPlan: TRegistryInstallPlan
  lockfileData: TConsumerLockfile
  sourceRoot: string
  themeTier: TConsumerConfig["theme"]["tier"]
}): Promise<TAddStrict["lockfileData"]> => {
  const installedHashesByPath = new Map<string, string>()

  for (const file of installPlan.files) {
    const targetPath = path.resolve(consumerRoot, file.resolvedPath)

    if (file.targetResolution === INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING) {
      installedHashesByPath.set(file.resolvedPath, createContentHash(await fs.readFile(targetPath)))
      continue
    }

    const sourcePath = path.resolve(sourceRoot, file.sourcePath)
    const sourceContent = await fs.readFile(sourcePath, "utf8")
    const installedContent = rewriteInstallPlanImportSpecifiers({
      content: sourceContent,
      file,
      installPlan,
    })

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, installedContent, "utf8")
    installedHashesByPath.set(file.resolvedPath, createContentHash(installedContent))
  }

  const nextItems = Object.fromEntries(
    installPlan.items.map((item) => [
      item.name,
      {
        files: item.files.map((file) => ({
          installedHash: installedHashesByPath.get(file.resolvedPath),
          ownershipState:
            getStrictAddReusableLockfileFile({ file, installPlan, lockfileData })?.ownershipState ??
            (file.targetResolution === INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING
              ? CONSUMER_OWNERSHIP_STATE__CONSUMER_OWNED_SUPPORT
              : CONSUMER_OWNERSHIP_STATE__REGISTRY_OWNED),
          path: file.resolvedPath,
          sourceHash: file.contentHash,
          targetRole: file.targetRole,
        })),
        name: item.name,
        registryDependencies: item.registryDependencies,
        sourceIdentity: installPlan.sourceIdentity,
      },
    ]),
  )
  const nextLockfileData = consumerLockfileSchema.parse({
    ...lockfileData,
    dependencies: mergeStrictAddLockfileDependencies({ installedDependencies, installPlan, lockfileData }),
    items: {
      ...lockfileData.items,
      ...nextItems,
    },
    themeTier,
  })

  await fs.writeFile(
    path.join(consumerRoot, CODON_UI_LOCK_FILE_NAME),
    `${JSON.stringify(nextLockfileData, null, 2)}\n`,
    "utf8",
  )

  return addStrictSchema.shape.lockfileData.parse(nextLockfileData)
}
