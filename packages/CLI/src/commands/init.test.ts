import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createConsumerInitDryRun, writeConsumerInitSeed } from "../helpers"

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "amino-ui-init-"))

const writeJson = (filePath: string, value: unknown) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

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

const createFixture = (fixtureName: string) => {
  const fixturePath = path.join(temporaryRoot, fixtureName)

  mkdirSync(fixturePath, { recursive: true })
  writeJson(path.join(fixturePath, "package.json"), {
    name: `@amino-ui-tests/${fixtureName}`,
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
  assert.equal(report.wouldEffects.directories.status, "not-written")
  assert.equal(report.wouldEffects.dependencies.status, "not-written")
  assert.equal(report.wouldEffects.directories.plannedCount, 0)
  assert.equal(report.wouldEffects.dependencies.plannedInstallCount, 0)
}

try {
  const greenfieldFixturePath = createFixture("greenfield")
  const beforeDryRunSnapshot = snapshotFiles(greenfieldFixturePath)
  const greenfieldDryRun = createConsumerInitDryRun(greenfieldFixturePath)
  const afterDryRunSnapshot = snapshotFiles(greenfieldFixturePath)

  assert.deepEqual(afterDryRunSnapshot, beforeDryRunSnapshot)
  assertDefaultDryRunNoWriteEffects(greenfieldDryRun)
  assert.equal(greenfieldDryRun.initialized, true)
  assert.equal(greenfieldDryRun.packageManager, "pnpm")
  assert.equal(greenfieldDryRun.project.hasConfigFile, false)
  assert.equal(greenfieldDryRun.project.hasLockfile, false)
  assert.equal(greenfieldDryRun.proposedConfig.layoutMode, "registry-contained")
  assert.equal(greenfieldDryRun.targetPaths.components, "src/components")
  assert.equal(greenfieldDryRun.targetPaths.tokens, "src/components/_registry/tokens")
  assert.equal(greenfieldDryRun.wouldEffects.config.status, "would-write")
  assert.equal(greenfieldDryRun.wouldEffects.config.wouldWrite, true)
  assert.equal(greenfieldDryRun.wouldEffects.lockfile.status, "would-write")
  assert.equal(greenfieldDryRun.wouldEffects.lockfile.wouldWrite, true)
  assert.equal(greenfieldDryRun.findings.length, 0)
  assert.equal(existsSync(path.join(greenfieldFixturePath, "amino-ui.config.json")), false)
  assert.equal(existsSync(path.join(greenfieldFixturePath, "amino-ui.lock.json")), false)

  const strictInit = await writeConsumerInitSeed(greenfieldFixturePath)

  assert.equal(strictInit.initialized, true)
  assert.equal(strictInit.effects.writesConfig, true)
  assert.equal(strictInit.effects.writesLockfile, true)

  const afterStrictDryRunSnapshot = snapshotFiles(greenfieldFixturePath)
  const blockedDryRun = createConsumerInitDryRun(greenfieldFixturePath)

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
  writeJson(path.join(configOnlyFixturePath, "amino-ui.config.json"), {})

  const configOnlyDryRun = createConsumerInitDryRun(configOnlyFixturePath)

  assertDefaultDryRunNoWriteEffects(configOnlyDryRun)
  assert.equal(configOnlyDryRun.initialized, false)
  assert.equal(configOnlyDryRun.wouldEffects.config.status, "blocked")
  assert.equal(configOnlyDryRun.wouldEffects.lockfile.status, "not-written")
  assert.equal(existsSync(path.join(configOnlyFixturePath, "amino-ui.lock.json")), false)

  const lockfileOnlyFixturePath = createFixture("lockfile-only")
  writeJson(path.join(lockfileOnlyFixturePath, "amino-ui.lock.json"), {})

  const lockfileOnlyDryRun = createConsumerInitDryRun(lockfileOnlyFixturePath)

  assertDefaultDryRunNoWriteEffects(lockfileOnlyDryRun)
  assert.equal(lockfileOnlyDryRun.initialized, false)
  assert.equal(lockfileOnlyDryRun.wouldEffects.config.status, "not-written")
  assert.equal(lockfileOnlyDryRun.wouldEffects.lockfile.status, "blocked")
  assert.equal(existsSync(path.join(lockfileOnlyFixturePath, "amino-ui.config.json")), false)

  console.log("[aminoui-cli] init dry-run and strict seed reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
