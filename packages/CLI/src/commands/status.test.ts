import assert from "node:assert/strict"
import crypto from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { createStatusReport } from "../helpers/status"
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

const readFixtureSnapshot = (fixturePath: string) =>
  [
    "registry.json",
    "source/Switch.tsx",
    "source/geometry.ts",
    "source/ejected.ts",
    "source/unknown.ts",
    "consumer/amino-ui.config.json",
    "consumer/amino-ui.lock.json",
    "consumer/src/components/Switch/Switch.tsx",
    "consumer/src/components/_registry/tokens/geometry.ts",
    "consumer/src/components/_registry/utils/ejected.ts",
    "consumer/src/components/_registry/utils/unknown.ts",
  ]
    .filter((filePath) => existsSync(path.join(fixturePath, filePath)))
    .map((filePath) => `${filePath}:${createContentHash(readFileSync(path.join(fixturePath, filePath)))}`)
    .sort()

const assertStatusFile = async ({
  consumerRoot,
  expectedSourceState,
  expectedState,
  path: filePath,
  registrySourcePath,
}: {
  consumerRoot: string
  expectedSourceState: string
  expectedState: string
  path: string
  registrySourcePath: string
}) => {
  const report = await createStatusReport({ cwd: consumerRoot, registrySourcePath })
  const file = report.files.find((statusFile) => statusFile.path === filePath)

  assert.equal(report.registrySource.status, "loaded")
  assert.equal(file?.state, expectedState)
  assert.equal(file?.sourceState, expectedSourceState)

  return report
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "amino-ui-status-"))

