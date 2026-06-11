import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distCliPath = path.join(packageRoot, "dist/index.js")
const preparePackSourcePath = path.join(packageRoot, "scripts/prepare-pack-source.mjs")
const cleanupPackSourcePath = path.join(packageRoot, "scripts/cleanup-pack-source.mjs")

const fail = (message) => {
  throw new Error(`[codon-ui-cli-pack-preflight] ${message}`)
}

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) fail(`${message}. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`)
}

const assertIncludes = (values, expected, message) => {
  if (!values.includes(expected)) fail(`${message}. Missing ${JSON.stringify(expected)}.`)
}

const temporaryConsumerRoot = mkdtempSync(path.join(tmpdir(), "codon-ui-pack-preflight-"))

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

  execFileSync(process.execPath, [preparePackSourcePath], { cwd: packageRoot, stdio: "inherit" })
  const generatedRegistrySource = JSON.parse(
    readFileSync(path.join(packageRoot, "dist/registry/local-react.registry.json"), "utf8"),
  )

  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [distCliPath, "add", "switch", "--dry-run", "--json", "--cwd", temporaryConsumerRoot],
      {
        cwd: packageRoot,
        encoding: "utf8",
      },
    ),
  )

  assertEqual(generatedRegistrySource.sourceRoot, "../registry-source", "Pack preflight generated source root")
  assertEqual(
    report.registrySourcePath.endsWith("dist/registry/local-react.registry.json"),
    true,
    "Pack preflight registry source path",
  )
  assertEqual(report.effects.files.missingSourceCount, 0, "Pack preflight missing source count")
  assertIncludes(report.installPlan.requestedItems, "switch", "Pack preflight requested items")
  assertIncludes(
    report.installPlan.files.map((file) => file.resolvedPath),
    "src/components/_codon-ui-registry/theme.css",
    "Pack preflight default registry-contained theme target",
  )

  console.log("[codon-ui-cli-pack-preflight] package-local registry source verified.")
} finally {
  rmSync(temporaryConsumerRoot, { force: true, recursive: true })
  execFileSync(process.execPath, [cleanupPackSourcePath], { cwd: packageRoot, stdio: "inherit" })
}
