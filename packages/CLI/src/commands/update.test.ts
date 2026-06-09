import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createUpdateAdvisoryReport } from "../helpers/updateAdvisory"
import { createUpdateDryRunReport } from "../helpers/updateDryRun"
import { createUpdateStrictReport } from "../helpers/updateStrict"

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const writeJson = (filePath: string, value: unknown) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

const writeText = (filePath: string, value: string) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, value, "utf8")
}

const readJson = (filePath: string) => JSON.parse(readFileSync(filePath, "utf8"))

const readFixtureSnapshot = (fixturePath: string) =>
  [
    "registry.json",
    "source/clean.ts",
    "source/source-changed.ts",
    "source/local-modified.ts",
    "source/missing.ts",
    "source/unknown.ts",
    "source/support.ts",
    "source/ejected.ts",
    "source/source-only.ts",
    "source/source-equals-local.ts",
    "source/dependency-blocked.ts",
    "consumer/amino-ui.config.json",
    "consumer/amino-ui.lock.json",
    "consumer/src/components/Diff/clean.ts",
    "consumer/src/components/Diff/source-changed.ts",
    "consumer/src/components/Diff/local-modified.ts",
    "consumer/src/components/Diff/unknown.ts",
    "consumer/src/components/Diff/source-only.ts",
    "consumer/src/components/Diff/source-equals-local.ts",
    "consumer/src/components/Diff/dependency-blocked.ts",
    "consumer/src/components/_registry/tokens/support.ts",
    "consumer/src/components/_registry/utils/ejected.ts",
  ]
    .filter((filePath) => existsSync(path.join(fixturePath, filePath)))
    .map((filePath) => `${filePath}:${createContentHash(readFileSync(path.join(fixturePath, filePath)))}`)
    .sort()

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "amino-ui-update-advisory-"))

