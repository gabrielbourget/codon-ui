import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createEjectAdvisoryReport } from "../helpers/ejectAdvisory"
import { createEjectDryRunReport } from "../helpers/ejectDryRun"
import { createEjectStrictReport } from "../helpers/ejectStrict"
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
    "source/local-modified.ts",
    "source/missing.ts",
    "source/support.ts",
    "source/shared.ts",
    "source/unknown.ts",
    "source/consumer-support.ts",
    "source/ejected.ts",
    "source/source-only.ts",
    "source/ejected-only.ts",
    "consumer/codon-ui.config.json",
    "consumer/codon-ui.lock.json",
    "consumer/src/components/Diff/clean.ts",
    "consumer/src/components/Diff/local-modified.ts",
    "consumer/src/components/Diff/support.ts",
    "consumer/src/components/Diff/shared.ts",
    "consumer/src/components/Diff/unknown.ts",
    "consumer/src/components/Diff/source-only.ts",
    "consumer/src/components/Diff/ejected-only.ts",
    "consumer/src/components/_registry/tokens/consumer-support.ts",
    "consumer/src/components/_registry/utils/ejected.ts",
  ]
    .filter((filePath) => existsSync(path.join(fixturePath, filePath)))
    .map((filePath) => `${filePath}:${createContentHash(readFileSync(path.join(fixturePath, filePath)))}`)
    .sort()

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "codon-ui-eject-advisory-"))

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
  const ejectedOnlySource = "export const ejectedOnly = true\n"

  writeText(path.join(temporaryRoot, "source/clean.ts"), cleanSource)
  writeText(path.join(temporaryRoot, "source/local-modified.ts"), localModifiedInstalled)
  writeText(path.join(temporaryRoot, "source/missing.ts"), missingSource)
  writeText(path.join(temporaryRoot, "source/support.ts"), supportSource)
  writeText(path.join(temporaryRoot, "source/shared.ts"), sharedSource)
  writeText(path.join(temporaryRoot, "source/unknown.ts"), unknownSource)
  writeText(path.join(temporaryRoot, "source/consumer-support.ts"), consumerSupportSource)
  writeText(path.join(temporaryRoot, "source/ejected.ts"), ejectedSource)
  writeText(path.join(temporaryRoot, "source/source-only.ts"), sourceOnlySource)
  writeText(path.join(temporaryRoot, "source/ejected-only.ts"), ejectedOnlySource)
  writeText(path.join(consumerRoot, "src/components/Diff/clean.ts"), cleanSource)
  writeText(path.join(consumerRoot, "src/components/Diff/local-modified.ts"), localModifiedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/support.ts"), supportSource)
  writeText(path.join(consumerRoot, "src/components/Diff/shared.ts"), sharedSource)
  writeText(path.join(consumerRoot, "src/components/Diff/unknown.ts"), unknownSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-only.ts"), sourceOnlySource)
  writeText(path.join(consumerRoot, "src/components/Diff/ejected-only.ts"), ejectedOnlySource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/consumer-support.ts"), consumerSupportSource)
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
            sourcePath: "source/ejected-only.ts",
            targetPath: "Diff/ejected-only.ts",
            targetRole: "components",
          },
        ],
        name: "ejected-only",
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
      "ejected-only": {
        files: [
          {
            installedHash: createContentHash(ejectedOnlySource),
            ownershipState: "ejected",
            path: "src/components/Diff/ejected-only.ts",
            sourceHash: createContentHash(ejectedOnlySource),
            targetRole: "components",
          },
        ],
        name: "ejected-only",
        sourceIdentity: "@codon-ui/test-registry",
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
        sourceIdentity: "@codon-ui/test-registry",
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
        sourceIdentity: "@codon-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const initialSnapshot = readFixtureSnapshot(temporaryRoot)
  const report = await createEjectAdvisoryReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assertCliJsonReportContract({ report, schemaName: "ejectAdvisory" })
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.advisory, true)
  assert.deepEqual(report.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(report.itemEjectState, "review-required")
  assert.equal(report.summary.fileCount, 8)
  assert.equal(report.summary.ejectCandidateCount, 1)
  assert.equal(report.summary.missingFileReviewCount, 1)
  assert.equal(report.summary.supportReviewCount, 1)
  assert.equal(report.summary.sharedReferenceCount, 1)
  assert.equal(report.summary.alreadyEjectedCount, 1)
  assert.equal(report.summary.reviewRequiredCount, 6)
  assert.equal(report.summary.preservationRequiredCount, 4)
  assert.equal(report.summary.automaticBlockerCount, 6)
  assert.equal(report.summary.dependencyStates.missing, 1)
  assert.equal(report.summary.actionStates["eject-candidate"], 1)
  assert.equal(report.summary.actionStates["review-missing-file"], 1)
  assert.equal(report.summary.actionStates["review-support-file"], 1)
  assert.equal(report.summary.actionStates["review-shared-file"], 1)
  assert.equal(report.summary.actionStates["preserve-local-change"], 1)
  assert.equal(report.summary.actionStates["preserve-consumer-owned-support"], 1)
  assert.equal(report.summary.actionStates["preserve-unknown"], 1)
  assert.equal(report.summary.actionStates["already-ejected"], 1)

  const files = new Map(report.files.map((file) => [file.path, file]))

  assert.equal(files.get("src/components/Diff/clean.ts")?.action, "eject-candidate")
  assert.equal(files.get("src/components/Diff/clean.ts")?.ejectionTarget, "lockfile-ownership")
  assert.equal(files.get("src/components/Diff/clean.ts")?.blocksAutomaticEject, false)
  assert.equal(files.get("src/components/Diff/missing.ts")?.action, "review-missing-file")
  assert.equal(files.get("src/components/Diff/missing.ts")?.ejectionTarget, "none")
  assert.equal(files.get("src/components/Diff/support.ts")?.action, "review-support-file")
  assert.equal(files.get("src/components/Diff/shared.ts")?.action, "review-shared-file")
  assert.equal(files.get("src/components/Diff/shared.ts")?.sharedReferenceCount, 1)
  assert.equal(files.get("src/components/Diff/local-modified.ts")?.action, "preserve-local-change")
  assert.equal(files.get("src/components/Diff/unknown.ts")?.action, "preserve-unknown")
  assert.equal(
    files.get("src/components/_registry/tokens/consumer-support.ts")?.action,
    "preserve-consumer-owned-support",
  )
  assert.equal(files.get("src/components/_registry/utils/ejected.ts")?.action, "already-ejected")
  assert.equal(files.get("src/components/_registry/utils/ejected.ts")?.blocksAutomaticEject, false)

  const sourceOnlyReport = await createEjectAdvisoryReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyReport.itemEjectState, "eject-candidate")
  assert.equal(sourceOnlyReport.summary.ejectCandidateCount, 1)
  assert.equal(sourceOnlyReport.summary.automaticBlockerCount, 0)
  assert.equal(sourceOnlyReport.files[0].action, "eject-candidate")
  assert.equal(sourceOnlyReport.files[0].ejectionTarget, "lockfile-ownership")

  const ejectedOnlyReport = await createEjectAdvisoryReport({
    cwd: consumerRoot,
    itemName: "ejected-only",
    registrySourcePath,
  })

  assert.equal(ejectedOnlyReport.itemEjectState, "already-ejected")
  assert.equal(ejectedOnlyReport.summary.alreadyEjectedCount, 1)
  assert.equal(ejectedOnlyReport.summary.automaticBlockerCount, 0)
  assert.equal(ejectedOnlyReport.files[0].action, "already-ejected")
  assert.equal(ejectedOnlyReport.files[0].preservationRequired, true)

  const dryRunReport = await createEjectDryRunReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: dryRunReport, schemaName: "ejectDryRun" })
  assert.equal(dryRunReport.schemaVersion, 1)
  assert.equal(dryRunReport.dryRun, true)
  assert.deepEqual(dryRunReport.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.deepEqual(dryRunReport.wouldEffects.dependencies, {
    plannedMutationCount: 0,
    status: "not-written",
  })
  assert.equal(dryRunReport.itemEjectState, "blocked")
  assert.equal(dryRunReport.summary.fileCount, 8)
  assert.equal(dryRunReport.summary.ejectCandidateCount, 1)
  assert.equal(dryRunReport.summary.missingFileReviewCount, 1)
  assert.equal(dryRunReport.summary.supportReviewBlockerCount, 1)
  assert.equal(dryRunReport.summary.sharedReferenceBlockerCount, 1)
  assert.equal(dryRunReport.summary.preservationBlockerCount, 3)
  assert.equal(dryRunReport.summary.reviewBlockerCount, 2)
  assert.equal(dryRunReport.summary.skippedFileCount, 6)
  assert.equal(dryRunReport.summary.blockedFileCount, 1)
  assert.equal(dryRunReport.summary.alreadyEjectedCount, 1)
  assert.equal(dryRunReport.summary.blockerCount, 7)
  assert.equal(dryRunReport.summary.wouldEjectLockfileRecordCount, 0)
  assert.equal(dryRunReport.summary.dependencyStates.missing, 1)
  assert.equal(dryRunReport.summary.fileActions["would-eject-lockfile-ownership"], 0)
  assert.equal(dryRunReport.summary.fileActions["skip-review-required"], 3)
  assert.equal(dryRunReport.summary.fileActions["skip-preserved-local-change"], 1)
  assert.equal(dryRunReport.summary.fileActions["skip-consumer-owned-support"], 1)
  assert.equal(dryRunReport.summary.fileActions["skip-unknown"], 1)
  assert.equal(dryRunReport.summary.fileActions["already-ejected"], 1)
  assert.equal(dryRunReport.summary.fileActions.blocked, 1)
  assert.equal(dryRunReport.wouldEffects.files.blockedCount, 1)
  assert.equal(dryRunReport.wouldEffects.files.skippedCount, 6)
  assert.equal(dryRunReport.wouldEffects.files.alreadyEjectedCount, 1)
  assert.equal(dryRunReport.wouldEffects.files.wouldEjectCount, 0)
  assert.equal(dryRunReport.wouldEffects.lockfile.status, "blocked")
  assert.equal(dryRunReport.wouldEffects.lockfile.wouldEjectFileRecordCount, 0)
  assert.equal(dryRunReport.wouldEffects.lockfile.wouldEjectItem, false)

  const dryRunFiles = new Map(dryRunReport.files.map((file) => [file.path, file]))

  assert.equal(dryRunFiles.get("src/components/Diff/clean.ts")?.dryRunAction, "blocked")
  assert.equal(dryRunFiles.get("src/components/Diff/clean.ts")?.wouldEjectLockfileOwnership, false)
  assert.equal(dryRunFiles.get("src/components/Diff/clean.ts")?.blockerCodes[0], "eject-dry-run-item-review-blocker")
  assert.equal(dryRunFiles.get("src/components/Diff/local-modified.ts")?.dryRunAction, "skip-preserved-local-change")
  assert.equal(dryRunFiles.get("src/components/Diff/missing.ts")?.dryRunAction, "skip-review-required")
  assert.equal(dryRunFiles.get("src/components/Diff/support.ts")?.dryRunAction, "skip-review-required")
  assert.equal(dryRunFiles.get("src/components/Diff/shared.ts")?.dryRunAction, "skip-review-required")
  assert.equal(dryRunFiles.get("src/components/Diff/unknown.ts")?.dryRunAction, "skip-unknown")
  assert.equal(
    dryRunFiles.get("src/components/_registry/tokens/consumer-support.ts")?.dryRunAction,
    "skip-consumer-owned-support",
  )
  assert.equal(dryRunFiles.get("src/components/_registry/utils/ejected.ts")?.dryRunAction, "already-ejected")
  assert.equal(dryRunFiles.get("src/components/_registry/utils/ejected.ts")?.blocksStrictEject, false)

  const sourceOnlyDryRunReport = await createEjectDryRunReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assert.equal(sourceOnlyDryRunReport.itemEjectState, "would-eject")
  assert.equal(sourceOnlyDryRunReport.summary.ejectCandidateCount, 1)
  assert.equal(sourceOnlyDryRunReport.summary.blockerCount, 0)
  assert.equal(sourceOnlyDryRunReport.summary.wouldEjectLockfileRecordCount, 1)
  assert.equal(sourceOnlyDryRunReport.files[0].dryRunAction, "would-eject-lockfile-ownership")
  assert.equal(sourceOnlyDryRunReport.files[0].wouldEjectLockfileOwnership, true)
  assert.equal(sourceOnlyDryRunReport.wouldEffects.lockfile.status, "would-write")
  assert.equal(sourceOnlyDryRunReport.wouldEffects.lockfile.wouldEjectItem, true)

  const ejectedOnlyDryRunReport = await createEjectDryRunReport({
    cwd: consumerRoot,
    itemName: "ejected-only",
    registrySourcePath,
  })

  assert.equal(ejectedOnlyDryRunReport.itemEjectState, "already-ejected")
  assert.equal(ejectedOnlyDryRunReport.summary.alreadyEjectedCount, 1)
  assert.equal(ejectedOnlyDryRunReport.summary.blockerCount, 0)
  assert.equal(ejectedOnlyDryRunReport.summary.wouldEjectLockfileRecordCount, 0)
  assert.equal(ejectedOnlyDryRunReport.files[0].dryRunAction, "already-ejected")
  assert.equal(ejectedOnlyDryRunReport.wouldEffects.lockfile.status, "not-written")

  const strictBlockedReport = await createEjectStrictReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: strictBlockedReport, schemaName: "ejectStrict" })
  assert.equal(strictBlockedReport.applied, false)
  assert.equal(strictBlockedReport.itemEjectState, "blocked")
  assert.equal(strictBlockedReport.effects.writesFiles, false)
  assert.equal(strictBlockedReport.effects.writesLockfile, false)
  assert.equal(strictBlockedReport.effects.lockfile.status, "blocked")
  assert.equal(strictBlockedReport.effects.lockfile.ejectedFileRecordCount, 0)
  assert(
    strictBlockedReport.blockers.some((blocker) => blocker.code === "strict-eject-dry-run-blocker"),
    "expected strict eject dry-run blocker",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const strictSourceOnlyReport = await createEjectStrictReport({
    cwd: consumerRoot,
    itemName: "source-only",
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: strictSourceOnlyReport, schemaName: "ejectStrict" })
  assert.equal(strictSourceOnlyReport.applied, true)
  assert.equal(strictSourceOnlyReport.itemEjectState, "ejected")
  assert.equal(strictSourceOnlyReport.effects.writesFiles, false)
  assert.equal(strictSourceOnlyReport.effects.writesLockfile, true)
  assert.equal(strictSourceOnlyReport.effects.files.sourceFileTouchedCount, 0)
  assert.equal(strictSourceOnlyReport.effects.lockfile.ejectedFileRecordCount, 1)
  assert.equal(strictSourceOnlyReport.effects.lockfile.ejectedItem, true)
  assert.equal(strictSourceOnlyReport.effects.lockfile.status, "written")
  assert.equal(strictSourceOnlyReport.dependencies[0].status, "missing")
  assert.equal(strictSourceOnlyReport.files[0].strictAction, "ejected-lockfile-ownership")
  assert.equal(strictSourceOnlyReport.files[0].ejectedLockfileOwnership, true)
  assert.equal(strictSourceOnlyReport.lockfileData.items["source-only"]?.files[0].ownershipState, "ejected")
  assert.equal(
    readJson(path.join(consumerRoot, "codon-ui.lock.json")).items["source-only"].files[0].ownershipState,
    "ejected",
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/Diff/source-only.ts")),
    true,
    "expected source-only file to remain in place",
  )

  const ejectedNoOpSnapshot = readFixtureSnapshot(temporaryRoot)
  const strictEjectedOnlyReport = await createEjectStrictReport({
    cwd: consumerRoot,
    itemName: "ejected-only",
    registrySourcePath,
  })

  assert.equal(strictEjectedOnlyReport.applied, false)
  assert.equal(strictEjectedOnlyReport.itemEjectState, "already-ejected")
  assert.equal(strictEjectedOnlyReport.effects.writesFiles, false)
  assert.equal(strictEjectedOnlyReport.effects.writesLockfile, false)
  assert.equal(strictEjectedOnlyReport.effects.lockfile.status, "not-written")
  assert.equal(strictEjectedOnlyReport.effects.files.alreadyEjectedCount, 1)
  assert.equal(strictEjectedOnlyReport.blockers.length, 0)
  assert.equal(strictEjectedOnlyReport.files[0].strictAction, "already-ejected")
  assert.equal(strictEjectedOnlyReport.files[0].ejectedLockfileOwnership, false)
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), ejectedNoOpSnapshot)

  const missingReport = await createEjectAdvisoryReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingReport.itemEjectState, "unavailable")
  assert.equal(missingReport.files.length, 0)
  assert(
    missingReport.findings.some((finding) => finding.code === "status-lockfile-item-missing"),
    "expected missing item finding",
  )

  const missingDryRunReport = await createEjectDryRunReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingDryRunReport.itemEjectState, "unavailable")
  assert.equal(missingDryRunReport.files.length, 0)
  assert(
    missingDryRunReport.findings.some((finding) => finding.code === "status-lockfile-item-missing"),
    "expected missing item dry-run finding",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), ejectedNoOpSnapshot)
  console.log("[codon-ui] eject advisory, dry-run, and strict reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
