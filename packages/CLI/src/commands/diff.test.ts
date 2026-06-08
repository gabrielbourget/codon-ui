import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createDiffReport } from "../helpers/diff"

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
    "source/source-changed.ts",
    "source/local-modified.ts",
    "source/missing.ts",
    "source/unknown.ts",
    "source/support.ts",
    "source/ejected.ts",
    "consumer/amino-ui.config.json",
    "consumer/amino-ui.lock.json",
    "consumer/src/components/Diff/clean.ts",
    "consumer/src/components/Diff/source-changed.ts",
    "consumer/src/components/Diff/local-modified.ts",
    "consumer/src/components/Diff/unknown.ts",
    "consumer/src/components/_registry/tokens/support.ts",
    "consumer/src/components/_registry/utils/ejected.ts",
  ]
    .filter((filePath) => existsSync(path.join(fixturePath, filePath)))
    .map((filePath) => `${filePath}:${createContentHash(readFileSync(path.join(fixturePath, filePath)))}`)
    .sort()

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "amino-ui-diff-"))

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
  const ejectedSource = "export const ejected = 'registry'\n"
  const ejectedCurrent = "export const ejected = 'consumer'\n"

  writeText(path.join(temporaryRoot, "source/clean.ts"), cleanSource)
  writeText(path.join(temporaryRoot, "source/source-changed.ts"), sourceChangedCurrent)
  writeText(path.join(temporaryRoot, "source/local-modified.ts"), localModifiedInstalled)
  writeText(path.join(temporaryRoot, "source/missing.ts"), missingSource)
  writeText(path.join(temporaryRoot, "source/unknown.ts"), unknownSource)
  writeText(path.join(temporaryRoot, "source/support.ts"), supportSource)
  writeText(path.join(temporaryRoot, "source/ejected.ts"), ejectedSource)
  writeText(path.join(consumerRoot, "src/components/Diff/clean.ts"), cleanSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-changed.ts"), sourceChangedInstalled)
  writeText(path.join(consumerRoot, "src/components/Diff/local-modified.ts"), localModifiedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/unknown.ts"), unknownSource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/support.ts"), supportSource)
  writeText(path.join(consumerRoot, "src/components/_registry/utils/ejected.ts"), ejectedCurrent)
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
    ],
    schemaVersion: 1,
    sourceIdentity: "@amino-ui/test-registry",
    sourceRoot: ".",
  })
  writeJson(path.join(consumerRoot, "amino-ui.lock.json"), {
    configFile: "amino-ui.config.json",
    items: {
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
  const report = await createDiffReport({
    cwd: consumerRoot,
    itemName: "switch",
    registrySourcePath,
  })

  assert.equal(report.schemaVersion, 1)
  assert.deepEqual(report.effects, {
    installsDependencies: false,
    writesConfig: false,
    writesFiles: false,
    writesLockfile: false,
  })
  assert.equal(report.registrySource.status, "loaded")
  assert.equal(report.item?.name, "switch")
  assert.equal(report.summary.fileCount, 7)
  assert.equal(report.summary.comparisonStates["no-change"], 1)
  assert.equal(report.summary.comparisonStates["source-changed"], 1)
  assert.equal(report.summary.comparisonStates["local-modification"], 1)
  assert.equal(report.summary.comparisonStates["missing-local-file"], 1)
  assert.equal(report.summary.comparisonStates["unknown-ownership"], 1)
  assert.equal(report.summary.comparisonStates["consumer-owned-support"], 1)
  assert.equal(report.summary.comparisonStates.ejected, 1)
  assert.equal(report.summary.localChangeCount, 1)
  assert.equal(report.summary.sourceChangedCount, 1)
  assert.equal(report.summary.preservationRequiredCount, 5)
  assert.equal(report.summary.reviewRequiredCount, 5)
  assert.equal(report.summary.sourceUnavailableCount, 0)

  const files = new Map(report.files.map((file) => [file.path, file]))
  const sourceChangedFile = files.get("src/components/Diff/source-changed.ts")
  const localModifiedFile = files.get("src/components/Diff/local-modified.ts")
  const supportFile = files.get("src/components/_registry/tokens/support.ts")

  assert.equal(sourceChangedFile?.recommendation, "review-source-change")
  assert.equal(localModifiedFile?.recommendation, "preserve-local-change")
  assert.equal(supportFile?.reviewRequired, false)
  assert(
    localModifiedFile?.sourceToLocalDiff.some((segment) => segment.kind === "registry-source"),
    "expected local modification diff to include registry-source segment",
  )
  assert(
    localModifiedFile?.sourceToLocalDiff.some((segment) => segment.kind === "consumer-local"),
    "expected local modification diff to include consumer-local segment",
  )

  const missingReport = await createDiffReport({
    cwd: consumerRoot,
    itemName: "missing-item",
    registrySourcePath,
  })

  assert.equal(missingReport.files.length, 0)
  assert(
    missingReport.findings.some((finding) => finding.code === "status-lockfile-item-missing"),
    "expected missing item finding",
  )
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)
  console.log("[aminoui-cli] diff report verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
