import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { log } from "node:console"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, "../../../..")
const output = mkdtempSync(path.join(tmpdir(), "codon-foreground-contract-"))
const sources = {
  "android/os/IBinder.java": "package android.os; public interface IBinder {}",
  "android/view/ViewParent.java": "package android.view; public interface ViewParent {}",
  "android/view/View.java": `package android.view;
public class View implements ViewParent {
  private final int id;
  private ViewParent parent;
  private final android.os.IBinder window = new android.os.IBinder() {};
  public View(int id) { this.id=id; }
  public int getId() { return id; }
  public android.os.IBinder getWindowToken() { return window; }
  public ViewParent getParent() { return parent; }
  public void setParent(ViewParent value) { parent=value; }
  @Override public boolean equals(Object other) { return other instanceof View && ((View)other).id == id; }
  @Override public int hashCode() { return id; }
}`,
  "android/graphics/Rect.java": `package android.graphics;
public final class Rect {
  public final int left,top,right,bottom;
  public Rect(int left,int top,int right,int bottom) { this.left=left;this.top=top;this.right=right;this.bottom=bottom; }
  public int width() { return right-left; } public int height() { return bottom-top; }
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
assert.ok(javaHome, "Set CODON_CAPTURE_JAVA_HOME to the existing locked JDK")
const production = path.join(repository, "packages/react-native/android/src/main/java/com/codonui/input")
const run = (command, args, timeout) => {
  const result = spawnSync(path.join(javaHome, "bin", command), args, { encoding: "utf8", timeout })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout
}
run(
  "javac",
  [
    "-source",
    "17",
    "-target",
    "17",
    "-d",
    output,
    ...inputs,
    ...["CUIForegroundCompositionSource", "CUIForegroundCompositionRegistry"].map((name) =>
      path.join(production, `${name}.java`),
    ),
    path.join(directory, "ForegroundSourceContract.java"),
  ],
  180_000,
)
log(run("java", ["-cp", output, "com.codonui.input.ForegroundSourceContract"], 10_000).trim())
log(`Host API identities only; original platform drawing/input remains unqualified. Output: ${output}`)
