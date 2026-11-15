import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { constants } from "node:fs"
import { link, mkdir, mkdtemp, open, readFile, rename, rm, stat, statfs, symlink, writeFile } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { CODON_UI_LOCK_FILE_NAME } from "../consumerContract/constants"
import { consumerLockfileSchema } from "../consumerContract/schema"

import { hashSource } from "./sourceFiles"

const linuxOnly = { skip: process.platform !== "linux" }
const beforeSource = Buffer.from("export const example = 'before'\n")
const afterSource = Buffer.from("export const example = 'after'\n")
const lockBytes = (source: Buffer) => {
  const contentHash = `sha256:${hashSource(source)}`
  const lockfile = consumerLockfileSchema.parse({
    items: {
      example: {
        name: "example",
        sourceIdentity: "scratch-fixture-only",
        files: [
          {
            path: "source.ts",
            targetRole: "components",
            sourceHash: contentHash,
            installedHash: contentHash,
            ownershipState: "registry-owned",
          },
        ],
      },
    },
  })
  return Buffer.from(`${JSON.stringify(lockfile, null, 2)}\n`)
}
const beforeLock = lockBytes(beforeSource)
const afterLock = lockBytes(afterSource)
const prepared = {
  fixtureOnly: true,
  source: { before: hashSource(beforeSource), after: hashSource(afterSource) },
  lockfile: { before: hashSource(beforeLock), after: hashSource(afterLock) },
}

// A two-file scratch protocol for observing OS limits. No production writer, journal format or recovery policy is defined.
const worker = String.raw`
import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { mkdir, open, readFile, rename } from "node:fs/promises"
import path from "node:path"
const [root, cut] = process.argv.slice(2)
const journal = path.join(root, "scratch-journal")
const input = JSON.parse(await readFile(path.join(root, "input.json"), "utf8"))
const syncDirectory = async (directory) => {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY)
  try { await handle.sync() } finally { await handle.close() }
}
const save = async (name, bytes) => {
  const handle = await open(path.join(journal, name), "wx", 0o600)
  try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
}
const mark = async (name, value) => {
  await save(name, JSON.stringify(value) + "\n")
  await syncDirectory(journal)
}
const stop = (phase) => { if (cut === phase) process.kill(process.pid, "SIGKILL") }
await mkdir(journal, { mode: 0o700 })
await save("source.before", await readFile(path.join(root, "source.ts")))
await save("lock.before", await readFile(path.join(root, "codon-ui.lock.json")))
await save("source.after", input.source)
await save("lock.after", input.lockfile)
await save("source.next", input.source)
await save("lock.next", input.lockfile)
const preparedBytes = JSON.stringify(input.prepared) + "\n"
await save("prepared.json", preparedBytes)
await syncDirectory(journal)
await syncDirectory(root)
stop("prepared")
await mark("source.intent.json", input.prepared.source)
stop("source-intent")
await rename(path.join(journal, "source.next"), path.join(root, "source.ts"))
stop("source-renamed")
await syncDirectory(root)
await syncDirectory(journal)
await mark("source.applied.json", input.prepared.source)
stop("source-synced")
await mark("lock.intent.json", input.prepared.lockfile)
stop("lock-intent")
await rename(path.join(journal, "lock.next"), path.join(root, "codon-ui.lock.json"))
stop("lock-renamed")
await syncDirectory(root)
await syncDirectory(journal)
await mark("lock.applied.json", input.prepared.lockfile)
stop("lock-synced")
await mark("committed.json", { preparedHash: createHash("sha256").update(preparedBytes).digest("hex") })
stop("committed")
`