try {
  const consumerRoot = path.join(temporaryRoot, "consumer")
  const registrySourcePath = path.join(temporaryRoot, "registry.json")
  const switchSourcePath = path.join(temporaryRoot, "source/Switch.tsx")
  const geometrySourcePath = path.join(temporaryRoot, "source/geometry.ts")
  const ejectedSourcePath = path.join(temporaryRoot, "source/ejected.ts")
  const unknownSourcePath = path.join(temporaryRoot, "source/unknown.ts")
  const switchTargetPath = path.join(consumerRoot, "src/components/Switch/Switch.tsx")
  const geometryTargetPath = path.join(consumerRoot, "src/components/_registry/tokens/geometry.ts")
  const ejectedTargetPath = path.join(consumerRoot, "src/components/_registry/utils/ejected.ts")
  const unknownTargetPath = path.join(consumerRoot, "src/components/_registry/utils/unknown.ts")
  const switchSource = "export const Switch = () => null\n"
  const switchInstalled = "export const InstalledSwitch = () => null\n"
  const geometrySource = "export const geometry = 'source'\n"
  const ejectedSource = "export const ejected = true\n"
  const unknownSource = "export const unknown = true\n"

  writeText(switchSourcePath, switchSource)
  writeText(geometrySourcePath, geometrySource)
  writeText(ejectedSourcePath, ejectedSource)
  writeText(unknownSourcePath, unknownSource)
  writeText(switchTargetPath, switchInstalled)
  writeText(geometryTargetPath, geometrySource)
  writeText(ejectedTargetPath, ejectedSource)
  writeText(unknownTargetPath, unknownSource)
  writeJson(path.join(consumerRoot, "amino-ui.config.json"), {})
  writeJson(registrySourcePath, {
    items: [
      {
        files: [
          {
            role: "source",
            sourcePath: "source/Switch.tsx",
            targetPath: "Switch/Switch.tsx",
            targetRole: "components",
          },
        ],
        name: "switch",
        sourcePackage: "@amino-ui/react",
        type: "component",
      },
      {
        files: [
          {
            role: "support",
            sourcePath: "source/geometry.ts",
            targetPath: "geometry.ts",
            targetRole: "tokens",
          },
        ],
        name: "tokens/geometry",
        sourcePackage: "@amino-ui/react",
        type: "support",
      },
      {
        files: [
          {
            role: "support",
            sourcePath: "source/ejected.ts",
            targetPath: "ejected.ts",
            targetRole: "utils",
          },
        ],
        name: "utils/ejected",
        sourcePackage: "@amino-ui/react",
        type: "support",
      },
      {
        files: [
          {
            role: "support",
            sourcePath: "source/unknown.ts",
            targetPath: "unknown.ts",
            targetRole: "utils",
          },
        ],
        name: "utils/unknown",
        sourcePackage: "@amino-ui/react",
        type: "support",
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
        declaredIn: "dependencies",
        declaredRange: "^19.1.0",
        kind: "peer",
        name: "react",
        requiredRange: "^18.2.0 || ^19.0.0",
        status: "satisfied",
      },
    ],
    items: {
      "circle-loader": {
        files: [],
        name: "circle-loader",
        registryDependencies: [],
        sourceIdentity: "@amino-ui/react-local",
      },
      switch: {
        files: [
          {
            installedHash: createContentHash(switchInstalled),
            ownershipState: "registry-owned",
            path: "src/components/Switch/Switch.tsx",
            sourceHash: createContentHash(switchSource),
            targetRole: "components",
          },
        ],
        name: "switch",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "tokens/geometry": {
        files: [
          {
            installedHash: createContentHash(geometrySource),
            ownershipState: "consumer-owned-support",
            path: "src/components/_registry/tokens/geometry.ts",
            sourceHash: createContentHash(geometrySource),
            targetRole: "tokens",
          },
        ],
        name: "tokens/geometry",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "utils/ejected": {
        files: [
          {
            installedHash: createContentHash(ejectedSource),
            ownershipState: "ejected",
            path: "src/components/_registry/utils/ejected.ts",
            sourceHash: createContentHash(ejectedSource),
            targetRole: "utils",
          },
        ],
        name: "utils/ejected",
        sourceIdentity: "@amino-ui/test-registry",
      },
      "utils/unknown": {
        files: [
          {
            installedHash: createContentHash(unknownSource),
            ownershipState: "unknown",
            path: "src/components/_registry/utils/unknown.ts",
            sourceHash: createContentHash(unknownSource),
            targetRole: "utils",
          },
        ],
        name: "utils/unknown",
        sourceIdentity: "@amino-ui/test-registry",
      },
    },
    lockfileVersion: 1,
  })

  const initialSnapshot = readFixtureSnapshot(temporaryRoot)
  const cleanReport = await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "registry-owned",
    path: "src/components/Switch/Switch.tsx",
    registrySourcePath,
  })

  assertCliJsonReportContract({ report: cleanReport, schemaName: "status" })
  assert.equal(cleanReport.summary.fileStates["registry-owned"], 1)
  assert.equal(cleanReport.summary.fileStates["consumer-owned-support"], 1)
  assert.equal(cleanReport.summary.fileStates.ejected, 1)
  assert.equal(cleanReport.summary.fileStates.unknown, 1)
  assert.equal(cleanReport.summary.sourceStates["up-to-date"], 4)
  assert.equal(cleanReport.dependencies.length, 1)
  assert.equal(cleanReport.summary.dependencyStates.satisfied, 1)

  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "consumer-owned-support",
    path: "src/components/_registry/tokens/geometry.ts",
    registrySourcePath,
  })
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "ejected",
    path: "src/components/_registry/utils/ejected.ts",
    registrySourcePath,
  })
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "unknown",
    path: "src/components/_registry/utils/unknown.ts",
    registrySourcePath,
  })

  assert.deepEqual(readFixtureSnapshot(temporaryRoot), initialSnapshot)

  const defaultComponentSourceReport = await createStatusReport({ cwd: consumerRoot, itemName: "circle-loader" })

  assertCliJsonReportContract({ report: defaultComponentSourceReport, schemaName: "status" })
  assert.equal(defaultComponentSourceReport.registrySource.status, "loaded")
  assert.equal(path.basename(defaultComponentSourceReport.registrySource.path ?? ""), "local-react.registry.json")
  assert.equal(defaultComponentSourceReport.registrySource.sourceIdentity, "@amino-ui/react-local")
  assert.equal(defaultComponentSourceReport.dependencies.length, 1)
  assert.equal(defaultComponentSourceReport.summary.dependencyStates.satisfied, 1)

  writeText(ejectedTargetPath, "export const EjectedLocalChange = true\n")
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "ejected",
    path: "src/components/_registry/utils/ejected.ts",
    registrySourcePath,
  })

  writeText(ejectedTargetPath, ejectedSource)
  writeText(switchTargetPath, "export const LocalChange = true\n")
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "up-to-date",
    expectedState: "locally-modified",
    path: "src/components/Switch/Switch.tsx",
    registrySourcePath,
  })

  writeText(switchTargetPath, switchInstalled)
  writeText(switchSourcePath, "export const SourceChange = true\n")
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "source-changed",
    expectedState: "registry-owned",
    path: "src/components/Switch/Switch.tsx",
    registrySourcePath,
  })

  rmSync(switchTargetPath)
  await assertStatusFile({
    consumerRoot,
    expectedSourceState: "source-changed",
    expectedState: "missing",
    path: "src/components/Switch/Switch.tsx",
    registrySourcePath,
  })

  const unknownSourceReport = await createStatusReport({ cwd: consumerRoot, itemName: "utils/unknown" })
  const unknownFileWithDefaultRegistry = unknownSourceReport.files.find(
    (statusFile) => statusFile.path === "src/components/_registry/utils/unknown.ts",
  )

  assertCliJsonReportContract({ report: unknownSourceReport, schemaName: "status" })
  assert.equal(unknownSourceReport.registrySource.status, "loaded")
  assert.equal(unknownFileWithDefaultRegistry?.sourceState, "unknown")
  assert.equal(unknownFileWithDefaultRegistry?.state, "unknown")
  console.log("[aminoui-cli] status report verified")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
