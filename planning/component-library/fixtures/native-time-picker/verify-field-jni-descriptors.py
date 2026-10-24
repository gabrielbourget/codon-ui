import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


parser = argparse.ArgumentParser(description="Compare actual fbjni registration descriptors with compiled CUI Java declarations.")
parser.add_argument("--javap", required=True, type=Path)
parser.add_argument("--java-classes", required=True, type=Path)
parser.add_argument("--jni-command", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
fixture = Path(__file__).resolve().parent
root = fixture.parents[3]
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
command = json.loads(args.jni_command.read_text())
assert command[-1] == str(root / "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp")
assert "-fsyntax-only" in command
java_class = args.java_classes / "com/codonui/input/CUIFieldInputBinding.class"
assert java_class.is_file()
declarations = subprocess.check_output([
    str(args.javap), "-s", "-private", "-classpath", str(args.java_classes), "com.codonui.input.CUIFieldInputBinding",
], text=True, timeout=10)
(output / "compiled-java-declarations.txt").write_text(declarations)
descriptors = {}
for name in ["nativeEmitOwnedInput", "nativeEmitFieldPointer"]:
    match = re.search(r"\b" + name + r"\([^\n]*\);\s+descriptor: ([^\s]+)", declarations)
    assert match, name
    descriptors[name] = match[1]
(output / "field-input-jni-descriptors.inc").write_text(
    "constexpr std::string_view ownedInputDescriptor = " + json.dumps(descriptors["nativeEmitOwnedInput"]) + ";\n"
    "constexpr std::string_view pointerDescriptor = " + json.dumps(descriptors["nativeEmitFieldPointer"]) + ";\n"
)
command[-1] = str(fixture / "field-input-jni-descriptors.cpp")
command.insert(1, "-I" + str(output))
sources = [
    root / "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp",
    fixture / "field-input-jni-descriptors.cpp",
    Path(__file__).resolve(),
    java_class,
]
inventory = {
    "compiledJavaDescriptors": descriptors,
    "sourceSHA256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources},
    "compiler": command,
    "scope": "Actual CUI native functions, pinned fbjni descriptor deduction and compiled Java declarations. No JNI load or installed verdict.",
}
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
subprocess.run(command, check=True, timeout=40)
result = {"matchedActualDescriptors": list(descriptors), "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
