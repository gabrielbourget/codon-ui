import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { readRequiredRegistryFileNames, verifyPackSource } from "./pack-source.mjs"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const preparePackSourcePath = path.join(packageRoot, "scripts/prepare-pack-source.mjs")
const cleanupPackSourcePath = path.join(packageRoot, "scripts/cleanup-pack-source.mjs")
const requiredFileNames = ["local-native.registry.json", ...readRequiredRegistryFileNames(process.argv.slice(2))]

const fail = (message) => {
  throw new Error(`[codon-ui-cli-pack-preflight] ${message}`)
}

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) fail(`${message}. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`)
}

const assertIncludes = (values, expected, message) => {
  if (!values.includes(expected)) fail(`${message}. Missing ${JSON.stringify(expected)}.`)
}

const temporaryConsumerRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "codon-ui-pack-preflight-")))
const relocatedPackageRoot = path.join(temporaryConsumerRoot, "cli")
const relocatedDistRoot = path.join(relocatedPackageRoot, "dist")

try {
  writeFileSync(
    path.join(temporaryConsumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "codon-ui-pack-preflight-consumer",
        private: true,
        dependencies: {
          classnames: "^2.3.2",
          react: "^18.2.0",
          "react-aria-components": "^1.17.0",
          "react-dom": "^18.2.0",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  )

  execFileSync(process.execPath, [preparePackSourcePath, ...process.argv.slice(2)], {
    cwd: packageRoot,
    stdio: "inherit",
  })
  const verification = verifyPackSource({ distRoot: path.join(packageRoot, "dist"), requiredFileNames })
  mkdirSync(relocatedPackageRoot)
  cpSync(path.join(packageRoot, "dist"), relocatedDistRoot, { recursive: true })
  cpSync(path.join(packageRoot, "package.json"), path.join(relocatedPackageRoot, "package.json"))
  symlinkSync(path.join(packageRoot, "node_modules"), path.join(relocatedPackageRoot, "node_modules"), "junction")
  verifyPackSource({ distRoot: relocatedDistRoot, requiredFileNames })
  const generatedRegistrySource = JSON.parse(
    readFileSync(path.join(relocatedDistRoot, "registry/local-react.registry.json"), "utf8"),
  )

  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.join(relocatedDistRoot, "index.js"),
        "add",
        "switch",
        "--dry-run",
        "--json",
        "--cwd",
        temporaryConsumerRoot,
      ],
      {
        cwd: temporaryConsumerRoot,
        encoding: "utf8",
      },
    ),
  )

  assertEqual(generatedRegistrySource.sourceRoot, "../registry-source", "Pack preflight generated source root")
  assertEqual(
    report.registrySourcePath,
    path.join(relocatedDistRoot, "registry/local-react.registry.json"),
    "Pack preflight registry source path",
  )
  assertEqual(report.effects.files.missingSourceCount, 0, "Pack preflight missing source count")
  assertIncludes(report.installPlan.requestedItems, "switch", "Pack preflight requested items")
  assertIncludes(
    report.installPlan.files.map((file) => file.resolvedPath),
    "src/components/_codon-ui-registry/theme.css",
    "Pack preflight default registry-contained theme target",
  )

  console.log(
    `[codon-ui-cli-pack-preflight] verified integrity of ${verification.snapshotFileNames.length} relocated registry snapshot(s); web CLI smoke passed. Native CLI routing is not exercised.`,
  )
} finally {
  rmSync(temporaryConsumerRoot, { force: true, recursive: true })
  execFileSync(process.execPath, [cleanupPackSourcePath], { cwd: packageRoot, stdio: "inherit" })
}
