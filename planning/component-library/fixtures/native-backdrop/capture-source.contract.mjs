import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { log } from "node:console"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

// Minimal host identities exercise the real Java API/registry/validation. They do not implement Android rendering.
const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, "../../../..")
const output = mkdtempSync(path.join(tmpdir(), "codon-backdrop-capture-contract-"))
const sources = {
  "android/os/IBinder.java": "package android.os; public interface IBinder {}",
  "android/view/View.java": `package android.view;
public class View {
  private final int id, width, height;
  private final android.os.IBinder window = new android.os.IBinder() {};
  public View(int id, int width, int height) { this.id=id; this.width=width; this.height=height; }
  public int getId() { return id; }
  public int getWidth() { return width; }
  public int getHeight() { return height; }
  public android.os.IBinder getWindowToken() { return window; }
  @Override public boolean equals(Object other) { return other instanceof View && ((View)other).id == id; }
  @Override public int hashCode() { return id; }
}`,
  "com/facebook/react/bridge/UiThreadUtil.java": `package com.facebook.react.bridge;
public final class UiThreadUtil { public static void assertOnUiThread() {} }`,
}
const inputs = Object.entries(sources).map(([file, source]) => {
  const target = path.join(output, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, source)
  return target
})
const javaHome = process.env.CODON_CAPTURE_JAVA_HOME
assert.ok(javaHome, "Set CODON_CAPTURE_JAVA_HOME to the existing locked JDK, without changing JAVA_HOME")
const production = path.join(repository, "packages/react-native/android/src/main/java/com/codonui/input")
const run = (command, args) => {
  const result = spawnSync(path.join(javaHome, "bin", command), args, { encoding: "utf8", timeout: 180_000 })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout
}
run("javac", [
  "-source",
  "17",
  "-target",
  "17",
  "-d",
  output,
  ...inputs,
  ...["CUIBackdropCaptureSource", "CUIBackdropCaptureRegistration", "CUIBackdropCaptureRegistry"].map((name) =>
    path.join(production, `${name}.java`),
  ),
  path.join(directory, "CaptureSourceContract.java"),
])
log(run("java", ["-cp", output, "com.codonui.input.CaptureSourceContract"]).trim())
log(`Host contract model only; native framework/capture/renderer execution is unproved. Inputs/output: ${output}`)
