import assert from "node:assert/strict"
import crypto from "node:crypto"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

const createFakePnpmRemoveEnv = ({ binPath, lockfilePath }: { binPath: string; lockfilePath: string }) => {
  mkdirSync(binPath, { recursive: true })
  writeText(
    path.join(binPath, "pnpm"),
    `#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")

const args = process.argv.slice(2)
const command = args[0]

if (command !== "remove") {
  console.error("expected fake pnpm remove command")
  process.exit(2)
}

const dependencyNames = args.slice(1).filter((arg) => !arg.startsWith("-"))
const packageJsonPath = path.join(process.cwd(), "package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  if (!packageJson[field]) continue

  for (const dependencyName of dependencyNames) {
    delete packageJson[field][dependencyName]
  }

  if (Object.keys(packageJson[field]).length === 0) delete packageJson[field]
}

fs.writeFileSync(packageJsonPath, \`\${JSON.stringify(packageJson, null, 2)}\\n\`)
fs.writeFileSync(
  ${JSON.stringify(lockfilePath)},
  \`\${JSON.stringify(
    {
      args,
      dependencyNames,
      packageManager: "pnpm",
    },
    null,
    2,
  )}\\n\`,
)
`,
  )
  chmodSync(path.join(binPath, "pnpm"), 0o755)
}

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
    "source/orphan-primary.ts",
    "source/orphan-component.ts",
    "source/orphan-support.ts",
    "source/shared-support.ts",
    "source/other-dependent.ts",
    "consumer/amino-ui.config.json",
    "consumer/amino-ui.lock.json",
    "consumer/src/components/Diff/clean.ts",
    "consumer/src/components/Diff/local-modified.ts",
    "consumer/src/components/Diff/support.ts",
    "consumer/src/components/Diff/shared.ts",
    "consumer/src/components/Diff/unknown.ts",
    "consumer/src/components/Diff/source-only.ts",
    "consumer/src/components/Graph/orphan-primary.ts",
    "consumer/src/components/Graph/orphan-component.ts",
    "consumer/src/components/Graph/other-dependent.ts",
    "consumer/src/components/_registry/tokens/consumer-support.ts",
    "consumer/src/components/_registry/tokens/orphan-support.ts",
    "consumer/src/components/_registry/tokens/shared-support.ts",
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
  const orphanPrimarySource = "export const orphanPrimary = true\n"
  const orphanComponentSource = "export const orphanComponent = true\n"
  const orphanSupportSource = "export const orphanSupport = true\n"
  const sharedSupportSource = "export const sharedSupport = true\n"
  const otherDependentSource = "export const otherDependent = true\n"

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
  writeText(path.join(temporaryRoot, "source/orphan-primary.ts"), orphanPrimarySource)
  writeText(path.join(temporaryRoot, "source/orphan-component.ts"), orphanComponentSource)
  writeText(path.join(temporaryRoot, "source/orphan-support.ts"), orphanSupportSource)
  writeText(path.join(temporaryRoot, "source/shared-support.ts"), sharedSupportSource)
  writeText(path.join(temporaryRoot, "source/other-dependent.ts"), otherDependentSource)
  writeText(path.join(consumerRoot, "src/components/Diff/clean.ts"), cleanSource)
  writeText(path.join(consumerRoot, "src/components/Diff/local-modified.ts"), localModifiedCurrent)
  writeText(path.join(consumerRoot, "src/components/Diff/support.ts"), supportSource)
  writeText(path.join(consumerRoot, "src/components/Diff/shared.ts"), sharedSource)
  writeText(path.join(consumerRoot, "src/components/Diff/unknown.ts"), unknownSource)
  writeText(path.join(consumerRoot, "src/components/Diff/source-only.ts"), sourceOnlySource)
  writeText(path.join(consumerRoot, "src/components/Graph/orphan-primary.ts"), orphanPrimarySource)
  writeText(path.join(consumerRoot, "src/components/Graph/orphan-component.ts"), orphanComponentSource)
  writeText(path.join(consumerRoot, "src/components/Graph/other-dependent.ts"), otherDependentSource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/consumer-support.ts"), consumerSupportSource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/orphan-support.ts"), orphanSupportSource)
  writeText(path.join(consumerRoot, "src/components/_registry/tokens/shared-support.ts"), sharedSupportSource)
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
      {
        files: [
          {
            role: "source",
            sourcePath: "source/orphan-primary.ts",
            targetPath: "Graph/orphan-primary.ts",
            targetRole: "components",
          },
        ],
        name: "orphan-primary",
        peerDependencies: {
          react: "^18.2.0 || ^19.0.0",
        },
        registryDependencies: ["orphan-component", "shared-support"],
        runtimeDependencies: {
          "primary-only": "^1.0.0",
        },
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "source",
            sourcePath: "source/orphan-component.ts",
            targetPath: "Graph/orphan-component.ts",
            targetRole: "components",
          },
        ],
        name: "orphan-component",
        registryDependencies: ["orphan-support"],
        runtimeDependencies: {
          "shared-runtime": "^1.0.0",
        },
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "support",
            sourcePath: "source/orphan-support.ts",
            targetPath: "orphan-support.ts",
            targetRole: "tokens",
          },
        ],
        name: "orphan-support",
        sourcePackage: "@amino-ui/react",
        type: "support",
      },
      {
        files: [
          {
            role: "support",
            sourcePath: "source/shared-support.ts",
            targetPath: "shared-support.ts",
            targetRole: "tokens",
          },
        ],
        name: "shared-support",
        sourcePackage: "@amino-ui/react",
        type: "support",
      },
      {
        files: [
          {
            role: "source",
            sourcePath: "source/other-dependent.ts",
            targetPath: "Graph/other-dependent.ts",
            targetRole: "components",
          },
        ],
        name: "other-dependent",
        registryDependencies: ["shared-support"],
        runtimeDependencies: {
          "shared-runtime": "^1.0.0",
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
      {
        action: "none",
        declaredIn: "dependencies",
        declaredRange: "^1.0.0",
        kind: "runtime",
        name: "primary-only",
        requiredRange: "^1.0.0",
        status: "satisfied",
      },
      {
        action: "none",
        declaredIn: "dependencies",
        declaredRange: "^1.0.0",
        kind: "runtime",
        name: "shared-runtime",
        requiredRange: "^1.0.0",
        status: "satisfied",
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
      "orphan-primary": {
        files: [
          {
            installedHash: createContentHash(orphanPrimarySource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/orphan-primary.ts",
            sourceHash: createContentHash(orphanPrimarySource),
            targetRole: "components",
          },
        ],
        name: "orphan-primary",
        registryDependencies: ["orphan-component", "shared-support"],
        sourceIdentity: "@amino-ui/test-registry",
      },
      "orphan-component": {
        files: [
          {
            installedHash: createContentHash(orphanComponentSource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/orphan-component.ts",
            sourceHash: createContentHash(orphanComponentSource),
            targetRole: "components",
          },
        ],
        name: "orphan-component",
        registryDependencies: ["orphan-support"],
        sourceIdentity: "@amino-ui/test-registry",
      },
      "orphan-support": {
        files: [
          {
            installedHash: createContentHash(orphanSupportSource),
            ownershipState: "registry-owned",
            path: "src/components/_registry/tokens/orphan-support.ts",
            sourceHash: createContentHash(orphanSupportSource),
            targetRole: "tokens",
          },
        ],
        name: "orphan-support",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "shared-support": {
        files: [
          {
            installedHash: createContentHash(sharedSupportSource),
            ownershipState: "registry-owned",
            path: "src/components/_registry/tokens/shared-support.ts",
            sourceHash: createContentHash(sharedSupportSource),
            targetRole: "tokens",
          },
        ],
        name: "shared-support",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "other-dependent": {
        files: [
          {
            installedHash: createContentHash(otherDependentSource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/other-dependent.ts",
            sourceHash: createContentHash(otherDependentSource),
            targetRole: "components",
          },
        ],
        name: "other-dependent",
        registryDependencies: ["shared-support"],
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
  assert.equal(report.orphanCleanup.enabled, false)
  assert.equal(report.orphanCleanup.itemCount, 0)
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

  const orphanAdvisoryReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(orphanAdvisoryReport.itemRemoveState, "remove-candidate")
  assert.equal(orphanAdvisoryReport.summary.removableFileCount, 1)
  assert.equal(orphanAdvisoryReport.orphanCleanup.enabled, true)
  assert.equal(orphanAdvisoryReport.orphanCleanup.itemCount, 2)
  assert.equal(orphanAdvisoryReport.orphanCleanup.candidateItemCount, 2)
  assert.equal(orphanAdvisoryReport.orphanCleanup.candidateFileCount, 2)
  assert.equal(orphanAdvisoryReport.orphanCleanup.automaticBlockerCount, 0)
  assert.equal(orphanAdvisoryReport.dependencyCleanup.enabled, true)
  assert.equal(orphanAdvisoryReport.dependencyCleanup.candidateCount, 2)
  assert.equal(orphanAdvisoryReport.dependencyCleanup.stillRequiredCount, 1)
  assert.equal(orphanAdvisoryReport.dependencyCleanup.unknownCount, 0)
  assert.deepEqual(
    orphanAdvisoryReport.orphanCleanup.items.map((item) => item.name),
    ["orphan-component", "orphan-support"],
  )
  const orphanAdvisoryDependencies = new Map(
    orphanAdvisoryReport.dependencyCleanup.dependencies.map((dependency) => [dependency.name, dependency]),
  )

  assert.equal(orphanAdvisoryDependencies.get("react")?.action, "cleanup-candidate")
  assert.deepEqual(orphanAdvisoryDependencies.get("react")?.cleanupItemNames, ["orphan-primary"])
  assert.equal(orphanAdvisoryDependencies.get("primary-only")?.action, "cleanup-candidate")
  assert.deepEqual(orphanAdvisoryDependencies.get("primary-only")?.cleanupItemNames, ["orphan-primary"])
  assert.equal(orphanAdvisoryDependencies.get("shared-runtime")?.action, "still-required")
  assert.deepEqual(orphanAdvisoryDependencies.get("shared-runtime")?.cleanupItemNames, ["orphan-component"])
  assert.deepEqual(orphanAdvisoryDependencies.get("shared-runtime")?.remainingItemNames, ["other-dependent"])
  assert.equal(
    orphanAdvisoryReport.orphanCleanup.items
      .find((item) => item.name === "orphan-support")
      ?.files.find((file) => file.path === "src/components/_registry/tokens/orphan-support.ts")?.action,
    "remove-candidate",
  )
  assert.equal(
    orphanAdvisoryReport.orphanCleanup.items.some((item) => item.name === "shared-support"),
    false,
  )

  const orphanDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(orphanDryRunReport.itemRemoveState, "would-remove")
  assert.equal(orphanDryRunReport.summary.wouldRemoveFileCount, 1)
  assert.equal(orphanDryRunReport.orphanCleanup.enabled, true)
  assert.equal(orphanDryRunReport.orphanCleanup.itemCount, 2)
  assert.equal(orphanDryRunReport.orphanCleanup.wouldRemoveItemCount, 2)
  assert.equal(orphanDryRunReport.orphanCleanup.wouldRemoveFileCount, 2)
  assert.equal(orphanDryRunReport.orphanCleanup.wouldRemoveLockfileRecordCount, 2)
  assert.equal(orphanDryRunReport.orphanCleanup.blockedItemCount, 0)
  assert.equal(orphanDryRunReport.dependencyCleanup.enabled, true)
  assert.equal(orphanDryRunReport.dependencyCleanup.candidateCount, 2)
  assert.equal(orphanDryRunReport.dependencyCleanup.stillRequiredCount, 1)
  assert.equal(orphanDryRunReport.wouldEffects.lockfile.status, "would-write")
  assert.equal(orphanDryRunReport.wouldEffects.dependencies.status, "not-written")
  assert.equal(orphanDryRunReport.wouldEffects.dependencies.plannedRemovalCount, 2)
  assert.equal(orphanDryRunReport.wouldEffects.orphanCleanup.status, "would-write")
  assert.equal(orphanDryRunReport.wouldEffects.orphanCleanup.plannedItemCount, 2)
  assert.equal(orphanDryRunReport.wouldEffects.orphanCleanup.wouldRemoveFileCount, 2)
  assert.deepEqual(
    orphanDryRunReport.orphanCleanup.items.map((item) => item.name),
    ["orphan-component", "orphan-support"],
  )

  writeText(path.join(consumerRoot, "src/components/Graph/orphan-primary.ts"), "export const orphanPrimary = 'local'\n")

  const primaryBlockedOrphanAdvisoryReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(primaryBlockedOrphanAdvisoryReport.itemRemoveState, "review-required")
  assert.equal(primaryBlockedOrphanAdvisoryReport.orphanCleanup.enabled, true)
  assert.equal(primaryBlockedOrphanAdvisoryReport.orphanCleanup.itemCount, 2)
  assert.equal(primaryBlockedOrphanAdvisoryReport.orphanCleanup.candidateItemCount, 0)
  assert.equal(primaryBlockedOrphanAdvisoryReport.dependencyCleanup.enabled, false)

  const primaryBlockedOrphanDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(primaryBlockedOrphanDryRunReport.itemRemoveState, "blocked")
  assert.equal(primaryBlockedOrphanDryRunReport.orphanCleanup.enabled, true)
  assert.equal(primaryBlockedOrphanDryRunReport.orphanCleanup.blockedItemCount, 2)
  assert.equal(primaryBlockedOrphanDryRunReport.orphanCleanup.wouldRemoveItemCount, 0)
  assert.equal(primaryBlockedOrphanDryRunReport.wouldEffects.orphanCleanup.status, "blocked")
  assert.equal(primaryBlockedOrphanDryRunReport.wouldEffects.dependencies.plannedRemovalCount, 0)

  const primaryBlockedSnapshot = readFixtureSnapshot(temporaryRoot)
  const primaryBlockedStrictReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(primaryBlockedStrictReport.applied, false)
  assert.equal(primaryBlockedStrictReport.itemRemoveState, "blocked")
  assert.equal(primaryBlockedStrictReport.effects.writesFiles, false)
  assert.equal(primaryBlockedStrictReport.effects.writesLockfile, false)
  assert.equal(primaryBlockedStrictReport.effects.orphanCleanup.status, "blocked")
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), primaryBlockedSnapshot)
  writeText(path.join(consumerRoot, "src/components/Graph/orphan-primary.ts"), orphanPrimarySource)

  writeText(
    path.join(consumerRoot, "src/components/Graph/orphan-component.ts"),
    "export const orphanComponent = 'local'\n",
  )

  const orphanBlockedAdvisoryReport = await createRemoveAdvisoryReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })
  const orphanBlockedAdvisoryDependencies = new Map(
    orphanBlockedAdvisoryReport.dependencyCleanup.dependencies.map((dependency) => [dependency.name, dependency]),
  )

  assert.equal(orphanBlockedAdvisoryReport.itemRemoveState, "remove-candidate")
  assert.equal(orphanBlockedAdvisoryReport.orphanCleanup.enabled, true)
  assert.equal(orphanBlockedAdvisoryReport.orphanCleanup.candidateItemCount, 1)
  assert.equal(orphanBlockedAdvisoryReport.orphanCleanup.automaticBlockerCount, 1)
  assert.equal(
    orphanBlockedAdvisoryReport.orphanCleanup.items.find((item) => item.name === "orphan-component")?.itemRemoveState,
    "review-required",
  )
  assert.equal(
    orphanBlockedAdvisoryReport.orphanCleanup.items.find((item) => item.name === "orphan-support")?.itemRemoveState,
    "remove-candidate",
  )
  assert.equal(orphanBlockedAdvisoryReport.dependencyCleanup.enabled, true)
  assert.equal(orphanBlockedAdvisoryReport.dependencyCleanup.candidateCount, 2)
  assert.equal(orphanBlockedAdvisoryReport.dependencyCleanup.stillRequiredCount, 0)
  assert.equal(orphanBlockedAdvisoryDependencies.has("shared-runtime"), false)

  const orphanBlockedDryRunReport = await createRemoveDryRunReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(orphanBlockedDryRunReport.itemRemoveState, "would-remove")
  assert.equal(orphanBlockedDryRunReport.orphanCleanup.enabled, true)
  assert.equal(orphanBlockedDryRunReport.orphanCleanup.blockedItemCount, 1)
  assert.equal(orphanBlockedDryRunReport.orphanCleanup.wouldRemoveItemCount, 1)
  assert.equal(orphanBlockedDryRunReport.wouldEffects.orphanCleanup.status, "blocked")
  assert.equal(orphanBlockedDryRunReport.wouldEffects.dependencies.status, "not-written")
  assert.equal(orphanBlockedDryRunReport.wouldEffects.dependencies.plannedRemovalCount, 0)

  const orphanBlockedSnapshot = readFixtureSnapshot(temporaryRoot)
  const orphanBlockedStrictReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(orphanBlockedStrictReport.applied, false)
  assert.equal(orphanBlockedStrictReport.itemRemoveState, "blocked")
  assert.equal(orphanBlockedStrictReport.effects.writesFiles, false)
  assert.equal(orphanBlockedStrictReport.effects.writesLockfile, false)
  assert.equal(orphanBlockedStrictReport.effects.orphanCleanup.status, "blocked")
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), orphanBlockedSnapshot)
  writeText(path.join(consumerRoot, "src/components/Graph/orphan-component.ts"), orphanComponentSource)
  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

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
  assert.equal(mixedDryRunReport.orphanCleanup.enabled, false)
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

  const strictOrphanReport = await createRemoveStrictReport({
    cwd: consumerRoot,
    includeOrphans: true,
    itemName: "orphan-primary",
    registrySourcePath,
  })

  assert.equal(strictOrphanReport.applied, true)
  assert.equal(strictOrphanReport.itemRemoveState, "removed")
  assert.equal(strictOrphanReport.effects.writesFiles, true)
  assert.equal(strictOrphanReport.effects.writesLockfile, true)
  assert.equal(strictOrphanReport.effects.files.deletedCount, 1)
  assert.equal(strictOrphanReport.effects.lockfile.removedFileRecordCount, 1)
  assert.equal(strictOrphanReport.orphanCleanup.enabled, true)
  assert.equal(strictOrphanReport.orphanCleanup.itemCount, 2)
  assert.equal(strictOrphanReport.orphanCleanup.removedItemCount, 2)
  assert.equal(strictOrphanReport.orphanCleanup.deletedFileCount, 2)
  assert.equal(strictOrphanReport.orphanCleanup.removedLockfileRecordCount, 2)
  assert.equal(strictOrphanReport.orphanCleanup.blockedItemCount, 0)
  assert.equal(strictOrphanReport.effects.orphanCleanup.status, "written")
  assert.equal(strictOrphanReport.effects.orphanCleanup.removedItemCount, 2)
  assert.equal(strictOrphanReport.effects.orphanCleanup.removedFileRecordCount, 2)
  assert.deepEqual(
    strictOrphanReport.orphanCleanup.items.map((item) => item.name),
    ["orphan-component", "orphan-support"],
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/Graph/orphan-primary.ts")),
    false,
    "expected primary registry file to be removed",
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/Graph/orphan-component.ts")),
    false,
    "expected orphan component file to be removed",
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/_registry/tokens/orphan-support.ts")),
    false,
    "expected orphan support file to be removed",
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/_registry/tokens/shared-support.ts")),
    true,
    "expected shared support file to be preserved",
  )
  assert.equal(
    existsSync(path.join(consumerRoot, "src/components/Graph/other-dependent.ts")),
    true,
    "expected outside dependent file to be preserved",
  )
  assert.equal(strictOrphanReport.lockfileData.items["orphan-primary"], undefined)
  assert.equal(strictOrphanReport.lockfileData.items["orphan-component"], undefined)
  assert.equal(strictOrphanReport.lockfileData.items["orphan-support"], undefined)
  assert.equal(strictOrphanReport.lockfileData.items["shared-support"]?.name, "shared-support")
  assert.equal(strictOrphanReport.lockfileData.items["other-dependent"]?.name, "other-dependent")
  assert.equal(readJson(path.join(consumerRoot, "amino-ui.lock.json")).items["orphan-primary"], undefined)
  assert.equal(
    existsSync(path.join(temporaryRoot, "source/orphan-component.ts")),
    true,
    "expected registry source to remain untouched",
  )

  const cleanupConsumerRoot = path.join(temporaryRoot, "consumer-cleanup")

  writeText(path.join(cleanupConsumerRoot, "src/components/Graph/orphan-primary.ts"), orphanPrimarySource)
  writeText(path.join(cleanupConsumerRoot, "src/components/Graph/orphan-component.ts"), orphanComponentSource)
  writeText(path.join(cleanupConsumerRoot, "src/components/Graph/other-dependent.ts"), otherDependentSource)
  writeText(path.join(cleanupConsumerRoot, "src/components/_registry/tokens/orphan-support.ts"), orphanSupportSource)
  writeText(path.join(cleanupConsumerRoot, "src/components/_registry/tokens/shared-support.ts"), sharedSupportSource)
  writeJson(path.join(cleanupConsumerRoot, "amino-ui.config.json"), {})
  writeJson(path.join(cleanupConsumerRoot, "package.json"), {
    dependencies: {
      "primary-only": "^1.0.0",
      "shared-runtime": "^1.0.0",
    },
    name: "cleanup-consumer",
    packageManager: "pnpm@9.15.0",
  })
  writeJson(path.join(cleanupConsumerRoot, "amino-ui.lock.json"), {
    configFile: "amino-ui.config.json",
    dependencies: [
      {
        action: "none",
        kind: "peer",
        name: "react",
        requiredRange: "^18.2.0 || ^19.0.0",
        status: "missing",
      },
      {
        action: "none",
        declaredIn: "dependencies",
        declaredRange: "^1.0.0",
        kind: "runtime",
        name: "primary-only",
        requiredRange: "^1.0.0",
        status: "satisfied",
      },
      {
        action: "none",
        declaredIn: "dependencies",
        declaredRange: "^1.0.0",
        kind: "runtime",
        name: "shared-runtime",
        requiredRange: "^1.0.0",
        status: "satisfied",
      },
    ],
    items: {
      "orphan-component": {
        files: [
          {
            installedHash: createContentHash(orphanComponentSource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/orphan-component.ts",
            sourceHash: createContentHash(orphanComponentSource),
            targetRole: "components",
          },
        ],
        name: "orphan-component",
        registryDependencies: ["orphan-support"],
        sourceIdentity: "@amino-ui/test-registry",
      },
      "orphan-primary": {
        files: [
          {
            installedHash: createContentHash(orphanPrimarySource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/orphan-primary.ts",
            sourceHash: createContentHash(orphanPrimarySource),
            targetRole: "components",
          },
        ],
        name: "orphan-primary",
        registryDependencies: ["orphan-component", "shared-support"],
        sourceIdentity: "@amino-ui/test-registry",
      },
      "orphan-support": {
        files: [
          {
            installedHash: createContentHash(orphanSupportSource),
            ownershipState: "registry-owned",
            path: "src/components/_registry/tokens/orphan-support.ts",
            sourceHash: createContentHash(orphanSupportSource),
            targetRole: "tokens",
          },
        ],
        name: "orphan-support",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "other-dependent": {
        files: [
          {
            installedHash: createContentHash(otherDependentSource),
            ownershipState: "registry-owned",
            path: "src/components/Graph/other-dependent.ts",
            sourceHash: createContentHash(otherDependentSource),
            targetRole: "components",
          },
        ],
        name: "other-dependent",
        registryDependencies: ["shared-support"],
        sourceIdentity: "@amino-ui/test-registry",
      },
      "shared-support": {
        files: [
          {
            installedHash: createContentHash(sharedSupportSource),
            ownershipState: "registry-owned",
            path: "src/components/_registry/tokens/shared-support.ts",
            sourceHash: createContentHash(sharedSupportSource),
            targetRole: "tokens",
          },
        ],
        name: "shared-support",
        sourceIdentity: "@amino-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const fakePnpmBinPath = path.join(temporaryRoot, "fake-pnpm-bin")
  const fakePnpmLockfilePath = path.join(cleanupConsumerRoot, "pnpm-lock.yaml")
  const originalPath = process.env.PATH

  createFakePnpmRemoveEnv({
    binPath: fakePnpmBinPath,
    lockfilePath: fakePnpmLockfilePath,
  })
  process.env.PATH = `${fakePnpmBinPath}${path.delimiter}${originalPath ?? ""}`

  try {
    const strictDependencyCleanupReport = await createRemoveStrictReport({
      cwd: cleanupConsumerRoot,
      includeOrphans: true,
      itemName: "orphan-primary",
      registrySourcePath,
      removeDependencies: true,
    })

    assert.equal(strictDependencyCleanupReport.applied, true)
    assert.equal(strictDependencyCleanupReport.dependencyCleanup.candidateCount, 2)
    assert.equal(strictDependencyCleanupReport.dependencyCleanup.stillRequiredCount, 1)
    assert.equal(strictDependencyCleanupReport.dependencyCleanupExecution.mode, "eligible")
    assert.equal(strictDependencyCleanupReport.dependencyCleanupExecution.removeDependenciesRequested, true)
    assert.equal(strictDependencyCleanupReport.dependencyCleanupExecution.packageManager.name, "pnpm")
    assert.equal(strictDependencyCleanupReport.dependencyCleanupExecution.packageManager.source, "packageManager-field")
    assert.equal(strictDependencyCleanupReport.dependencyCleanupExecution.recommendedCommands.length, 1)
    assert.deepEqual(strictDependencyCleanupReport.dependencyCleanupExecution.recommendedCommands[0].args, [
      "remove",
      "primary-only",
    ])
    assert.deepEqual(strictDependencyCleanupReport.dependencyCleanupExecution.executedCommands[0].args, [
      "remove",
      "primary-only",
    ])
    assert.equal(strictDependencyCleanupReport.effects.dependencies.plannedRemovalCount, 2)
    assert.equal(strictDependencyCleanupReport.effects.dependencies.removedCount, 2)
    assert.equal(strictDependencyCleanupReport.effects.dependencies.status, "written")
    assert.equal(strictDependencyCleanupReport.effects.dependencies.packageManagerExecution, "completed")
    assert.equal(strictDependencyCleanupReport.effects.dependencies.packageManagerWrites, true)
    assert.equal(strictDependencyCleanupReport.effects.removesDependencies, true)
    assert.deepEqual(
      strictDependencyCleanupReport.lockfileData.dependencies.map((dependency) => dependency.name),
      ["shared-runtime"],
    )
    assert.deepEqual(
      strictDependencyCleanupReport.dependencies.map((dependency) => dependency.name),
      ["shared-runtime"],
    )
    assert.deepEqual(readJson(fakePnpmLockfilePath).args, ["remove", "primary-only"])
    assert.equal(readJson(path.join(cleanupConsumerRoot, "package.json")).dependencies["primary-only"], undefined)
    assert.equal(readJson(path.join(cleanupConsumerRoot, "package.json")).dependencies["shared-runtime"], "^1.0.0")
    assert.deepEqual(
      readJson(path.join(cleanupConsumerRoot, "amino-ui.lock.json")).dependencies.map(
        (dependency: { name: string }) => dependency.name,
      ),
      ["shared-runtime"],
    )
  } finally {
    process.env.PATH = originalPath
  }

  console.log("[aminoui-cli] remove advisory, dry-run, strict, and orphan cleanup reports verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
