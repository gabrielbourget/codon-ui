#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const readCommand = (command, args) =>
  execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim()

const runCommand = (command, args) =>
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  })

const stagedFiles = readCommand("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  .split(/\r?\n/u)
  .map((file) => file.trim())
  .filter(Boolean)

if (!stagedFiles.length) {
  console.log("[precommit] no staged files detected; skipping workspace checks.")
  process.exit(0)
}

const workspacePackages = JSON.parse(readCommand("pnpm", ["m", "ls", "--depth", "-1", "--json"]))
  .filter((workspacePackage) => workspacePackage.path !== repoRoot)
  .map((workspacePackage) => {
    const packageJsonPath = path.join(workspacePackage.path, "package.json")
    const packageJson = existsSync(packageJsonPath) ? JSON.parse(readFileSync(packageJsonPath, "utf8")) : {}

    return {
      name: workspacePackage.name,
      path: workspacePackage.path,
      relativePath: path.relative(repoRoot, workspacePackage.path),
      hasPrecommit: Boolean(packageJson.scripts?.precommit),
    }
  })
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath))

const workspaceByStagedFile = new Map()
let hasRootScopedChange = false

for (const stagedFile of stagedFiles) {
  const absolutePath = path.resolve(repoRoot, stagedFile)
  const owningWorkspace = workspacePackages.find(
    (workspacePackage) =>
      absolutePath === workspacePackage.path || absolutePath.startsWith(`${workspacePackage.path}${path.sep}`),
  )

  if (!owningWorkspace) {
    hasRootScopedChange = true
    continue
  }

  workspaceByStagedFile.set(owningWorkspace.name, owningWorkspace)
}

if (hasRootScopedChange) {
  console.log("[precommit] root/tooling files staged; running full monorepo check.")
  runCommand("pnpm", ["run", "precommit:root"])
  process.exit(0)
}

for (const workspacePackage of workspaceByStagedFile.values()) {
  if (!workspacePackage.hasPrecommit) {
    console.log(`[precommit] ${workspacePackage.name} has no precommit script; skipping.`)
    continue
  }

  console.log(`[precommit] running ${workspacePackage.name} precommit...`)
  runCommand("pnpm", ["--filter", workspacePackage.name, "run", "precommit"])
}

console.log("[precommit] staged workspace checks complete.")
