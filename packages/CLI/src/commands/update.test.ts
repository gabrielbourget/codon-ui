import assert from "node:assert/strict"
import crypto from "node:crypto"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createUpdateAdvisoryReport, createUpdateAllAdvisoryReport } from "../helpers/updateAdvisory"
import { createUpdateAllDryRunReport, createUpdateDryRunReport } from "../helpers/updateDryRun"
import { createUpdateAllStrictReport, createUpdateStrictReport } from "../helpers/updateStrict"
import { assertCliJsonReportContract } from "../testUtils/cliJsonContracts"

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
    "consumer/codon-ui.config.json",
    "consumer/codon-ui.lock.json",
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
  writeJson(path.join(consumerRoot, "codon-ui.config.json"), {
    paths: {
      registry: "src/components/_registry",
    },
  })
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
        sourcePackage: "@codon-ui/react",
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
        sourcePackage: "@codon-ui/react",
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
        sourcePackage: "@codon-ui/react",
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
        sourcePackage: "@codon-ui/react",
        type: "component",
      },
    ],
    schemaVersion: 1,
    sourceIdentity: "@codon-ui/test-registry",
    sourceRoot: ".",
  })
  writeJson(path.join(consumerRoot, "codon-ui.lock.json"), {
    configFile: "codon-ui.config.json",
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
        sourceIdentity: "@codon-ui/test-registry",
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
        sourceIdentity: "@codon-ui/test-registry",
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
        sourceIdentity: "@codon-ui/test-registry",
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
        sourceIdentity: "@codon-ui/test-registry",
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

  assertCliJsonReportContract({ report, schemaName: "updateAdvisory" })
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

  const allAdvisoryReport = await createUpdateAllAdvisoryReport({
    cwd: consumerRoot,
    registrySourcePath,
  })
  const allAdvisoryItems = new Map(allAdvisoryReport.items.map((item) => [item.itemName, item]))

  assertCliJsonReportContract({ report: allAdvisoryReport, schemaName: "updateAllAdvisory" })
  assert.equal(allAdvisoryReport.schemaVersion, 1)
  assert.equal(allAdvisoryReport.advisory, true)
  assert.equal(allAdvisoryReport.all, true)
  assert.deepEqual(allAdvisoryReport.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(allAdvisoryReport.summary.itemCount, 4)
  assert.equal(allAdvisoryReport.summary.itemStates["update-candidate"], 3)
  assert.equal(allAdvisoryReport.summary.itemStates["review-required"], 1)
  assert.equal(allAdvisoryReport.summary.itemStates["up-to-date"], 0)
  assert.equal(allAdvisoryReport.summary.itemStates.unavailable, 0)
  assert.equal(allAdvisoryReport.summary.fileCount, 10)
  assert.equal(allAdvisoryReport.summary.candidateFileCount, 4)
  assert.equal(allAdvisoryReport.summary.automaticBlockerCount, 5)
  assert.equal(allAdvisoryReport.summary.preservationRequiredCount, 5)
  assert.equal(allAdvisoryReport.summary.dependencyStates.missing, 1)
  assert.equal(allAdvisoryItems.get("switch")?.itemUpdateState, "review-required")
  assert.equal(allAdvisoryItems.get("source-only")?.itemUpdateState, "update-candidate")
  assert.equal(allAdvisoryItems.get("source-equals-local")?.itemUpdateState, "update-candidate")
  assert.equal(allAdvisoryItems.get("dependency-blocked")?.itemUpdateState, "update-candidate")
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const allDryRunReport = await createUpdateAllDryRunReport({
    cwd: consumerRoot,
    registrySourcePath,
  })
  const allDryRunItems = new Map(allDryRunReport.items.map((item) => [item.itemName, item]))

  assertCliJsonReportContract({ report: allDryRunReport, schemaName: "updateAllDryRun" })
  assert.equal(allDryRunReport.schemaVersion, 1)
  assert.equal(allDryRunReport.dryRun, true)
  assert.equal(allDryRunReport.all, true)
  assert.deepEqual(allDryRunReport.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(allDryRunReport.summary.itemCount, 4)
  assert.equal(allDryRunReport.summary.itemStates["would-update"], 2)
  assert.equal(allDryRunReport.summary.itemStates.blocked, 2)
  assert.equal(allDryRunReport.summary.itemStates["up-to-date"], 0)
  assert.equal(allDryRunReport.summary.itemStates.unavailable, 0)
  assert.equal(allDryRunReport.summary.fileCount, 10)
  assert.equal(allDryRunReport.summary.candidateFileCount, 4)
  assert.equal(allDryRunReport.summary.wouldWriteFileCount, 1)
  assert.equal(allDryRunReport.summary.wouldUpdateLockfileFileCount, 2)
  assert.equal(allDryRunReport.summary.skippedFileCount, 5)
  assert.equal(allDryRunReport.summary.blockedFileCount, 2)
  assert.equal(allDryRunReport.summary.preservationBlockerCount, 5)
  assert.equal(allDryRunReport.summary.dependencyBlockerCount, 1)
  assert.equal(allDryRunReport.summary.sourceBlockerCount, 0)
  assert.equal(allDryRunReport.summary.fileActions.none, 1)
  assert.equal(allDryRunReport.summary.fileActions["would-write"], 1)
  assert.equal(allDryRunReport.summary.fileActions["would-update-lockfile"], 1)
  assert.equal(allDryRunReport.summary.fileActions["would-skip"], 5)
  assert.equal(allDryRunReport.summary.fileActions.blocked, 2)
  assert.equal(allDryRunReport.summary.dependencyStates.missing, 1)
  assert.equal(allDryRunReport.wouldEffects.files.candidateCount, 4)
  assert.equal(allDryRunReport.wouldEffects.files.wouldWriteCount, 1)
  assert.equal(allDryRunReport.wouldEffects.files.wouldUpdateLockfileCount, 2)
  assert.equal(allDryRunReport.wouldEffects.files.skippedCount, 5)
  assert.equal(allDryRunReport.wouldEffects.files.blockedCount, 2)
  assert.equal(allDryRunReport.wouldEffects.lockfile.status, "blocked")
  assert.equal(allDryRunReport.wouldEffects.lockfile.plannedFileCount, 10)
  assert.equal(allDryRunReport.wouldEffects.lockfile.wouldWriteFileCount, 2)
  assert.equal(allDryRunItems.get("switch")?.itemUpdateState, "blocked")
  assert.equal(allDryRunItems.get("source-only")?.itemUpdateState, "would-update")
  assert.equal(allDryRunItems.get("source-equals-local")?.itemUpdateState, "would-update")
  assert.equal(allDryRunItems.get("dependency-blocked")?.itemUpdateState, "blocked")
  assert.equal(allDryRunItems.get("source-only")?.summary.wouldWriteFileCount, 1)
  assert.equal(allDryRunItems.get("source-equals-local")?.summary.wouldUpdateLockfileFileCount, 1)
  assert.equal(allDryRunItems.get("dependency-blocked")?.summary.dependencyBlockerCount, 1)
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const allStrictBlockedReport = await createUpdateAllStrictReport({
    cwd: consumerRoot,
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: allStrictBlockedReport, schemaName: "updateAllStrict" })
  assert.equal(allStrictBlockedReport.schemaVersion, 1)
  assert.equal(allStrictBlockedReport.all, true)
  assert.equal(allStrictBlockedReport.applied, false)
  assert.equal(allStrictBlockedReport.summary.itemCount, 4)
  assert.equal(allStrictBlockedReport.summary.itemStates.updated, 0)
  assert.equal(allStrictBlockedReport.summary.itemStates.blocked, 4)
  assert.equal(allStrictBlockedReport.summary.itemStates["up-to-date"], 0)
  assert.equal(allStrictBlockedReport.summary.itemStates.unavailable, 0)
  assert.equal(allStrictBlockedReport.effects.writesFiles, false)
  assert.equal(allStrictBlockedReport.effects.writesLockfile, false)
  assert.equal(allStrictBlockedReport.effects.lockfile.status, "blocked")
  assert.equal(allStrictBlockedReport.effects.lockfile.updatedFileRecordCount, 0)
  assert.equal(allStrictBlockedReport.effects.lockfile.updatedItemCount, 0)
  assert.equal(allStrictBlockedReport.effects.files.writtenCount, 0)
  assert.equal(allStrictBlockedReport.effects.files.lockfileRecordUpdatedCount, 0)
  assert(
    allStrictBlockedReport.blockers.some((blocker) => blocker.code === "strict-update-dry-run-blocker"),
    "expected strict update all dry-run blocker",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const strictAllSuccessRoot = path.join(temporaryRoot, "strict-all-success")
  const strictAllSuccessConsumerRoot = path.join(strictAllSuccessRoot, "consumer")
  const strictAllSuccessRegistrySourcePath = path.join(strictAllSuccessRoot, "registry.json")
  const strictAllSourceOnlyInstalled = "export const allSourceOnly = 'installed'\n"
  const strictAllSourceOnlyCurrent = "export const allSourceOnly = 'registry'\n"
  const strictAllSourceEqualsLocalPrevious = "export const allSourceEqualsLocal = 'previous'\n"
  const strictAllSourceEqualsLocalCurrent = "export const allSourceEqualsLocal = 'registry'\n"

  writeText(path.join(strictAllSuccessRoot, "source/source-only.ts"), strictAllSourceOnlyCurrent)
  writeText(path.join(strictAllSuccessRoot, "source/source-equals-local.ts"), strictAllSourceEqualsLocalCurrent)
  writeText(path.join(strictAllSuccessConsumerRoot, "src/components/Diff/source-only.ts"), strictAllSourceOnlyInstalled)
  writeText(
    path.join(strictAllSuccessConsumerRoot, "src/components/Diff/source-equals-local.ts"),
    strictAllSourceEqualsLocalCurrent,
  )
  writeJson(path.join(strictAllSuccessConsumerRoot, "codon-ui.config.json"), {})
  writeJson(strictAllSuccessRegistrySourcePath, {
    items: [
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
        sourcePackage: "@codon-ui/react",
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
        sourcePackage: "@codon-ui/react",
        type: "component",
      },
    ],
    schemaVersion: 1,
    sourceIdentity: "@codon-ui/test-registry",
    sourceRoot: ".",
  })
  writeJson(path.join(strictAllSuccessConsumerRoot, "codon-ui.lock.json"), {
    configFile: "codon-ui.config.json",
    items: {
      "source-only": {
        files: [
          {
            installedHash: createContentHash(strictAllSourceOnlyInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-only.ts",
            sourceHash: createContentHash(strictAllSourceOnlyInstalled),
            targetRole: "components",
          },
        ],
        name: "source-only",
        sourceIdentity: "@codon-ui/test-registry",
      },
      "source-equals-local": {
        files: [
          {
            installedHash: createContentHash(strictAllSourceEqualsLocalCurrent),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-equals-local.ts",
            sourceHash: createContentHash(strictAllSourceEqualsLocalPrevious),
            targetRole: "components",
          },
        ],
        name: "source-equals-local",
        sourceIdentity: "@codon-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const allStrictSuccessReport = await createUpdateAllStrictReport({
    cwd: strictAllSuccessConsumerRoot,
    registrySourcePath: strictAllSuccessRegistrySourcePath,
  })

  assertCliJsonReportContract({ report: allStrictSuccessReport, schemaName: "updateAllStrict" })
  assert.equal(allStrictSuccessReport.applied, true)
  assert.equal(allStrictSuccessReport.summary.itemCount, 2)
  assert.equal(allStrictSuccessReport.summary.itemStates.updated, 2)
  assert.equal(allStrictSuccessReport.summary.itemStates.blocked, 0)
  assert.equal(allStrictSuccessReport.effects.writesFiles, true)
  assert.equal(allStrictSuccessReport.effects.writesLockfile, true)
  assert.equal(allStrictSuccessReport.effects.files.writtenCount, 1)
  assert.equal(allStrictSuccessReport.effects.files.lockfileRecordUpdatedCount, 2)
  assert.equal(allStrictSuccessReport.effects.lockfile.status, "written")
  assert.equal(allStrictSuccessReport.effects.lockfile.updatedFileRecordCount, 2)
  assert.equal(allStrictSuccessReport.effects.lockfile.updatedItemCount, 2)
  assert.equal(
    readFileSync(path.join(strictAllSuccessConsumerRoot, "src/components/Diff/source-only.ts"), "utf8"),
    strictAllSourceOnlyCurrent,
  )
  assert.equal(
    readFileSync(path.join(strictAllSuccessConsumerRoot, "src/components/Diff/source-equals-local.ts"), "utf8"),
    strictAllSourceEqualsLocalCurrent,
  )
  assert.equal(
    readJson(path.join(strictAllSuccessConsumerRoot, "codon-ui.lock.json")).items["source-only"].files[0].sourceHash,
    createContentHash(strictAllSourceOnlyCurrent),
  )
  assert.equal(
    readJson(path.join(strictAllSuccessConsumerRoot, "codon-ui.lock.json")).items["source-equals-local"].files[0]
      .sourceHash,
    createContentHash(strictAllSourceEqualsLocalCurrent),
  )

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

  assertCliJsonReportContract({ report: mixedDryRunReport, schemaName: "updateDryRun" })
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

  assertCliJsonReportContract({ report: strictBlockedReport, schemaName: "updateStrict" })
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
    readJson(path.join(consumerRoot, "codon-ui.lock.json")).items["source-only"].files[0].installedHash,
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

  const dependencyInstallRoot = path.join(temporaryRoot, "dependency-install")
  const dependencyInstallConsumerRoot = path.join(dependencyInstallRoot, "consumer")
  const dependencyInstallRegistrySourcePath = path.join(dependencyInstallRoot, "registry.json")
  const dependencyInstallPrevious = "export const motionUpdate = 'installed'\n"
  const dependencyInstallCurrent = "export const motionUpdate = 'registry'\n"

  const writeDependencyInstallFixture = ({
    consumerRoot: fixtureConsumerRoot,
    registrySourcePath: fixtureRegistrySourcePath,
    root,
  }: {
    consumerRoot: string
    registrySourcePath: string
    root: string
  }) => {
    writeText(path.join(root, "source/motion-update.ts"), dependencyInstallCurrent)
    writeText(path.join(fixtureConsumerRoot, "src/components/Diff/motion-update.ts"), dependencyInstallPrevious)
    writeJson(path.join(fixtureConsumerRoot, "package.json"), {
      dependencies: {},
      name: "dependency-install-consumer",
      packageManager: "npm@10.0.0",
    })
    writeJson(path.join(fixtureConsumerRoot, "codon-ui.config.json"), {})
    writeJson(fixtureRegistrySourcePath, {
      items: [
        {
          files: [
            {
              role: "source",
              sourcePath: "source/motion-update.ts",
              targetPath: "Diff/motion-update.ts",
              targetRole: "components",
            },
          ],
          name: "motion-update",
          runtimeDependencies: {
            motion: "^11.0.0",
          },
          sourcePackage: "@codon-ui/react",
          type: "component",
        },
      ],
      schemaVersion: 1,
      sourceIdentity: "@codon-ui/test-registry",
      sourceRoot: ".",
    })
    writeJson(path.join(fixtureConsumerRoot, "codon-ui.lock.json"), {
      configFile: "codon-ui.config.json",
      items: {
        "motion-update": {
          files: [
            {
              installedHash: createContentHash(dependencyInstallPrevious),
              ownershipState: "registry-owned",
              path: "src/components/Diff/motion-update.ts",
              sourceHash: createContentHash(dependencyInstallPrevious),
              targetRole: "components",
            },
          ],
          name: "motion-update",
          sourceIdentity: "@codon-ui/test-registry",
        },
      },
      lockfileVersion: 1,
    })
  }

  writeText(path.join(dependencyInstallRoot, "source/motion-update.ts"), dependencyInstallCurrent)
  writeText(path.join(dependencyInstallConsumerRoot, "src/components/Diff/motion-update.ts"), dependencyInstallPrevious)
  writeJson(path.join(dependencyInstallConsumerRoot, "package.json"), {
    dependencies: {},
    name: "dependency-install-consumer",
    packageManager: "npm@10.0.0",
  })
  writeJson(path.join(dependencyInstallConsumerRoot, "codon-ui.config.json"), {})
  writeJson(dependencyInstallRegistrySourcePath, {
    items: [
      {
        files: [
          {
            role: "source",
            sourcePath: "source/motion-update.ts",
            targetPath: "Diff/motion-update.ts",
            targetRole: "components",
          },
        ],
        name: "motion-update",
        runtimeDependencies: {
          motion: "^11.0.0",
        },
        sourcePackage: "@codon-ui/react",
        type: "component",
      },
    ],
    schemaVersion: 1,
    sourceIdentity: "@codon-ui/test-registry",
    sourceRoot: ".",
  })
  writeJson(path.join(dependencyInstallConsumerRoot, "codon-ui.lock.json"), {
    configFile: "codon-ui.config.json",
    items: {
      "motion-update": {
        files: [
          {
            installedHash: createContentHash(dependencyInstallPrevious),
            ownershipState: "registry-owned",
            path: "src/components/Diff/motion-update.ts",
            sourceHash: createContentHash(dependencyInstallPrevious),
            targetRole: "components",
          },
        ],
        name: "motion-update",
        sourceIdentity: "@codon-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const dependencyInstallDryRunReport = await createUpdateDryRunReport({
    cwd: dependencyInstallConsumerRoot,
    dependencyPolicyOverride: "install",
    installDependencies: true,
    itemName: "motion-update",
    registrySourcePath: dependencyInstallRegistrySourcePath,
  })

  assertCliJsonReportContract({ report: dependencyInstallDryRunReport, schemaName: "updateDryRun" })
  assert.equal(dependencyInstallDryRunReport.itemUpdateState, "blocked")
  assert.equal(dependencyInstallDryRunReport.summary.dependencyBlockerCount, 1)
  assert.equal(dependencyInstallDryRunReport.dependencyInstallPlan?.executionPlan.mode, "eligible")
  assert.equal(
    dependencyInstallDryRunReport.dependencyInstallPlan?.recommendedCommands[0]?.command,
    "npm i motion@^11.0.0",
  )

  const dependencyInstallBlockedReport = await createUpdateStrictReport({
    cwd: dependencyInstallConsumerRoot,
    installDependencies: true,
    itemName: "motion-update",
    registrySourcePath: dependencyInstallRegistrySourcePath,
  })

  assertCliJsonReportContract({ report: dependencyInstallBlockedReport, schemaName: "updateStrict" })
  assert.equal(dependencyInstallBlockedReport.applied, false)
  assert.equal(dependencyInstallBlockedReport.itemUpdateState, "blocked")
  assert.equal(dependencyInstallBlockedReport.dependencyInstallPlan?.executionPlan.mode, "blocked")
  assert.equal(readJson(path.join(dependencyInstallConsumerRoot, "package.json")).dependencies.motion, undefined)

  const fakeBinPath = path.join(dependencyInstallRoot, "bin")
  const fakeNpmPath = path.join(fakeBinPath, "npm")
  const originalPath = process.env.PATH

  writeText(
    fakeNpmPath,
    `#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const failureMode = process.env.AMINO_UPDATE_TEST_FAKE_NPM_FAILURE_MODE
const packageJsonPath = path.join(process.cwd(), "package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
const dependency = process.argv.slice(2).find((argument) => argument.startsWith("motion@"))
if (failureMode === "before-write") {
  console.log("fake npm failing before package writes")
  console.error("fake npm dependency install failed before write")
  process.exit(73)
}
if (!dependency) {
  process.exitCode = 1
} else {
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    motion: dependency.slice("motion@".length),
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\\n")
  fs.writeFileSync(path.join(process.cwd(), "package-lock.json"), JSON.stringify({ args: process.argv.slice(2) }, null, 2) + "\\n")
  if (failureMode === "after-write") {
    console.log("fake npm wrote package boundary before failure")
    console.error("fake npm dependency install failed after write")
    process.exit(74)
  }
}
`,
  )
  chmodSync(fakeNpmPath, 0o755)

  try {
    process.env.PATH = `${fakeBinPath}${path.delimiter}${originalPath ?? ""}`

    const assertDependencyInstallFailure = async ({
      expectedExitCode,
      expectedMode,
      expectedPackageManagerWrites,
      failureMode,
    }: {
      expectedExitCode: number
      expectedMode: string
      expectedPackageManagerWrites: boolean
      failureMode: "after-write" | "before-write"
    }) => {
      const failureRoot = path.join(dependencyInstallRoot, failureMode)
      const failureConsumerRoot = path.join(failureRoot, "consumer")
      const failureRegistrySourcePath = path.join(failureRoot, "registry.json")
      const originalFailureMode = process.env.AMINO_UPDATE_TEST_FAKE_NPM_FAILURE_MODE

      writeDependencyInstallFixture({
        consumerRoot: failureConsumerRoot,
        registrySourcePath: failureRegistrySourcePath,
        root: failureRoot,
      })

      const originalSourceContent = readFileSync(
        path.join(failureConsumerRoot, "src/components/Diff/motion-update.ts"),
        "utf8",
      )
      const originalCodonLockfileContent = readFileSync(path.join(failureConsumerRoot, "codon-ui.lock.json"), "utf8")

      try {
        process.env.AMINO_UPDATE_TEST_FAKE_NPM_FAILURE_MODE = failureMode

        const failedReport = await createUpdateStrictReport({
          cwd: failureConsumerRoot,
          dependencyPolicyOverride: "install",
          installDependencies: true,
          itemName: "motion-update",
          registrySourcePath: failureRegistrySourcePath,
        })
        const failedCommand = failedReport.dependencyInstallPlan?.executionPlan.failedCommands[0]

        assertCliJsonReportContract({ report: failedReport, schemaName: "updateStrict" })
        assert.equal(failedReport.applied, false)
        assert.equal(failedReport.itemUpdateState, "blocked")
        assert.equal(failedReport.effects.writesFiles, false)
        assert.equal(failedReport.effects.writesLockfile, false)
        assert.equal(failedReport.effects.installsDependencies, expectedPackageManagerWrites)
        assert.equal(failedReport.effects.dependencies.status, expectedPackageManagerWrites ? "written" : "not-written")
        assert.equal(failedReport.dependencyInstallPlan?.status, "failed")
        assert.equal(failedReport.dependencyInstallPlan?.executionPlan.mode, expectedMode)
        assert.equal(failedReport.dependencyInstallPlan?.executionPlan.packageManagerExecution, "failed")
        assert.equal(
          failedReport.dependencyInstallPlan?.executionPlan.packageManagerWrites,
          expectedPackageManagerWrites,
        )
        assert.equal(failedReport.dependencyInstallPlan?.executionPlan.failedCommands.length, 1)
        assert.equal(failedCommand?.exitCode, expectedExitCode)
        assert.equal(failedCommand?.packageManagerWrites, expectedPackageManagerWrites)
        assert.equal(failedCommand?.command, "npm i motion@^11.0.0")
        assert(
          failedReport.blockers.some((blocker) => blocker.code === "strict-update-dependency-execution-failed"),
          `expected ${failureMode} strict update dependency execution failure blocker`,
        )
        assert(
          failedReport.findings.some((finding) => finding.code === "strict-update-dependency-execution-failed"),
          `expected ${failureMode} strict update dependency execution failure finding`,
        )
        assert.equal(
          readFileSync(path.join(failureConsumerRoot, "src/components/Diff/motion-update.ts"), "utf8"),
          originalSourceContent,
        )
        assert.equal(
          readFileSync(path.join(failureConsumerRoot, "codon-ui.lock.json"), "utf8"),
          originalCodonLockfileContent,
        )

        if (failureMode === "before-write") {
          assert.equal(readJson(path.join(failureConsumerRoot, "package.json")).dependencies.motion, undefined)
          assert.equal(existsSync(path.join(failureConsumerRoot, "package-lock.json")), false)
          assert.deepEqual(failedCommand?.mutatedPaths, [])
        } else {
          assert.equal(readJson(path.join(failureConsumerRoot, "package.json")).dependencies.motion, "^11.0.0")
          assert.equal(existsSync(path.join(failureConsumerRoot, "package-lock.json")), true)
          assert.deepEqual(failedCommand?.mutatedPaths, ["package-lock.json", "package.json"])
        }
      } finally {
        if (originalFailureMode === undefined) {
          delete process.env.AMINO_UPDATE_TEST_FAKE_NPM_FAILURE_MODE
        } else {
          process.env.AMINO_UPDATE_TEST_FAKE_NPM_FAILURE_MODE = originalFailureMode
        }
      }
    }

    await assertDependencyInstallFailure({
      expectedExitCode: 73,
      expectedMode: "eligible",
      expectedPackageManagerWrites: false,
      failureMode: "before-write",
    })
    await assertDependencyInstallFailure({
      expectedExitCode: 74,
      expectedMode: "not-needed",
      expectedPackageManagerWrites: true,
      failureMode: "after-write",
    })

    const dependencyInstallStrictReport = await createUpdateStrictReport({
      cwd: dependencyInstallConsumerRoot,
      dependencyPolicyOverride: "install",
      installDependencies: true,
      itemName: "motion-update",
      registrySourcePath: dependencyInstallRegistrySourcePath,
    })

    assertCliJsonReportContract({ report: dependencyInstallStrictReport, schemaName: "updateStrict" })
    assert.equal(dependencyInstallStrictReport.applied, true)
    assert.equal(dependencyInstallStrictReport.itemUpdateState, "updated")
    assert.equal(dependencyInstallStrictReport.effects.installsDependencies, true)
    assert.equal(dependencyInstallStrictReport.effects.dependencies.status, "written")
    assert.equal(dependencyInstallStrictReport.effects.dependencies.updatedCount, 1)
    assert.equal(
      dependencyInstallStrictReport.dependencyInstallPlan?.executionPlan.packageManagerExecution,
      "completed",
    )
    assert.equal(dependencyInstallStrictReport.dependencyInstallPlan?.executionPlan.executedCommands.length, 1)
    assert.equal(
      readFileSync(path.join(dependencyInstallConsumerRoot, "src/components/Diff/motion-update.ts"), "utf8"),
      dependencyInstallCurrent,
    )
    assert.equal(readJson(path.join(dependencyInstallConsumerRoot, "package.json")).dependencies.motion, "^11.0.0")

    const dependencyInstallLockfile = readJson(path.join(dependencyInstallConsumerRoot, "codon-ui.lock.json"))
    const motionDependency = dependencyInstallLockfile.dependencies.find(
      (dependency: { name: string }) => dependency.name === "motion",
    )

    assert.equal(motionDependency.action, "installed")
    assert.equal(motionDependency.status, "satisfied")
    assert.equal(
      dependencyInstallLockfile.items["motion-update"].files[0].sourceHash,
      createContentHash(dependencyInstallCurrent),
    )
  } finally {
    process.env.PATH = originalPath
  }

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
  console.log("[codon-ui] update advisory, dry-run, and strict reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
