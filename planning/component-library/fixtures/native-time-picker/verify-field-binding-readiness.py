"""Compile the actual owned readiness publisher against Foundation; no guest actions."""
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
source_path = repo / "packages/react-native/ios/CUIFieldInputBinding.mm"
source = source_path.read_text()
start = source.index("- (void)publishReadiness:(BOOL)ready error:(NSString *)error\n{")
end = source.index("\n- (UIView *)outerRoot", start)
excerpt = source[start:end]
(output / "owned-readiness.inc").write_text(excerpt)
sdk = (repo / "packages/react-native/node_modules/react-native").resolve()
header_path = sdk / "Libraries/Text/TextInput/RCTBackedTextInputViewProtocol.h"
header = header_path.read_text()
helper = header[header.index("static inline NSSet<UIPress *> *RCTTextInputRemainingPresses("):header.index("\nNS_ASSUME_NONNULL_END")]
(output / "sdk-press-filter.inc").write_text("NS_ASSUME_NONNULL_BEGIN\n" + helper + "\nNS_ASSUME_NONNULL_END\n")
boundary_excerpt = source[source.index("static void CUIRecordFieldKeyBoundary("):source.index("\n@implementation CUIFieldInputWindow")]
(output / "owned-key-boundary.inc").write_text(boundary_excerpt)
entry = source[source.index("@implementation CUIFieldInputWindow"):source.index("\nBOOL CUIHandleFieldResponderPress(")]
(output / "owned-key-entry.inc").write_text(entry)
route = source[source.index("BOOL CUIHandleFieldResponderPress("):source.index("\nstatic void CUIRefreshFieldInputWindow(UIWindow *window)\n{")]
(output / "owned-key-route.inc").write_text(route)
hook_sources = {
    "sdk-field": sdk / "Libraries/Text/TextInput/Singleline/RCTUITextField.mm",
    "sdk-view": sdk / "Libraries/Text/TextInput/Multiline/RCTUITextView.mm",
    "owned-segment": repo / "packages/react-native/ios/CUIDateSegment.mm",
    "owned-focus": repo / "packages/react-native/ios/CUIFocusView.mm",
}
hook_hashes = {}
for label, path in hook_sources.items():
    text = path.read_text(); methods = []
    for name in ["pressesBegan", "pressesEnded", "pressesCancelled"]:
        start = text.index("- (void)" + name + ":")
        end = text.index("\n}", start) + 2
        methods.append(text[start:end])
    body = "\n".join(methods) + "\n"
    (output / (label + "-presses.inc")).write_text(body)
    hook_hashes[label] = {"source": str(path), "sourceSHA256": hashlib.sha256(path.read_bytes()).hexdigest(), "excerptSHA256": hashlib.sha256(body.encode()).hexdigest()}
executable = output / "field-binding-readiness-contract"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror",
    "-I" + str(output), str(fixture / "field-binding-readiness-contract.mm"),
    "-framework", "Foundation", "-o", str(executable),
], check=True, timeout=30)
result = json.loads(subprocess.check_output([str(executable)], text=True, timeout=8))
result.update({"sourceSHA256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
               "excerptSHA256": hashlib.sha256(excerpt.encode()).hexdigest(),
               "keyBoundaryExcerptSHA256": hashlib.sha256(boundary_excerpt.encode()).hexdigest(),
               "entryExcerptSHA256": hashlib.sha256(entry.encode()).hexdigest(),
               "sdkFilterSHA256": hashlib.sha256(helper.encode()).hexdigest(), "hookSources": hook_hashes,
               "scope": "Actual publisher/router/filter and all four original responder method sets against explicit UIKit/default models; installed delivery/default acceptance unproved"})
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
