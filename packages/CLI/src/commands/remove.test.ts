import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createRemoveAdvisoryReport } from "../helpers/removeAdvisory"

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
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)
  console.log("[aminoui-cli] remove advisory report verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