try {
  const consumerRoot = path.join(temporaryRoot, "consumer")
  const registrySourcePath = path.join(temporaryRoot, "registry.json")
  const cleanSource = "export const clean = true\n"
  const sourceChangedInstalled = "export const sourceChanged = 'installed'\n"
  const sourceChangedCurrent = "export const sourceChanged = 'registry'\n"
  const localModifiedInstalled = "export const localModified = 'installed'\n"
  const localModifiedCurrent = "export const localModified = 'consumer'\n"
  const missingSource = "export const missing = true\n"
  const unknownSource = "export const unknown = true\n"
  const supportSource = "export const support = true\n"
  const ejectedSource = "export const ejected = true\n"
  const sourceOnlyInstalled = "export const sourceOnly = 'installed'\n"
  const sourceOnlyCurrent = "export const sourceOnly = 'registry'\n"
  const sourceEqualsLocalPrevious = "export const sourceEqualsLocal = 'previous'\n"
  const sourceEqualsLocalCurrent = "export const sourceEqualsLocal = 'registry'\n"
  const dependencyBlockedInstalled = "export const dependencyBlocked = 'installed'\n"
  const dependencyBlockedCurrent = "export const dependencyBlocked = 'registry'\n"

  writeText(path.join(temporaryRoot, "source/clean.ts"), cleanSource)
  writeText(path.join(temporaryRoot, "source/source-changed.ts"), sourceChangedCurrent)
  writeText(path.join(temporaryRoot, "source/local-modified.ts"), localModifiedInstalled)
  writeText(path.join(temporaryRoot, "source/missing.ts"), missingSource)
  writeText(path.join(temporaryRoot, "source/unknown.ts"), unknownSource)
  writeText(path.join(temporaryRoot, "source/support.ts"), supportSource)
  writeText(path.join(temporaryRoot, "source/ejected.ts"), ejectedSource)
  writeText(path.join(temporaryRoot, "source/source-only.ts"), sourceOnlyCurrent)
  writeText(path.join(temporaryRoot, "source/source-equals-local.ts"), sourceEqualsLocalCurrent)
  writeText(path.join(temporaryRoot, "source/dependency-blocked.ts"), dependencyBlockedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/clean.ts"), cleanSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-changed.ts"), sourceChangedInstalled)
  writeText(path.join(consumerRoot, "src/components/Diff/local-modified.ts"), localModifiedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/unknown.ts"), unknownSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-only.ts"), sourceOnlyInstalled)
  writeText(path.join(consumerRoot, "src/components/Diff/source-equals-local.ts"), sourceEqualsLocalCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/dependency-blocked.ts"), dependencyBlockedInstalled)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/support.ts"), supportSource)
  writeText(path.join(consumerRoot, "src/components/_registry/utils/ejected.ts"), ejectedSource)
  writeJson(path.join(consumerRoot, "amino-ui.config.json"), {})
  writeJson(registrySourcePath, {
    items: [
      {
        files: [
          {
            role: "source",
            sourcePath: "source/clean.ts",
            targetPath: "Diff/clean.ts",
            targetRole: "components",
          },
          {
            role: "source",
            sourcePath: "source/source-changed.ts",
            targetPath: "Diff/source-changed.ts",
            targetRole: "components",
          },
          {
            role: "source",
            sourcePath: "source/local-modified.ts",
            targetPath: "Diff/local-modified.ts",
            targetRole: "components",
          },
          {
            role: "source",
            sourcePath: "source/missing.ts",
            targetPath: "Diff/missing.ts",
            targetRole: "components",
          },
          {
            role: "source",
            sourcePath: "source/unknown.ts",
            targetPath: "Diff/unknown.ts",
            targetRole: "components",
          },
          {
            role: "support",
            sourcePath: "source/support.ts",
            targetPath: "support.ts",
            targetRole: "tokens",
          },
          {
            role: "support",
            sourcePath: "source/ejected.ts",
            targetPath: "ejected.ts",
            targetRole: "utils",
          },
        ],
        name: "switch",
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "source",
            sourcePath: "source/source-only.ts",
            targetPath: "Diff/source-only.ts",
            targetRole: "components",
          },
        ],
        name: "source-only",
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "source",
            sourcePath: "source/source-equals-local.ts",
            targetPath: "Diff/source-equals-local.ts",
            targetRole: "components",
          },
        ],
        name: "source-equals-local",
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "source",
            sourcePath: "source/dependency-blocked.ts",
            targetPath: "Diff/dependency-blocked.ts",
            targetRole: "components",
          },
        ],
        name: "dependency-blocked",
        peerDependencies: {
          react: "^18.2.0 || ^19.0.0",
        },
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
    ],
    schemaVersion: 1,
    sourceIdentity: "@amino-ui/test-registry",
    sourceRoot: ".",
  })
  writeJson(path.join(consumerRoot, "amino-ui.lock.json"), {
    configFile: "amino-ui.config.json",
    dependencies: [
      {
        action: "none",
        kind: "peer",
        name: "react",
        requiredRange: "^18.2.0 || ^19.0.0",
        status: "missing",
      },
    ],
    items: {
      "source-only": {
        files: [
          {
            installedHash: createContentHash(sourceOnlyInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-only.ts",
            sourceHash: createContentHash(sourceOnlyInstalled),
            targetRole: "components",
          },
        ],
        name: "source-only",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "source-equals-local": {
        files: [
          {
            installedHash: createContentHash(sourceEqualsLocalCurrent),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-equals-local.ts",
            sourceHash: createContentHash(sourceEqualsLocalPrevious),
            targetRole: "components",
          },
        ],
        name: "source-equals-local",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "dependency-blocked": {
        files: [
          {
            installedHash: createContentHash(dependencyBlockedInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Diff/dependency-blocked.ts",
            sourceHash: createContentHash(dependencyBlockedInstalled),
            targetRole: "components",
          },
        ],
        name: "dependency-blocked",
        sourceIdentity: "@amino-ui/test-registry",
      },
      switch: {
        files: [
          {
            installedHash: createContentHash(cleanSource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/clean.ts",
            sourceHash: createContentHash(cleanSource),
            targetRole: "components",
          },
          {
            installedHash: createContentHash(sourceChangedInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-changed.ts",
            sourceHash: createContentHash(sourceChangedInstalled),
            targetRole: "components",
          },
          {
            installedHash: createContentHash(localModifiedInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Diff/local-modified.ts",
            sourceHash: createContentHash(localModifiedInstalled),
            targetRole: "components",
          },
          {
            installedHash: createContentHash(missingSource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/missing.ts",
            sourceHash: createContentHash(missingSource),
            targetRole: "components",
          },
          {
            installedHash: createContentHash(unknownSource),
            ownershipState: "unknown",
            path: "src/components/Diff/unknown.ts",
            sourceHash: createContentHash(unknownSource),
            targetRole: "components",
          },
          {
            installedHash: createContentHash(supportSource),
            ownershipState: "consumer-owned-support",
            path: "src/components/_registry/tokens/support.ts",
            sourceHash: createContentHash(supportSource),
            targetRole: "tokens",
          },
          {
            installedHash: createContentHash(ejectedSource),
            ownershipState: "ejected",
            path: "src/components/_registry/utils/ejected.ts",
            sourceHash: createContentHash(ejectedSource),
            targetRole: "utils",
          },
        ],
        name: "switch",
        sourceIdentity: "@amino-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const initialSnapshot = readFixtureSnapshot(temporaryRoot)
  const report = await createUpdateAdvisoryReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assert.equal(report.schemaVersion, 1)
  assert.equal(report.advisory, true)
  assert.deepEqual(report.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(report.itemUpdateState, "review-required")
  assert.equal(report.summary.fileCount, 7)
  assert.equal(report.summary.candidateFileCount, 1)
  assert.equal(report.summary.reviewRequiredCount, 5)
  assert.equal(report.summary.preservationRequiredCount, 5)
  assert.equal(report.summary.automaticBlockerCount, 5)
  assert.equal(report.summary.dependencyStates.missing, 1)
  assert.equal(report.summary.actionStates.none, 1)
  assert.equal(report.summary.actionStates["update-candidate"], 1)
  assert.equal(report.summary.actionStates["preserve-local-change"], 1)
  assert.equal(report.summary.actionStates["preserve-missing-file"], 1)
  assert.equal(report.summary.actionStates["preserve-unknown"], 1)
  assert.equal(report.summary.actionStates["preserve-consumer-owned-support"], 1)
  assert.equal(report.summary.actionStates["preserve-ejected"], 1)

  const files = new Map(report.files.map((file) => [file.path, file]))

  assert.equal(files.get("src/components/Diff/source-changed.ts")?.action, "update-candidate")
  assert.equal(files.get("src/components/Diff/source-changed.ts")?.blocksAutomaticUpdate, false)
  assert.equal(files.get("src/components/Diff/local-modified.ts")?.action, "preserve-local-change")
  assert.equal(files.get("src/components/Diff/missing.ts")?.action, "preserve-missing-file")
  assert.equal(files.get("src/components/Diff/unknown.ts")?.action, "preserve-unknown")
  assert.equal(files.get("src/components/_registry/tokens/support.ts")?.action, "preserve-consumer-owned-support")
  assert.equal(files.get("src/components/_registry/utils/ejected.ts")?.action, "preserve-ejected")

  const sourceOnlyReport = await createUpdateAdvisoryReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyReport.itemUpdateState, "update-candidate")
  assert.equal(sourceOnlyReport.summary.candidateFileCount, 1)
  assert.equal(sourceOnlyReport.summary.automaticBlockerCount, 0)
  assert.equal(sourceOnlyReport.files[0].action, "update-candidate")

  const missingReport = await createUpdateAdvisoryReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingReport.itemUpdateState, "unavailable")
  assert.equal(missingReport.files.length, 0)
  assert(
    missingReport.findings.some((finding) => finding.code === "status-lockfile-item-missing"),
    "expected missing item finding",
  )

  const mixedDryRunReport = await createUpdateDryRunReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assert.equal(mixedDryRunReport.schemaVersion, 1)
  assert.equal(mixedDryRunReport.dryRun, true)
  assert.deepEqual(mixedDryRunReport.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(mixedDryRunReport.itemUpdateState, "blocked")
  assert.equal(mixedDryRunReport.summary.candidateFileCount, 1)
  assert.equal(mixedDryRunReport.summary.wouldWriteFileCount, 0)
  assert.equal(mixedDryRunReport.summary.wouldUpdateLockfileFileCount, 0)
  assert.equal(mixedDryRunReport.summary.skippedFileCount, 5)
  assert.equal(mixedDryRunReport.summary.blockedFileCount, 1)
  assert.equal(mixedDryRunReport.summary.preservationBlockerCount, 5)
  assert.equal(mixedDryRunReport.wouldEffects.lockfile.status, "blocked")

  const mixedDryRunFiles = new Map(mixedDryRunReport.files.map((file) => [file.path, file]))
  const mixedDryRunCandidate = mixedDryRunFiles.get("src/components/Diff/source-changed.ts")

  assert.equal(mixedDryRunCandidate?.advisoryAction, "update-candidate")
  assert.equal(mixedDryRunCandidate?.dryRunAction, "blocked")
  assert.equal(mixedDryRunCandidate?.wouldWriteFile, false)
  assert.equal(mixedDryRunCandidate?.nextInstalledHash, createContentHash(sourceChangedCurrent))

  const sourceOnlyDryRunReport = await createUpdateDryRunReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyDryRunReport.itemUpdateState, "would-update")
  assert.equal(sourceOnlyDryRunReport.summary.candidateFileCount, 1)
  assert.equal(sourceOnlyDryRunReport.summary.blockerCount, 0)
  assert.equal(sourceOnlyDryRunReport.summary.wouldWriteFileCount, 1)
  assert.equal(sourceOnlyDryRunReport.summary.wouldUpdateLockfileFileCount, 1)
  assert.equal(sourceOnlyDryRunReport.wouldEffects.lockfile.status, "would-write")
  assert.equal(sourceOnlyDryRunReport.files[0].dryRunAction, "would-write")
  assert.equal(sourceOnlyDryRunReport.files[0].nextInstalledHash, createContentHash(sourceOnlyCurrent))
  assert.equal(sourceOnlyDryRunReport.files[0].nextSourceHash, createContentHash(sourceOnlyCurrent))

  const sourceEqualsLocalDryRunReport = await createUpdateDryRunReport({
    cwd: consumerRoot,
    itemName: "source-equals-local",
    registrySourcePath,
  })

  assert.equal(sourceEqualsLocalDryRunReport.itemUpdateState, "would-update")
  assert.equal(sourceEqualsLocalDryRunReport.summary.candidateFileCount, 1)
  assert.equal(sourceEqualsLocalDryRunReport.summary.wouldWriteFileCount, 0)
  assert.equal(sourceEqualsLocalDryRunReport.summary.wouldUpdateLockfileFileCount, 1)
  assert.equal(sourceEqualsLocalDryRunReport.files[0].dryRunAction, "would-update-lockfile")
  assert.equal(sourceEqualsLocalDryRunReport.files[0].nextInstalledHash, createContentHash(sourceEqualsLocalCurrent))

  const dependencyBlockedDryRunReport = await createUpdateDryRunReport({
    cwd: consumerRoot,
    itemName: "dependency-blocked",
    registrySourcePath,
  })

  assert.equal(dependencyBlockedDryRunReport.itemUpdateState, "blocked")
  assert.equal(dependencyBlockedDryRunReport.summary.dependencyBlockerCount, 1)
  assert.equal(dependencyBlockedDryRunReport.summary.dependencyStates.missing, 1)
  assert.equal(dependencyBlockedDryRunReport.summary.wouldWriteFileCount, 0)
  assert.equal(dependencyBlockedDryRunReport.summary.wouldUpdateLockfileFileCount, 0)
  assert.equal(dependencyBlockedDryRunReport.files[0].dryRunAction, "blocked")
  assert.equal(dependencyBlockedDryRunReport.wouldEffects.lockfile.status, "blocked")

  const strictBlockedReport = await createUpdateStrictReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assert.equal(strictBlockedReport.applied, false)
  assert.equal(strictBlockedReport.itemUpdateState, "blocked")
  assert.equal(strictBlockedReport.effects.writesFiles, false)
  assert.equal(strictBlockedReport.effects.writesLockfile, false)
  assert.equal(strictBlockedReport.effects.lockfile.status, "blocked")
  assert.equal(strictBlockedReport.effects.lockfile.updatedFileRecordCount, 0)
  assert(
    strictBlockedReport.blockers.some((blocker) => blocker.code === "strict-update-dry-run-blocker"),
    "expected strict update dry-run blocker",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const strictSourceOnlyReport = await createUpdateStrictReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(strictSourceOnlyReport.applied, true)
  assert.equal(strictSourceOnlyReport.itemUpdateState, "updated")
  assert.equal(strictSourceOnlyReport.effects.writesFiles, true)
  assert.equal(strictSourceOnlyReport.effects.writesLockfile, true)
  assert.equal(strictSourceOnlyReport.effects.files.writtenCount, 1)
  assert.equal(strictSourceOnlyReport.effects.files.lockfileRecordUpdatedCount, 1)
  assert.equal(strictSourceOnlyReport.effects.lockfile.status, "written")
  assert.equal(strictSourceOnlyReport.files[0].strictAction, "wrote-file-and-lockfile")
  assert.equal(strictSourceOnlyReport.files[0].sourceFileWritten, true)
  assert.equal(strictSourceOnlyReport.files[0].lockfileRecordUpdated, true)
  assert.equal(readFileSync(path.join(consumerRoot, "src/components/Diff/source-only.ts"), "utf8"), sourceOnlyCurrent)
  assert.equal(
    strictSourceOnlyReport.lockfileData.items["source-only"]?.files[0].sourceHash,
    createContentHash(sourceOnlyCurrent),
  )
  assert.equal(
    readJson(path.join(consumerRoot, "amino-ui.lock.json")).items["source-only"].files[0].installedHash,
    createContentHash(sourceOnlyCurrent),
  )

  const sourceOnlyNoOpSnapshot = readFixtureSnapshot(temporaryRoot)
  const strictSourceOnlyNoOpReport = await createUpdateStrictReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(strictSourceOnlyNoOpReport.applied, false)
  assert.equal(strictSourceOnlyNoOpReport.itemUpdateState, "up-to-date")
  assert.equal(strictSourceOnlyNoOpReport.effects.writesFiles, false)
  assert.equal(strictSourceOnlyNoOpReport.effects.writesLockfile, false)
  assert.equal(strictSourceOnlyNoOpReport.effects.lockfile.status, "not-written")
  assert.equal(strictSourceOnlyNoOpReport.effects.files.unchangedCount, 1)
  assert.equal(strictSourceOnlyNoOpReport.files[0].strictAction, "none")
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), sourceOnlyNoOpSnapshot)

  const sourceEqualsLocalBefore = readFileSync(
    path.join(consumerRoot, "src/components/Diff/source-equals-local.ts"),
    "utf8",
  )
  const strictSourceEqualsLocalReport = await createUpdateStrictReport({
    cwd: consumerRoot,
    itemName: "source-equals-local",
    registrySourcePath,
  })

  assert.equal(strictSourceEqualsLocalReport.applied, true)
  assert.equal(strictSourceEqualsLocalReport.itemUpdateState, "updated")
  assert.equal(strictSourceEqualsLocalReport.effects.writesFiles, false)
  assert.equal(strictSourceEqualsLocalReport.effects.writesLockfile, true)
  assert.equal(strictSourceEqualsLocalReport.effects.files.writtenCount, 0)
  assert.equal(strictSourceEqualsLocalReport.effects.files.lockfileRecordUpdatedCount, 1)
  assert.equal(strictSourceEqualsLocalReport.files[0].strictAction, "updated-lockfile-record")
  assert.equal(strictSourceEqualsLocalReport.files[0].sourceFileWritten, false)
  assert.equal(strictSourceEqualsLocalReport.files[0].lockfileRecordUpdated, true)
  assert.equal(
    readFileSync(path.join(consumerRoot, "src/components/Diff/source-equals-local.ts"), "utf8"),
    sourceEqualsLocalBefore,
  )
  assert.equal(
    strictSourceEqualsLocalReport.lockfileData.items["source-equals-local"]?.files[0].sourceHash,
    createContentHash(sourceEqualsLocalCurrent),
  )

  const dependencyBlockedSnapshot = readFixtureSnapshot(temporaryRoot)
  const strictDependencyBlockedReport = await createUpdateStrictReport({
    cwd: consumerRoot,
    itemName: "dependency-blocked",
    registrySourcePath,
  })

  assert.equal(strictDependencyBlockedReport.applied, false)
  assert.equal(strictDependencyBlockedReport.itemUpdateState, "blocked")
  assert.equal(strictDependencyBlockedReport.effects.writesFiles, false)
  assert.equal(strictDependencyBlockedReport.effects.writesLockfile, false)
  assert.equal(strictDependencyBlockedReport.effects.lockfile.status, "blocked")
  assert.equal(strictDependencyBlockedReport.dependencies[0].status, "missing")
  assert(
    strictDependencyBlockedReport.blockers.some((blocker) => blocker.code === "strict-update-dry-run-blocker"),
    "expected strict update dependency dry-run blocker",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), dependencyBlockedSnapshot)

  const missingDryRunReport = await createUpdateDryRunReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingDryRunReport.itemUpdateState, "unavailable")
  assert.equal(missingDryRunReport.files.length, 0)
  assert.equal(missingDryRunReport.effects.writesFiles, false)
  assert.equal(missingDryRunReport.effects.writesLockfile, false)
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), dependencyBlockedSnapshot)
  console.log("[aminoui-cli] update advisory, dry-run, and strict reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
