import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import {
  assertAutolink,
  assertCodegenSchema,
  assertDependencies,
  assertEditableFiles,
  assertExternalConsumer,
  assertNativeInputs,
  assertNativePackage,
  assertUnchanged,
  captureNativeInputs,
  consumerPath,
  hash,
  readJson,
  snapshot,
  writeJson,
} from "./consumer-probe.mjs"

export const runLifecycle = ({ root, repository, plan, evidence }) => {
  assertExternalConsumer(root, repository)
  assert.ok(plan.steps?.length > 0, "declare lifecycle steps with the real CLI argv")
  mkdirSync(evidence, { recursive: true })
  assertExternalConsumer(evidence, root)
  assert.deepEqual(readdirSync(evidence), [], "use a fresh evidence directory; retain previous outcomes")
  const nativeInputs = new Map()
  const report = {
    kind: "expo-consumer-lifecycle",
    consumer: path.resolve(root),
    planHash: hash(JSON.stringify(plan)),
    nativeBuildVerified: false,
    steps: [],
    verdict: "FAIL",
  }
  try {
    for (const [index, step] of plan.steps.entries()) {
      assert.match(step.id, /^[a-z0-9-]+$/, "step IDs must be safe log filenames")
      assert.ok(!report.steps.some((item) => item.id === step.id), "step IDs must be unique")
      assert.ok(
        step.argv?.length > 0 && step.argv.every((part) => typeof part === "string"),
        "argv must be an explicit string array",
      )
      assert.ok(step.expect && Object.keys(step.expect).length > 0, "every command requires concrete expectations")
      const result = { id: step.id, argv: step.argv, verdict: "FAIL" }
      report.steps.push(result)
      if (step.localEdit) {
        const filename = consumerPath(root, step.localEdit.path)
        assertEditableFiles(root, { [step.localEdit.path]: hash(readFileSync(filename)) })
        assert.ok(step.localEdit.append?.length > 0, "local edit must append a nonempty marker")
        writeFileSync(filename, Buffer.concat([readFileSync(filename), Buffer.from(step.localEdit.append)]))
      }
      const before = snapshot(root)
      const started = Date.now()
      const execution = spawnSync(step.argv[0], step.argv.slice(1), {
        cwd: root,
        encoding: "utf8",
        shell: false,
        timeout: step.timeoutMs ?? 120_000,
        maxBuffer: 8 * 1024 * 1024,
      })
      result.durationMs = Date.now() - started
      result.exitCode = execution.status
      result.signal = execution.signal
      const prefix = `${String(index + 1).padStart(2, "0")}-${step.id}`
      writeFileSync(path.join(evidence, `${prefix}.stdout.log`), execution.stdout ?? "")
      writeFileSync(path.join(evidence, `${prefix}.stderr.log`), execution.stderr ?? "")
      const after = snapshot(root)
      writeJson(path.join(evidence, `${prefix}.before.json`), before)
      writeJson(path.join(evidence, `${prefix}.after.json`), after)
      if (execution.error) throw execution.error
      assert.equal(execution.signal, null, `${step.id} terminated by a signal`)
      assert.ok(
        (step.expectExitCodes ?? [0]).includes(execution.status),
        `${step.id}: unexpected exit ${execution.status}`,
      )
      if (step.expect.unchanged) assertUnchanged(before, after)
      for (const relative of step.expect.preserved ?? []) {
        assert.ok(before[relative], `preserved path missing before command: ${relative}`)
        assert.equal(after[relative], before[relative], `consumer edit changed: ${relative}`)
      }
      for (const relative of step.expect.absent ?? []) {
        assert.ok(!existsSync(consumerPath(root, relative)), `unexpected output: ${relative}`)
      }
      if (step.expect.files) assertEditableFiles(root, step.expect.files)
      if (step.expect.dependencies) {
        result.dependencies = assertDependencies(root, step.expect.dependencies, step.expect.contexts)
      }
      for (const native of step.expect.nativePackages ?? []) assertNativePackage(root, native.path, native)
      if (step.expect.autolink) assertAutolink(root, JSON.parse(execution.stdout), step.expect.autolink)
      if (step.expect.codegen) {
        assertCodegenSchema(readJson(consumerPath(root, step.expect.codegen.path)), step.expect.codegen.modules)
      }
      if (step.expect.sameNativeAs) {
        assert.ok(nativeInputs.has(step.expect.sameNativeAs), "unknown native input capture")
        assertNativeInputs(root, nativeInputs.get(step.expect.sameNativeAs))
      }
      if (step.captureNative) {
        assert.ok(!nativeInputs.has(step.id), "native input names must be unique")
        const captured = captureNativeInputs(root, step.captureNative)
        nativeInputs.set(step.id, captured)
        writeJson(path.join(evidence, `${prefix}.native-inputs.json`), captured)
      }
      result.verdict = "PASS"
    }
    report.verdict = "PASS"
    return report
  } catch (error) {
    report.error = error.message
    throw error
  } finally {
    writeJson(path.join(evidence, "report.json"), report)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [root, repository, planPath, evidence] = process.argv.slice(2)
  assert.ok(evidence, "usage: run-lifecycle.mjs <consumer> <repository> <plan.json> <evidence-directory>")
  const report = runLifecycle({ root, repository, plan: readJson(planPath), evidence })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}
