"""Execute the owned platform policies against date-entry UX cases, without a product build."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--javac", required=True, type=Path)
parser.add_argument("--java", required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[4]
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
# key, shift/alt/control/meta/composing/readOnly/picker, expected native capture.
cases = [
    ("ArrowLeft", [False]*7, True), ("ArrowRight", [False]*7, True),
    ("ArrowRight", [True, False, False, False, True, True, False], True),
    ("ArrowUp", [False]*7, True), ("ArrowDown", [False]*7, True),
    ("Home", [False]*7, True), ("End", [False]*7, True),
    ("PageUp", [False]*7, True), ("PageDown", [False]*7, True),
    ("ArrowUp", [False, False, False, False, True, False, False], False),
    ("ArrowUp", [False, False, False, False, False, True, False], False),
    ("ArrowUp", [True, False, False, False, False, False, False], False),
    ("ArrowUp", [False, True, False, False, False, False, False], False),
    ("ArrowUp", [False, True, False, False, False, False, True], True),
    ("ArrowDown", [False, True, False, False, True, True, True], True),
    ("Backspace", [False]*7, True), ("Delete", [False]*7, True),
    ("Backspace", [False, False, False, False, True, True, False], True),
    ("Delete", [False, False, True, False, False, False, False], False),
    ("a", [False, False, True, False, False, False, False], True),
    ("a", [False]*7, False), ("7", [False]*7, False),
    ("Tab", [False]*7, False), ("Tab", [True, False, False, False, False, False, False], False),
    ("Escape", [False]*7, False), ("Enter", [False]*7, False),
]
expressions = [json.dumps(key) + "," + ",".join(str(flag).lower() for flag in flags) for key, flags, expected in cases]
cpp = root / "packages/react-native/cpp/input/DateSegmentKeyPolicy.h"
java = root / "packages/react-native/android/src/main/java/com/codonui/input/CUIDateSegmentKeyPolicy.java"
cpp_source = output / "control.cpp"
cpp_source.write_text('#include "' + str(cpp) + '"\nint main(){\n' + "\n".join(
    f"if(codon::input::dateSegmentCapturesKey({expr}) != {str(case[2]).lower()}) return {i+1};" for i, (expr, case) in enumerate(zip(expressions, cases))
) + "\n}")
java_source = output / "DatePolicyControl.java"
java_source.write_text("package com.codonui.input; class DatePolicyControl { public static void main(String[] args) {\n" + "\n".join(
    f'if(CUIDateSegmentKeyPolicy.captures({expr}) != {str(case[2]).lower()}) throw new AssertionError("case {i+1}");' for i, (expr, case) in enumerate(zip(expressions, cases))
) + "\n}}")
commands = [
    ["clang++", "-std=c++17", str(cpp_source), "-o", str(output / "control")],
    [str(output / "control")],
    [str(args.javac), "-d", str(output), str(java), str(java_source)],
    [str(args.java), "-cp", str(output), "com.codonui.input.DatePolicyControl"],
]
for command in commands:
    subprocess.run(command, check=True, timeout=30)
result = {"casesPerPlatform": len(cases), "platforms": ["UIKit policy C++", "Android policy Java"],
          "scope": "Pure owned native policy execution; no installed routing or qualification", "commands": commands,
          "sourceSHA256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in [cpp, java, Path(__file__).resolve()]}}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"casesPerPlatform": len(cases), "passed": True}))
