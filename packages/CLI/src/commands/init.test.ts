import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createConsumerInitDryRun, writeConsumerInitSeed } from "../helpers"
import { assertCliJsonReportContract } from "../testUtils/cliJsonContracts"

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "codon-ui-init-"))
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const monorepoRoot = path.resolve(packageRoot, "../..")
const tsxCliPath = path.join(monorepoRoot, "node_modules/tsx/dist/cli.mjs")
const cliEntryPath = path.join(packageRoot, "src/index.ts")

const writeJson = (filePath: string, value: unknown) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

const readJson = (filePath: string) => JSON.parse(readFileSync(filePath, "utf8"))

const hashFile = (filePath: string) => crypto.createHash("sha256").update(readFileSync(filePath)).digest("hex")

const snapshotFiles = (fixturePath: string) => {
  const entries: string[] = []

  const walk = (directoryPath: string) => {
    readdirSync(directoryPath, { withFileTypes: true }).forEach((entry) => {
      const absolutePath = path.join(directoryPath, entry.name)
      const relativePath = path.relative(fixturePath, absolutePath).replace(/\\/gu, "/")

      if (entry.isDirectory()) {
        walk(absolutePath)
        return
      }

      if (entry.isFile()) entries.push(`${relativePath}:${statSync(absolutePath).size}:${hashFile(absolutePath)}`)
    })
  }

  walk(fixturePath)

  return entries.sort()
}

const snapshotFilePaths = (fixturePath: string) => snapshotFiles(fixturePath).map((entry) => entry.split(":")[0])

const createFixture = (fixtureName: string) => {
  const fixturePath = path.join(temporaryRoot, fixtureName)

  mkdirSync(fixturePath, { recursive: true })
  writeJson(path.join(fixturePath, "package.json"), {
    name: `@codon-ui-tests/${fixtureName}`,
    packageManager: "pnpm@10.18.3",
  })

  return fixturePath
}

const assertDefaultDryRunNoWriteEffects = (report: ReturnType<typeof createConsumerInitDryRun>) => {
  assert.equal(report.dryRun, true)
  assert.equal(report.effects.createsDirectories, false)
  assert.equal(report.effects.installsDependencies, false)
  assert.equal(report.effects.writesConfig, false)
  assert.equal(report.effects.writesLockfile, false)
  assert.equal(report.effects.writesPackageJson, false)
  assert.equal(report.wouldEffects.directories.status, "not-written")
  assert.equal(report.wouldEffects.dependencies.status, "not-written")
  assert.equal(report.wouldEffects.packageJson.status, "not-requested")
  assert.equal(report.wouldEffects.packageJson.wouldWrite, false)
  assert.equal(report.wouldEffects.directories.plannedCount, 0)
  assert.equal(report.wouldEffects.dependencies.plannedInstallCount, 0)
}

const assertPlanningModeConflict = ({ args, cwd }: { args: string[]; cwd: string }) => {
  const beforeSnapshot = snapshotFiles(cwd)
  const result = spawnSync(process.execPath, [tsxCliPath, cliEntryPath, "init", ...args, "--cwd", cwd], {
    cwd: packageRoot,
    encoding: "utf8",
  })
  const afterSnapshot = snapshotFiles(cwd)

  assert.equal(result.status, 1)
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /Please choose only one of --advisory, --dry-run, or --defaults\./u,
  )
  assert.deepEqual(afterSnapshot, beforeSnapshot)
}

