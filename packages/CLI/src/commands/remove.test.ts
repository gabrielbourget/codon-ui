import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createRemoveAdvisoryReport } from "../helpers/removeAdvisory"
import { createRemoveDryRunReport } from "../helpers/removeDryRun"
import { createRemoveStrictReport } from "../helpers/removeStrict"

import { deleteCommand } from "./delete"
import { remove } from "./remove"

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

assert.equal(deleteCommand.name(), "delete")
assert.equal(
  deleteCommand.description(),
  "Delete one installed Amino UI registry item using the same safety checks as remove.",
)
assert.deepEqual(
  deleteCommand.options.map((option) => option.flags),
  remove.options.map((option) => option.flags),
)

const readFixtureSnapshot = (fixturePath: string) =>
  [
    "registry.json",
    "source/clean.ts",
    "source/local-modified.ts",
    "source/missing.ts",
    "source/support.ts",
    "source/shared.ts",
    "source/unknown.ts",
    "source/consumer-support.ts",
    "source/ejected.ts",
    "source/source-only.ts",
    "source/missing-only.ts",
    "consumer/amino-ui.config.json",
    "consumer/amino-ui.lock.json",
    "consumer/src/components/Diff/clean.ts",
    "consumer/src/components/Diff/local-modified.ts",
    "consumer/src/components/Diff/support.ts",
    "consumer/src/components/Diff/shared.ts",
    "consumer/src/components/Diff/unknown.ts",
    "consumer/src/components/Diff/source-only.ts",
    "consumer/src/components/_registry/tokens/consumer-support.ts",
    "consumer/src/components/_registry/utils/ejected.ts",
  ]
    .filter((filePath) => existsSync(path.join(fixturePath, filePath)))
    .map((filePath) => `${filePath}:${createContentHash(readFileSync(path.join(fixturePath, filePath)))}`)
    .sort()

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "amino-ui-remove-advisory-"))

