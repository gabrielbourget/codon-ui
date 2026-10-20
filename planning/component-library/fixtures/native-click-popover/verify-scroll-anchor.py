from pathlib import Path
import json
import math
import subprocess

repo = Path(__file__).resolve().parents[4]
fixture = Path(__file__).resolve().parent
output = Path("/private/tmp/codon-native-click-popover-policy")
output.mkdir(exist_ok=True)
cases = json.loads(Path("/private/tmp/codon-native-click-popover-scroll-oracle.json").read_text())
assert len(cases) == 24
fields = ["beforeTop", "beforeBottom", "beforeViewportTop", "beforeViewportBottom", "afterTop", "afterBottom", "afterViewportTop", "afterViewportBottom", "current", "minimum", "maximum"]
data = "".join(" ".join(str(case[name]) for name in fields) + "\n" for case in cases)
clang = "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++"
subprocess.run([clang, "-std=c++20", "-I" + str(repo / "packages/react-native/ios"), str(fixture / "scroll-anchor-native.cpp"), "-o", str(output / "ios-policy")], check=True)
jdk = Path("/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home/bin")
subprocess.run([str(jdk / "javac"), "-d", str(output), str(repo / "packages/react-native/android/src/main/java/com/codonui/input/CUIFloatingScrollAnchorModel.java"), str(fixture / "ScrollAnchorModelCases.java")], check=True)
records = {}
for platform, command in [("ios-policy", [str(output / "ios-policy")]), ("android-policy", [str(jdk / "java"), "-cp", str(output), "com.codonui.input.ScrollAnchorModelCases"])]:
    result = subprocess.check_output(command, input=data, text=True)
    values = [float(line) for line in result.splitlines()]
    assert len(values) == len(cases)
    for case, actual in zip(cases, values):
        assert math.isclose(actual, case["expected"], abs_tol=0.000001), (platform, case["name"], actual, case["expected"])
    records[platform] = {"cases": len(values), "matchesActualPinnedSource": True}
(output / "result.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
