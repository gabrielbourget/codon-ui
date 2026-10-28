import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const fixture = path.dirname(fileURLToPath(import.meta.url))
const [sdk, jdk] = process.argv.slice(2)
if (!sdk || !jdk) throw new Error("Pass the exact current SDK source directory and locked JDK directory")
const proof = mkdtempSync(path.join(tmpdir(), "codon-accessibility-receiver-controls-"))
const doubles = {
  "android/os/Looper.java": `package android.os; public final class Looper { private static final Looper MAIN=new Looper(); public static Looper myLooper(){return MAIN;} public static Looper getMainLooper(){return MAIN;} }`,
  "android/view/View.java": `package android.view; public class View { public int mode; public boolean authoredFocusable=true, authoredHidden; }`,
  "androidx/core/view/accessibility/AccessibilityNodeInfoCompat.java": `package androidx.core.view.accessibility; public final class AccessibilityNodeInfoCompat { public boolean focusable=true, visible=true, important=true, screenReaderFocusable=true, selected=true, focused=true; public String text="held editor text", role="original role"; public int actions=19; public void setScreenReaderFocusable(boolean value){screenReaderFocusable=value;} public void setFocusable(boolean value){focusable=value;} public void setVisibleToUser(boolean value){visible=value;} public void setImportantForAccessibility(boolean value){important=value;} }`,
}
const sources = Object.entries(doubles).map(([name, source]) => {
  const target = path.join(proof, name)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, source)
  return target
})
const receiver = path.join(
  sdk,
  "ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityProjection.java",
)
if (!readFileSync(receiver, "utf8").includes("public final class ReactAccessibilityProjection"))
  throw new Error("Current actual SDK receiver required")
execFileSync(
  path.join(jdk, "bin/javac"),
  ["-d", proof, receiver, ...sources, path.join(fixture, "ReadTimeProjectionControls.java")],
  { stdio: "inherit" },
)
execFileSync(path.join(jdk, "bin/java"), ["-cp", proof, "ReadTimeProjectionControls"], { stdio: "inherit" })
console.log(
  JSON.stringify({ proof, receiver, tier: "actual SDK class with explicit host-only doubles; no native acceptance" }),
)