try {
  const consumerRoot = path.join(temporaryRoot, "consumer")
  const registrySourcePath = path.join(temporaryRoot, "registry.json")
  const cleanSource = "export const clean = true\n"
  const localModifiedInstalled = "export const localModified = 'installed'\n"
  const localModifiedCurrent = "export const localModified = 'consumer'\n"
  const missingSource = "export const missing = true\n"
  const supportSource = "export const support = true\n"
  const sharedSource = "export const shared = true\n"
  const unknownSource = "export const unknown = true\n"
  const consumerSupportSource = "export const consumerSupport = true\n"
  const ejectedSource = "export const ejected = true\n"
  const sourceOnlySource = "export const sourceOnly = true\n"
  const missingOnlySource = "export const missingOnly = true\n"

  writeText(path.join(temporaryRoot, "source/clean.ts"), cleanSource)
  writeText(path.join(temporaryRoot, "source/local-modified.ts"), localModifiedInstalled)
  writeText(path.join(temporaryRoot, "source/missing.ts"), missingSource)
  writeText(path.join(temporaryRoot, "source/support.ts"), supportSource)
  writeText(path.join(temporaryRoot, "source/shared.ts"), sharedSource)
  writeText(path.join(temporaryRoot, "source/unknown.ts"), unknownSource)
  writeText(path.join(temporaryRoot, "source/consumer-support.ts"), consumerSupportSource)
  writeText(path.join(temporaryRoot, "source/ejected.ts"), ejectedSource)
  writeText(path.join(temporaryRoot, "source/source-only.ts"), sourceOnlySource)
  writeText(path.join(temporaryRoot, "source/missing-only.ts"), missingOnlySource)
  writeText(path.join(consumerRoot, "src/components/Diff/clean.ts"), cleanSource)
  writeText(path.join(consumerRoot, "src/components/Diff/local-modified.ts"), localModifiedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/support.ts"), supportSource)
  writeText(path.join(consumerRoot, "src/components/Diff/shared.ts"), sharedSource)
  writeText(path.join(consumerRoot, "src/components/Diff/unknown.ts"), unknownSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-only.ts"), sourceOnlySource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/consumer-support.ts"), consumerSupportSource)
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
            role: "support",
            sourcePath: "source/support.ts",
            targetPath: "Diff/support.ts",
            targetRole: "tokens",
          },
          {
            role: "source",
            sourcePath: "source/shared.ts",
            targetPath: "Diff/shared.ts",
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
            sourcePath: "source/consumer-support.ts",
            targetPath: "consumer-support.ts",
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
            sourcePath: "source/missing-only.ts",
            targetPath: "Diff/missing-only.ts",
            targetRole: "components",
          },
        ],
        name: "missing-only",
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
      "missing-only": {
        files: [
          {
            installedHash: createContentHash(missingOnlySource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/missing-only.ts",
            sourceHash: createContentHash(missingOnlySource),
            targetRole: "components",
          },
        ],
        name: "missing-only",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "other-shared": {
        files: [
          {
            installedHash: createContentHash(sharedSource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/shared.ts",
            sourceHash: createContentHash(sharedSource),
            targetRole: "components",
          },
        ],
        name: "other-shared",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "source-only": {
        files: [
          {
            installedHash: createContentHash(sourceOnlySource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/source-only.ts",
            sourceHash: createContentHash(sourceOnlySource),
            targetRole: "components",
          },
        ],
        name: "source-only",
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
            installedHash: createContentHash(supportSource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/support.ts",
            sourceHash: createContentHash(supportSource),
            targetRole: "tokens",
          },
          {
            installedHash: createContentHash(sharedSource),
            ownershipState: "registry-owned",
            path: "src/components/Diff/shared.ts",
            sourceHash: createContentHash(sharedSource),
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
            installedHash: createContentHash(consumerSupportSource),
            ownershipState: "consumer-owned-support",
            path: "src/components/_registry/tokens/consumer-support.ts",
            sourceHash: createContentHash(consumerSupportSource),
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
  const report = await createRemoveAdvisoryReport({
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
  assert.equal(report.itemRemoveState, "review-required")
  assert.equal(report.summary.fileCount, 8)
  assert.equal(report.summary.removableFileCount, 1)
  assert.equal(report.summary.lockfileCleanupCandidateCount, 1)
  assert.equal(report.summary.reviewRequiredCount, 6)
  assert.equal(report.summary.preservationRequiredCount, 4)
  assert.equal(report.summary.automaticBlockerCount, 6)
  assert.equal(report.summary.sharedReferenceCount, 1)
  assert.equal(report.summary.supportReviewCount, 1)
  assert.equal(report.summary.dependencyStates.missing, 1)
  assert.equal(report.summary.actionStates["remove-candidate"], 1)
  assert.equal(report.summary.actionStates["lockfile-cleanup-candidate"], 1)
  assert.equal(report.summary.actionStates["review-support-file"], 1)
  assert.equal(report.summary.actionStates["review-shared-file"], 1)
  assert.equal(report.summary.actionStates["preserve-local-change"], 1)
  assert.equal(report.summary.actionStates["preserve-consumer-owned-support"], 1)
  assert.equal(report.summary.actionStates["preserve-unknown"], 1)
  assert.equal(report.summary.actionStates["preserve-ejected"], 1)

  const files = new Map(report.files.map((file) => [file.path, file]))

  assert.equal(files.get("src/components/Diff/clean.ts")?.action, "remove-candidate")
  assert.equal(files.get("src/components/Diff/clean.ts")?.removalTarget, "file-and-lockfile")
  assert.equal(files.get("src/components/Diff/clean.ts")?.blocksAutomaticRemove, false)
  assert.equal(files.get("src/components/Diff/missing.ts")?.action, "lockfile-cleanup-candidate")
  assert.equal(files.get("src/components/Diff/missing.ts")?.removalTarget, "lockfile-only")
  assert.equal(files.get("src/components/Diff/support.ts")?.action, "review-support-file")
  assert.equal(files.get("src/components/Diff/shared.ts")?.action, "review-shared-file")
  assert.equal(files.get("src/components/Diff/shared.ts")?.sharedReferenceCount, 1)
  assert.equal(files.get("src/components/Diff/local-modified.ts")?.action, "preserve-local-change")
  assert.equal(files.get("src/components/Diff/unknown.ts")?.action, "preserve-unknown")
  assert.equal(
    files.get("src/components/_registry/tokens/consumer-support.ts")?.action,
    "preserve-consumer-owned-support",
  )
  assert.equal(files.get("src/components/_registry/utils/ejected.ts")?.action, "preserve-ejected")

  const sourceOnlyReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyReport.itemRemoveState, "remove-candidate")
  assert.equal(sourceOnlyReport.summary.removableFileCount, 1)
  assert.equal(sourceOnlyReport.summary.automaticBlockerCount, 0)
  assert.equal(sourceOnlyReport.files[0].action, "remove-candidate")

  const missingOnlyReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    itemName: "missing-only",
    registrySourcePath,
  })

  assert.equal(missingOnlyReport.itemRemoveState, "lockfile-cleanup-candidate")
  assert.equal(missingOnlyReport.summary.lockfileCleanupCandidateCount, 1)
  assert.equal(missingOnlyReport.summary.removableFileCount, 0)
  assert.equal(missingOnlyReport.files[0].action, "lockfile-cleanup-candidate")

  const mixedDryRunReport = await createRemoveDryRunReport({
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
  assert.equal(mixedDryRunReport.itemRemoveState, "blocked")
  assert.equal(mixedDryRunReport.summary.fileCount, 8)
  assert.equal(mixedDryRunReport.summary.removeCandidateCount, 1)
  assert.equal(mixedDryRunReport.summary.lockfileCleanupCandidateCount, 1)
  assert.equal(mixedDryRunReport.summary.blockedFileCount, 2)
  assert.equal(mixedDryRunReport.summary.skippedFileCount, 6)
  assert.equal(mixedDryRunReport.summary.wouldRemoveFileCount, 0)
  assert.equal(mixedDryRunReport.summary.wouldRemoveLockfileRecordCount, 0)
  assert.equal(mixedDryRunReport.summary.blockerCount, 8)
  assert.equal(mixedDryRunReport.summary.reviewBlockerCount, 6)
  assert.equal(mixedDryRunReport.summary.preservationBlockerCount, 4)
  assert.equal(mixedDryRunReport.summary.sharedReferenceBlockerCount, 1)
  assert.equal(mixedDryRunReport.summary.supportReviewBlockerCount, 1)
  assert.equal(mixedDryRunReport.summary.dependencyStates.missing, 1)
  assert.equal(mixedDryRunReport.summary.fileActions.blocked, 2)
  assert.equal(mixedDryRunReport.summary.fileActions["skip-review-required"], 2)
  assert.equal(mixedDryRunReport.summary.fileActions["skip-preserved-local-change"], 1)
  assert.equal(mixedDryRunReport.summary.fileActions["skip-consumer-owned-support"], 1)
  assert.equal(mixedDryRunReport.summary.fileActions["skip-unknown"], 1)
  assert.equal(mixedDryRunReport.summary.fileActions["skip-ejected"], 1)
  assert.equal(mixedDryRunReport.wouldEffects.lockfile.status, "blocked")
  assert.equal(mixedDryRunReport.wouldEffects.files.wouldRemoveCount, 0)
  assert.equal(mixedDryRunReport.wouldEffects.lockfile.wouldRemoveFileRecordCount, 0)
  assert.equal(mixedDryRunReport.wouldEffects.dependencies.status, "not-written")

  const mixedDryRunFiles = new Map(mixedDryRunReport.files.map((file) => [file.path, file]))

  assert.equal(mixedDryRunFiles.get("src/components/Diff/clean.ts")?.dryRunAction, "blocked")
  assert.equal(mixedDryRunFiles.get("src/components/Diff/clean.ts")?.wouldRemoveFile, false)
  assert.equal(mixedDryRunFiles.get("src/components/Diff/missing.ts")?.dryRunAction, "blocked")
  assert.equal(mixedDryRunFiles.get("src/components/Diff/missing.ts")?.wouldRemoveLockfileRecord, false)
  assert.equal(mixedDryRunFiles.get("src/components/Diff/support.ts")?.dryRunAction, "skip-review-required")
  assert.equal(mixedDryRunFiles.get("src/components/Diff/shared.ts")?.dryRunAction, "skip-review-required")
  assert.equal(
    mixedDryRunFiles.get("src/components/Diff/local-modified.ts")?.dryRunAction,
    "skip-preserved-local-change",
  )
  assert.equal(mixedDryRunFiles.get("src/components/Diff/unknown.ts")?.dryRunAction, "skip-unknown")
  assert.equal(
    mixedDryRunFiles.get("src/components/_registry/tokens/consumer-support.ts")?.dryRunAction,
    "skip-consumer-owned-support",
  )
  assert.equal(mixedDryRunFiles.get("src/components/_registry/utils/ejected.ts")?.dryRunAction, "skip-ejected")

  const sourceOnlyDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyDryRunReport.itemRemoveState, "would-remove")
  assert.equal(sourceOnlyDryRunReport.summary.removeCandidateCount, 1)
  assert.equal(sourceOnlyDryRunReport.summary.blockerCount, 0)
  assert.equal(sourceOnlyDryRunReport.summary.wouldRemoveFileCount, 1)
  assert.equal(sourceOnlyDryRunReport.summary.wouldRemoveLockfileRecordCount, 1)
  assert.equal(sourceOnlyDryRunReport.files[0].dryRunAction, "would-remove-file-and-lockfile")
  assert.equal(sourceOnlyDryRunReport.files[0].wouldRemoveFile, true)
  assert.equal(sourceOnlyDryRunReport.files[0].wouldRemoveLockfileRecord, true)
  assert.equal(sourceOnlyDryRunReport.wouldEffects.lockfile.status, "would-write")
  assert.equal(sourceOnlyDryRunReport.wouldEffects.lockfile.wouldRemoveItem, true)

  const missingOnlyDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    itemName: "missing-only",
    registrySourcePath,
  })

  assert.equal(missingOnlyDryRunReport.itemRemoveState, "would-remove")
  assert.equal(missingOnlyDryRunReport.summary.lockfileCleanupCandidateCount, 1)
  assert.equal(missingOnlyDryRunReport.summary.wouldRemoveFileCount, 0)
  assert.equal(missingOnlyDryRunReport.summary.wouldRemoveLockfileRecordCount, 1)
  assert.equal(missingOnlyDryRunReport.files[0].dryRunAction, "would-remove-lockfile-record")
  assert.equal(missingOnlyDryRunReport.files[0].wouldRemoveFile, false)
  assert.equal(missingOnlyDryRunReport.files[0].wouldRemoveLockfileRecord, true)
  assert.equal(missingOnlyDryRunReport.wouldEffects.lockfile.status, "would-write")

  const missingReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingReport.itemRemoveState, "unavailable")
  assert.equal(missingReport.files.length, 0)
  assert(
    missingReport.findings.some((finding) => finding.code === "status-lockfile-item-missing"),
    "expected missing item finding",
  )

  const missingDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingDryRunReport.itemRemoveState, "unavailable")
  assert.equal(missingDryRunReport.files.length, 0)
  assert.equal(missingDryRunReport.effects.writesFiles, false)
  assert.equal(missingDryRunReport.effects.writesLockfile, false)
  assert.equal(missingDryRunReport.wouldEffects.lockfile.status, "not-written")

  const strictBlockedReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assert.equal(strictBlockedReport.applied, false)
  assert.equal(strictBlockedReport.itemRemoveState, "blocked")
  assert.equal(strictBlockedReport.effects.writesFiles, false)
  assert.equal(strictBlockedReport.effects.writesLockfile, false)
  assert.equal(strictBlockedReport.effects.lockfile.status, "blocked")
  assert.equal(strictBlockedReport.effects.files.deletedCount, 0)
  assert.equal(strictBlockedReport.effects.lockfile.removedFileRecordCount, 0)
  assert(
    strictBlockedReport.blockers.some((blocker) => blocker.code === "strict-remove-dry-run-blocker"),
    "expected strict remove dry-run blocker",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const strictSourceOnlyReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(strictSourceOnlyReport.applied, true)
  assert.equal(strictSourceOnlyReport.itemRemoveState, "removed")
  assert.equal(strictSourceOnlyReport.effects.writesFiles, true)
  assert.equal(strictSourceOnlyReport.effects.writesLockfile, true)
  assert.equal(strictSourceOnlyReport.effects.files.deletedCount, 1)
  assert.equal(strictSourceOnlyReport.effects.files.plannedDeleteCount, 1)
  assert.equal(strictSourceOnlyReport.effects.lockfile.removedFileRecordCount, 1)
  assert.equal(strictSourceOnlyReport.effects.lockfile.removedItem, true)
  assert.equal(strictSourceOnlyReport.effects.lockfile.status, "written")
  assert.equal(strictSourceOnlyReport.dependencies[0].status, "missing")
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/Diff/source-only.ts")),
    false,
    "expected source-only file to be removed",
  )
  assert.equal(
    existsSync(path.join(temporaryRoot, "source/source-only.ts")),
    true,
    "expected registry source to remain untouched",
  )
  assert.equal(strictSourceOnlyReport.lockfileData.items["source-only"], undefined)
  assert.equal(readJson(path.join(consumerRoot, "amino-ui.lock.json")).items["source-only"], undefined)

  const strictMissingOnlyReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    itemName: "missing-only",
    registrySourcePath,
  })

  assert.equal(strictMissingOnlyReport.applied, true)
  assert.equal(strictMissingOnlyReport.itemRemoveState, "removed")
  assert.equal(strictMissingOnlyReport.effects.writesFiles, false)
  assert.equal(strictMissingOnlyReport.effects.writesLockfile, true)
  assert.equal(strictMissingOnlyReport.effects.files.deletedCount, 0)
  assert.equal(strictMissingOnlyReport.effects.files.plannedDeleteCount, 0)
  assert.equal(strictMissingOnlyReport.effects.lockfile.removedFileRecordCount, 1)
  assert.equal(strictMissingOnlyReport.effects.lockfile.status, "written")
  assert.equal(strictMissingOnlyReport.files[0].strictAction, "removed-lockfile-record")
  assert.equal(strictMissingOnlyReport.lockfileData.items["missing-only"], undefined)
  assert.equal(readJson(path.join(consumerRoot, "amino-ui.lock.json")).items["missing-only"], undefined)

  console.log("[aminoui-cli] remove advisory, dry-run, and strict reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