const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codon-filesystem-probe-"))
  await writeFile(path.join(root, "source.ts"), beforeSource, { mode: 0o600 })
  await writeFile(path.join(root, CODON_UI_LOCK_FILE_NAME), beforeLock, { mode: 0o600 })
  await writeFile(
    path.join(root, "input.json"),
    JSON.stringify({ source: afterSource.toString(), lockfile: afterLock.toString(), prepared }),
  )
  await writeFile(path.join(root, "worker.mjs"), worker)
  return root
}
const runWorker = (root: string, cut: string) => {
  const result = spawnSync(process.execPath, [path.join(root, "worker.mjs"), root, cut], {
    encoding: "utf8",
    timeout: 10_000,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.stderr, "")
  if (cut === "complete") assert.equal(result.status, 0)
  else assert.equal(result.signal, "SIGKILL")
}

// Fixed private fixture paths only; this is not a reader for untrusted consumer journals.
const inspectFixture = async (root: string) => {
  const directory = path.join(root, "scratch-journal")
  const preparedBytes = await readFile(path.join(directory, "prepared.json"))
  assert.deepEqual(JSON.parse(preparedBytes.toString()), prepared)
  for (const [name, expected] of [
    ["source.before", prepared.source.before],
    ["source.after", prepared.source.after],
    ["lock.before", prepared.lockfile.before],
    ["lock.after", prepared.lockfile.after],
  ])
    assert.equal(hashSource(await readFile(path.join(directory, name))), expected, `${name} integrity`)
  const source = await readFile(path.join(root, "source.ts"))
  const lockfile = await readFile(path.join(root, CODON_UI_LOCK_FILE_NAME))
  const parsedLock = consumerLockfileSchema.parse(JSON.parse(lockfile.toString()))
  const state = (bytes: Buffer, hashes: { before: string; after: string }) =>
    hashSource(bytes) === hashes.before ? "before" : hashSource(bytes) === hashes.after ? "after" : "other"
  let committed = false
  try {
    const record = JSON.parse(await readFile(path.join(directory, "committed.json"), "utf8"))
    assert.deepEqual(record, { preparedHash: hashSource(preparedBytes) })
    committed = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  return {
    source: state(source, prepared.source),
    lockfile: state(lockfile, prepared.lockfile),
    ownershipMatchesBytes: parsedLock.items.example.files[0].installedHash === `sha256:${hashSource(source)}`,
    committed,
  }
}

test(
  "Linux no-follow guards only the leaf; an ancestor link still resolves outside the selected directory",
  linuxOnly,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codon-path-probe-"))
    try {
      await mkdir(path.join(root, "selected"))
      await mkdir(path.join(root, "outside"))
      await writeFile(path.join(root, "outside/value.txt"), "private fixture sentinel")
      await symlink(path.join(root, "outside/value.txt"), path.join(root, "selected/leaf"))
      await symlink(path.join(root, "outside"), path.join(root, "selected/ancestor"), "dir")
      const flags = constants.O_RDONLY | constants.O_NOFOLLOW
      await assert.rejects(
        open(path.join(root, "selected/leaf"), flags),
        (error: NodeJS.ErrnoException) => error.code === "ELOOP",
      )
      const handle = await open(path.join(root, "selected/ancestor/value.txt"), flags)
      try {
        assert.equal(await handle.readFile("utf8"), "private fixture sentinel")
      } finally {
        await handle.close()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)

test("exclusive creation rejects a race winner while rename replaces an existing destination", linuxOnly, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codon-create-probe-"))
  try {
    const target = path.join(root, "target")
    await writeFile(target, "consumer race winner")
    await assert.rejects(open(target, "wx"), (error: NodeJS.ErrnoException) => error.code === "EEXIST")
    assert.equal(await readFile(target, "utf8"), "consumer race winner")
    await writeFile(path.join(root, "staged"), "incoming")
    await rename(path.join(root, "staged"), target)
    assert.equal(await readFile(target, "utf8"), "incoming")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a renamed or hard-linked backup remains writable through the original open descriptor", linuxOnly, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codon-backup-probe-"))
  try {
    const target = path.join(root, "target")
    const backup = path.join(root, "backup")
    await writeFile(target, "baseline")
    const handle = await open(target, "r+")
    try {
      await writeFile(path.join(root, "copied-before-image"), await handle.readFile())
      await link(target, path.join(root, "hard-linked-backup"))
      await rename(target, backup)
      await writeFile(target, "incoming")
      assert.equal((await handle.stat()).ino, (await stat(backup)).ino)
      const written = await handle.write("consumer", 0, "utf8")
      assert.equal(written.bytesWritten, 8)
      await handle.sync()
      assert.equal(await readFile(backup, "utf8"), "consumer")
      assert.equal(await readFile(path.join(root, "hard-linked-backup"), "utf8"), "consumer")
      assert.equal(await readFile(path.join(root, "copied-before-image"), "utf8"), "baseline")
      assert.equal(await readFile(target, "utf8"), "incoming")
    } finally {
      await handle.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test(
  "SIGKILL at eight protocol cuts exposes source/lock mixtures despite per-file staging and flushes",
  linuxOnly,
  async (context) => {
    context.diagnostic(
      JSON.stringify({
        node: process.version,
        kernel: release(),
        temporaryFilesystemType: (await statfs(tmpdir())).type.toString(16),
        proof: "process interruption only; no power-loss or filesystem durability verdict",
      }),
    )
    const cases = [
      ["prepared", "before", "before", false],
      ["source-intent", "before", "before", false],
      ["source-renamed", "after", "before", false],
      ["source-synced", "after", "before", false],
      ["lock-intent", "after", "before", false],
      ["lock-renamed", "after", "after", false],
      ["lock-synced", "after", "after", false],
      ["committed", "after", "after", true],
      ["complete", "after", "after", true],
    ] as const
    for (const [cut, source, lockfile, committed] of cases) {
      const root = await fixture()
      try {
        runWorker(root, cut)
        const observed = await inspectFixture(root)
        assert.deepEqual(observed, { source, lockfile, ownershipMatchesBytes: source === lockfile, committed }, cut)
        assert.deepEqual(await inspectFixture(root), observed, "inspection performs no repair")
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  },
)

test(
  "restart content evidence cannot identify same-byte consumer writes or authorize automatic ownership recovery",
  linuxOnly,
  async () => {
    const root = await fixture()
    try {
      runWorker(root, "lock-synced")
      const observed = await inspectFixture(root)
      assert.equal(observed.committed, false)
      const handle = await open(path.join(root, "source.ts"), "r+")
      try {
        const result = await handle.write(afterSource, 0, afterSource.length, 0)
        assert.equal(result.bytesWritten, afterSource.length)
        await handle.sync()
      } finally {
        await handle.close()
      }
      assert.deepEqual(await inspectFixture(root), observed)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)

test(
  "read-only inspection preserves conflicting source and detects corrupt copied recovery data",
  linuxOnly,
  async () => {
    const root = await fixture()
    try {
      runWorker(root, "source-synced")
      const edit = Buffer.from("consumer edit after interruption")
      await writeFile(path.join(root, "source.ts"), edit)
      assert.equal((await inspectFixture(root)).source, "other")
      assert.deepEqual(await readFile(path.join(root, "source.ts")), edit)
      await writeFile(path.join(root, "scratch-journal/source.before"), "corrupt recovery copy")
      await assert.rejects(inspectFixture(root), /source.before integrity/)
      assert.deepEqual(await readFile(path.join(root, "source.ts")), edit)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