const runInitCommandJson = ({
  args = [],
  cwd,
}: {
  args?: string[]
  cwd: string
}): Awaited<ReturnType<typeof writeConsumerInitSeed>> => {
  const result = spawnSync(process.execPath, [tsxCliPath, cliEntryPath, "init", ...args, "--json", "--cwd", cwd], {
    cwd: packageRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)

  return JSON.parse(result.stdout) as Awaited<ReturnType<typeof writeConsumerInitSeed>>
}

const runInitCommandJsonReport = <TReport>({ args = [], cwd }: { args?: string[]; cwd: string }): TReport => {
  const result = spawnSync(process.execPath, [tsxCliPath, cliEntryPath, "init", ...args, "--json", "--cwd", cwd], {
    cwd: packageRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)

  return JSON.parse(result.stdout) as TReport
}

const assertInitCommandError = ({
  args,
  cwd,
  expectedMessage,
}: {
  args: string[]
  cwd: string
  expectedMessage: RegExp
}) => {
  const beforeSnapshot = snapshotFiles(cwd)
  const result = spawnSync(process.execPath, [tsxCliPath, cliEntryPath, "init", ...args, "--cwd", cwd], {
    cwd: packageRoot,
    encoding: "utf8",
  })
  const afterSnapshot = snapshotFiles(cwd)

  assert.equal(result.status, 1)
  assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage)
  assert.deepEqual(afterSnapshot, beforeSnapshot)
}

try {
  const greenfieldFixturePath = createFixture("greenfield")
  const beforeDryRunSnapshot = snapshotFiles(greenfieldFixturePath)
  const greenfieldDryRun = createConsumerInitDryRun(greenfieldFixturePath)
  const afterDryRunSnapshot = snapshotFiles(greenfieldFixturePath)

  assertCliJsonReportContract({ report: greenfieldDryRun, schemaName: "initDryRun" })
  assert.deepEqual(afterDryRunSnapshot, beforeDryRunSnapshot)
  assertDefaultDryRunNoWriteEffects(greenfieldDryRun)
  assert.equal(greenfieldDryRun.initialized, true)
  assert.equal(greenfieldDryRun.packageManager, "pnpm")
  assert.equal(greenfieldDryRun.project.hasConfigFile, false)
  assert.equal(greenfieldDryRun.project.hasLockfile, false)
  assert.equal(greenfieldDryRun.proposedConfig.layoutMode, "registry-contained")
  assert.equal(greenfieldDryRun.targetPaths.components, "src/components")
  assert.equal(greenfieldDryRun.targetPaths.tokens, "src/components/_codon-ui-registry/tokens")
  assert.equal(greenfieldDryRun.wouldEffects.config.status, "would-write")
  assert.equal(greenfieldDryRun.wouldEffects.config.wouldWrite, true)
  assert.equal(greenfieldDryRun.wouldEffects.lockfile.status, "would-write")
  assert.equal(greenfieldDryRun.wouldEffects.lockfile.wouldWrite, true)
  assert.equal(greenfieldDryRun.findings.length, 0)
  assert.equal(existsSync(path.join(greenfieldFixturePath, "codon-ui.config.json")), false)
  assert.equal(existsSync(path.join(greenfieldFixturePath, "codon-ui.lock.json")), false)

  const customRootFixturePath = createFixture("custom-registry-root")
  const customRegistryRoot = "src/ui/_codon-ui"
  const customRootDryRun = createConsumerInitDryRun(customRootFixturePath, { registryRoot: customRegistryRoot })

  assertCliJsonReportContract({ report: customRootDryRun, schemaName: "initDryRun" })
  assertDefaultDryRunNoWriteEffects(customRootDryRun)
  assert.equal(customRootDryRun.proposedConfig.paths.registry, customRegistryRoot)
  assert.equal(customRootDryRun.targetPaths.theme, customRegistryRoot)
  assert.equal(customRootDryRun.targetPaths.tokens, `${customRegistryRoot}/tokens`)
  assert.equal(existsSync(path.join(customRootFixturePath, "codon-ui.config.json")), false)

  const customRootCliDryRun = runInitCommandJsonReport<ReturnType<typeof createConsumerInitDryRun>>({
    args: ["--dry-run", "--registry-root", customRegistryRoot],
    cwd: customRootFixturePath,
  })

  assertCliJsonReportContract({ report: customRootCliDryRun, schemaName: "initDryRun" })
  assert.equal(customRootCliDryRun.proposedConfig.paths.registry, customRegistryRoot)
  assert.equal(customRootCliDryRun.targetPaths.theme, customRegistryRoot)
  assert.equal(customRootCliDryRun.targetPaths.tokens, `${customRegistryRoot}/tokens`)
  assert.equal(existsSync(path.join(customRootFixturePath, "codon-ui.config.json")), false)

  const customRootStrictFixturePath = createFixture("custom-registry-root-strict")
  const customRootStrict = runInitCommandJson({
    args: ["--registry-root", customRegistryRoot],
    cwd: customRootStrictFixturePath,
  })

  assertCliJsonReportContract({ report: customRootStrict, schemaName: "initStrict" })
  assert.equal(customRootStrict.initialized, true)
  assert.equal(customRootStrict.config.paths.registry, customRegistryRoot)
  assert.equal(existsSync(path.join(customRootStrictFixturePath, customRegistryRoot)), false)
  assert.deepEqual(snapshotFilePaths(customRootStrictFixturePath), [
    "codon-ui.config.json",
    "codon-ui.lock.json",
    "package.json",
  ])

  assertInitCommandError({
    args: ["--registry-root", "/tmp/codon-ui"],
    cwd: createFixture("absolute-registry-root"),
    expectedMessage: /--registry-root must be a consumer-relative path\./u,
  })
  assertInitCommandError({
    args: ["--registry-root", "../codon-ui"],
    cwd: createFixture("parent-registry-root"),
    expectedMessage: /--registry-root cannot include parent directory segments\./u,
  })

  const strictInit = await writeConsumerInitSeed(greenfieldFixturePath)

  assertCliJsonReportContract({ report: strictInit, schemaName: "initStrict" })
  assert.equal(strictInit.initialized, true)
  assert.equal(strictInit.effects.writesConfig, true)
  assert.equal(strictInit.effects.writesLockfile, true)

  const plainInitFixturePath = createFixture("plain-default-init")
  const beforePlainInitSnapshot = snapshotFilePaths(plainInitFixturePath)
  const plainInit = runInitCommandJson({ cwd: plainInitFixturePath })
  const afterPlainInitSnapshot = snapshotFilePaths(plainInitFixturePath)

  assertCliJsonReportContract({ report: plainInit, schemaName: "initStrict" })
  assert.deepEqual(beforePlainInitSnapshot, ["package.json"])
  assert.deepEqual(afterPlainInitSnapshot, ["codon-ui.config.json", "codon-ui.lock.json", "package.json"])
  assert.equal(plainInit.initialized, true)
  assert.equal(plainInit.effects.writesConfig, true)
  assert.equal(plainInit.effects.writesLockfile, true)
  assert.equal(plainInit.effects.createsDirectories, false)
  assert.equal(plainInit.effects.installsDependencies, false)
  assert.equal(existsSync(path.join(plainInitFixturePath, "src")), false)

  const setupCliDryRunFixturePath = createFixture("setup-cli-dry-run")
  const beforeSetupCliDryRunSnapshot = snapshotFiles(setupCliDryRunFixturePath)
  const setupCliDryRun = runInitCommandJsonReport<ReturnType<typeof createConsumerInitDryRun>>({
    args: ["--dry-run", "--setup-cli"],
    cwd: setupCliDryRunFixturePath,
  })

  assertCliJsonReportContract({ report: setupCliDryRun, schemaName: "initDryRun" })
  assert.deepEqual(snapshotFiles(setupCliDryRunFixturePath), beforeSetupCliDryRunSnapshot)
  assert.equal(setupCliDryRun.cliShortcut.status, "would-write")
  assert.equal(setupCliDryRun.cliShortcut.wouldWritePackageJson, true)
  assert.equal(setupCliDryRun.cliShortcut.writesPackageJson, false)
  assert.equal(setupCliDryRun.wouldEffects.packageJson.status, "would-write")
  assert.equal(setupCliDryRun.wouldEffects.packageJson.wouldWrite, true)
  assert.equal(readJson(path.join(setupCliDryRunFixturePath, "package.json")).scripts, undefined)

  const setupCliStrictFixturePath = createFixture("setup-cli-strict")
  const setupCliStrict = runInitCommandJson({
    args: ["--setup-cli"],
    cwd: setupCliStrictFixturePath,
  })
  const setupCliPackageJson = readJson(path.join(setupCliStrictFixturePath, "package.json"))

  assertCliJsonReportContract({ report: setupCliStrict, schemaName: "initStrict" })
  assert.equal(setupCliStrict.initialized, true)
  assert.equal(setupCliStrict.effects.writesConfig, true)
  assert.equal(setupCliStrict.effects.writesLockfile, true)
  assert.equal(setupCliStrict.effects.writesPackageJson, true)
  assert.equal(setupCliStrict.cliShortcut.status, "written")
  assert.equal(setupCliPackageJson.scripts.cui, "cui")
  assert.equal(setupCliPackageJson.devDependencies["@codon-ui/cli"], "0.1.1")

  const setupCliSecondSnapshotBefore = snapshotFiles(setupCliStrictFixturePath)
  const setupCliSecond = runInitCommandJson({
    args: ["--setup-cli"],
    cwd: setupCliStrictFixturePath,
  })

  assertCliJsonReportContract({ report: setupCliSecond, schemaName: "initStrict" })
  assert.deepEqual(snapshotFiles(setupCliStrictFixturePath), setupCliSecondSnapshotBefore)
  assert.equal(setupCliSecond.initialized, false)
  assert.equal(setupCliSecond.effects.writesConfig, false)
  assert.equal(setupCliSecond.effects.writesLockfile, false)
  assert.equal(setupCliSecond.effects.writesPackageJson, false)
  assert.equal(setupCliSecond.cliShortcut.status, "already-configured")

  const setupCliExistingDependencyFixturePath = createFixture("setup-cli-existing-dependency")
  writeJson(path.join(setupCliExistingDependencyFixturePath, "package.json"), {
    dependencies: {
      "@codon-ui/cli": "workspace:*",
    },
    name: "@codon-ui-tests/setup-cli-existing-dependency",
    packageManager: "pnpm@10.18.3",
  })
  const setupCliExistingDependency = runInitCommandJson({
    args: ["--setup-cli"],
    cwd: setupCliExistingDependencyFixturePath,
  })
  const setupCliExistingDependencyPackageJson = readJson(
    path.join(setupCliExistingDependencyFixturePath, "package.json"),
  )

  assertCliJsonReportContract({ report: setupCliExistingDependency, schemaName: "initStrict" })
  assert.equal(setupCliExistingDependency.effects.writesPackageJson, true)
  assert.equal(setupCliExistingDependency.cliShortcut.dependencyField, "dependencies")
  assert.equal(setupCliExistingDependency.cliShortcut.existingDependencyRange, "workspace:*")
  assert.equal(setupCliExistingDependencyPackageJson.scripts.cui, "cui")
  assert.equal(setupCliExistingDependencyPackageJson.dependencies["@codon-ui/cli"], "workspace:*")
  assert.equal(setupCliExistingDependencyPackageJson.devDependencies, undefined)

  const setupCliScriptConflictFixturePath = createFixture("setup-cli-script-conflict")
  writeJson(path.join(setupCliScriptConflictFixturePath, "package.json"), {
    name: "@codon-ui-tests/setup-cli-script-conflict",
    packageManager: "pnpm@10.18.3",
    scripts: {
      cui: "codon-ui",
    },
  })
  const setupCliScriptConflict = runInitCommandJson({
    args: ["--setup-cli"],
    cwd: setupCliScriptConflictFixturePath,
  })
  const setupCliScriptConflictPackageJson = readJson(path.join(setupCliScriptConflictFixturePath, "package.json"))

  assertCliJsonReportContract({ report: setupCliScriptConflict, schemaName: "initStrict" })
  assert.equal(setupCliScriptConflict.initialized, true)
  assert.equal(setupCliScriptConflict.effects.writesConfig, true)
  assert.equal(setupCliScriptConflict.effects.writesLockfile, true)
  assert.equal(setupCliScriptConflict.effects.writesPackageJson, false)
  assert.equal(setupCliScriptConflict.cliShortcut.status, "blocked")
  assert(setupCliScriptConflict.findings.some((finding) => finding.code === "existing-cui-script"))
  assert.equal(setupCliScriptConflictPackageJson.scripts.cui, "codon-ui")
  assert.equal(setupCliScriptConflictPackageJson.devDependencies, undefined)

  const secondPlainInitSnapshotBefore = snapshotFiles(plainInitFixturePath)
  const secondPlainInit = runInitCommandJson({ cwd: plainInitFixturePath })
  const secondPlainInitSnapshotAfter = snapshotFiles(plainInitFixturePath)

  assertCliJsonReportContract({ report: secondPlainInit, schemaName: "initStrict" })
  assert.deepEqual(secondPlainInitSnapshotAfter, secondPlainInitSnapshotBefore)
  assert.equal(secondPlainInit.initialized, false)
  assert.equal(secondPlainInit.effects.writesConfig, false)
  assert.equal(secondPlainInit.effects.writesLockfile, false)
  assert(secondPlainInit.findings.some((finding) => finding.code === "existing-config"))
  assert(secondPlainInit.findings.some((finding) => finding.code === "existing-lockfile"))

  const afterStrictDryRunSnapshot = snapshotFiles(greenfieldFixturePath)
  const blockedDryRun = createConsumerInitDryRun(greenfieldFixturePath)

  assertCliJsonReportContract({ report: blockedDryRun, schemaName: "initDryRun" })
  assert.deepEqual(snapshotFiles(greenfieldFixturePath), afterStrictDryRunSnapshot)
  assertDefaultDryRunNoWriteEffects(blockedDryRun)
  assert.equal(blockedDryRun.initialized, false)
  assert.equal(blockedDryRun.wouldEffects.config.status, "blocked")
  assert.equal(blockedDryRun.wouldEffects.config.wouldWrite, false)
  assert.equal(blockedDryRun.wouldEffects.lockfile.status, "blocked")
  assert.equal(blockedDryRun.wouldEffects.lockfile.wouldWrite, false)
  assert(blockedDryRun.findings.some((finding) => finding.code === "existing-config"))
  assert(blockedDryRun.findings.some((finding) => finding.code === "existing-lockfile"))

  const configOnlyFixturePath = createFixture("config-only")
  writeJson(path.join(configOnlyFixturePath, "codon-ui.config.json"), {})

  const configOnlyDryRun = createConsumerInitDryRun(configOnlyFixturePath)

  assertCliJsonReportContract({ report: configOnlyDryRun, schemaName: "initDryRun" })
  assertDefaultDryRunNoWriteEffects(configOnlyDryRun)
  assert.equal(configOnlyDryRun.initialized, false)
  assert.equal(configOnlyDryRun.wouldEffects.config.status, "blocked")
  assert.equal(configOnlyDryRun.wouldEffects.lockfile.status, "not-written")
  assert.equal(existsSync(path.join(configOnlyFixturePath, "codon-ui.lock.json")), false)

  const lockfileOnlyFixturePath = createFixture("lockfile-only")
  writeJson(path.join(lockfileOnlyFixturePath, "codon-ui.lock.json"), {})

  const lockfileOnlyDryRun = createConsumerInitDryRun(lockfileOnlyFixturePath)

  assertCliJsonReportContract({ report: lockfileOnlyDryRun, schemaName: "initDryRun" })
  assertDefaultDryRunNoWriteEffects(lockfileOnlyDryRun)
  assert.equal(lockfileOnlyDryRun.initialized, false)
  assert.equal(lockfileOnlyDryRun.wouldEffects.config.status, "not-written")
  assert.equal(lockfileOnlyDryRun.wouldEffects.lockfile.status, "blocked")
  assert.equal(existsSync(path.join(lockfileOnlyFixturePath, "codon-ui.config.json")), false)

  assertPlanningModeConflict({
    args: ["--advisory", "--dry-run"],
    cwd: createFixture("advisory-dry-run-conflict"),
  })
  assertPlanningModeConflict({
    args: ["--advisory", "--defaults"],
    cwd: createFixture("advisory-defaults-conflict"),
  })
  assertPlanningModeConflict({
    args: ["--dry-run", "--defaults"],
    cwd: createFixture("dry-run-defaults-conflict"),
  })

  console.log("[codon-ui] init dry-run and strict seed reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
