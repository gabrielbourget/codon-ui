"""Compile the actual owned rejected-read diagnostic against Foundation; no guest actions."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
fixture = Path(__file__).resolve().parent
repo = fixture.parents[3]
output = args.output.resolve()
assert not any((parent / "SEALED.json").exists() for parent in [output, *output.parents])
output.mkdir(parents=True, exist_ok=False)
source_path = repo / "packages/react-native/ios/CUIFormDocument.mm"
source = source_path.read_text()
start = source.index("static NSString *CUIFieldInputReadDifference(")
end = source.index("\nstatic NSDictionary *CUIAdmitFormAction", start)
excerpt = source[start:end]
assert "if (result != after)" in source
assert 'reason:[@"field-input-document-retired-during-read "' in source
(output / "owned-read-difference.inc").write_text(excerpt)
executable = output / "field-document-read-contract"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror",
    "-I" + str(output),
    str(fixture / "field-document-read-contract.mm"), "-framework", "Foundation", "-o", str(executable),
], check=True, timeout=30)
result = json.loads(subprocess.check_output([str(executable)], text=True, timeout=8))
result.update({"sourceSHA256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
               "excerptSHA256": hashlib.sha256(excerpt.encode()).hexdigest(),
               "scope": "Actual owned diagnostic only; rejection unchanged; no installed or component acceptance"})
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
