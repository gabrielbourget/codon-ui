import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { hashSource } from "./sourceFiles"

const nativeRoot = fileURLToPath(new URL("../../../../react-native", import.meta.url))
const KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Up",
  "Down",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "Backspace",
  "Delete",
  "a",
  "A",
  "Tab",
  "Enter",
  " ",
  "Escape",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "Dead",
  "Unidentified",
  "F13",
]

// Opt-in host compiler verification. The normal CLI suite retains Node-only tooling requirements.
test("actual C++ and Java date key policies agree for all 3,200 key/modifier/state combinations", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "codon-date-policy-host-"))
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 })
  try {
    const flags = Array.from({ length: 7 }, (_, index) => `(mask & ${1 << index}) != 0`).join(", ")
    const cppMain = path.join(output, "policy.cpp")
    await writeFile(
      cppMain,
      `#include "DateSegmentKeyPolicy.h"
#include <iostream>
int main() {
  const char *keys[] = {${KEYS.map((key) => JSON.stringify(key)).join(", ")}};
  for (const auto key : keys) {
    for (int mask = 0; mask < 128; ++mask) {
      const bool captured = codon::input::dateSegmentCapturesKey(key, ${flags});
      std::cout << (captured ? '1' : '0');
    }
    std::cout << '\\n';
  }
}
`,
    )
    const cppBinary = path.join(output, "cpp-policy")
    run("g++", [
      "-std=c++20",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-I",
      path.join(nativeRoot, "cpp/input"),
      cppMain,
      "-o",
      cppBinary,
    ])
    const cpp = run(cppBinary, []).trimEnd().split(/\r?\n/)
    const javaDirectory = path.join(output, "java/com/codonui/input")
    const classes = path.join(output, "classes")
    await mkdir(javaDirectory, { recursive: true })
    await mkdir(classes)
    const javaPolicy = path.join(javaDirectory, "CUIDateSegmentKeyPolicy.java")
    await copyFile(
      path.join(nativeRoot, "android/src/main/java/com/codonui/input/CUIDateSegmentKeyPolicy.java"),
      javaPolicy,
    )
    const javaMain = path.join(javaDirectory, "DatePolicyHostCheck.java")
    await writeFile(
      javaMain,
      `package com.codonui.input;
public final class DatePolicyHostCheck {
  public static void main(String[] args) {
    String[] keys = {${KEYS.map((key) => JSON.stringify(key)).join(", ")}};
    for (String key : keys) {
      for (int mask = 0; mask < 128; ++mask) {
        boolean captured = CUIDateSegmentKeyPolicy.captures(key, ${flags});
        System.out.print(captured ? '1' : '0');
      }
      System.out.println();
    }
  }
}
`,
    )
    run("java", [
      "--module",
      "jdk.compiler/com.sun.tools.javac.Main",
      "-encoding",
      "UTF-8",
      "-d",
      classes,
      javaPolicy,
      javaMain,
    ])
    const java = run("java", ["-cp", classes, "com.codonui.input.DatePolicyHostCheck"]).trimEnd().split(/\r?\n/)
    assert.equal(cpp.length, 25)
    assert.ok(cpp.every((row) => row.length === 128 && /^[01]+$/.test(row)))
    assert.deepEqual(java, cpp)
    const captured = (key: string, mask: number) => cpp[KEYS.indexOf(key)][mask] === "1"
    for (let mask = 0; mask < 128; mask++) {
      assert.equal(captured("ArrowLeft", mask), true)
      assert.equal(captured("ArrowRight", mask), true)
      assert.equal(captured("Tab", mask), false)
      assert.equal(captured("Enter", mask), false)
      assert.equal(captured("F13", mask), false)
      if (mask & 4) assert.equal(captured("a", mask), true)
      if (mask & 2 && mask & 64) assert.equal(captured("ArrowUp", mask), true)
    }
    assert.equal(captured("ArrowUp", 0), true)
    assert.equal(captured("ArrowUp", 16), false)
    assert.equal(captured("ArrowUp", 32), false)
    assert.equal(captured("Backspace", 16 | 32), true)
    assert.equal(captured("Delete", 1), false)
    assert.equal(captured("A", 4), false)
    const cppSource = await readFile(path.join(nativeRoot, "cpp/input/DateSegmentKeyPolicy.h"))
    const javaSource = await readFile(javaPolicy)
    assert.match(
      await readFile(path.join(nativeRoot, "ios/CUIDateSegment.mm"), "utf8"),
      /codon::input::dateSegmentCapturesKey/,
    )
    assert.match(
      await readFile(path.join(nativeRoot, "android/src/main/java/com/codonui/input/CUIDateSegment.java"), "utf8"),
      /CUIDateSegmentKeyPolicy.captures/,
    )
    console.log(
      JSON.stringify({
        scope: "host policy execution only; no Android/iOS SDK or installed editor proof",
        cases: 3200,
        cppHash: hashSource(cppSource),
        javaHash: hashSource(javaSource),
      }),
    )
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})
