from pathlib import Path
import re


root = Path(__file__).resolve().parents[4]
native = root / "packages/react-native"
react = native / "node_modules/react-native/ReactCommon/react/renderer/components"
owned = native / "cpp/motion"
header = (owned / "NativeLayoutState.h").read_text()
implementation = (owned / "NativeLayoutState.cpp").read_text()
adapter = (owned / "FabricLayout.cpp").read_text()

# This audit checks the locked source selection and immutable call boundary;
# the portable C++ fixture exercises the actual copied-style algorithms.
adopters = set()
for path in react.rglob("*ComponentDescriptor.h"):
    text = path.read_text()
    if re.search(r"\.(?:setSize|setPadding|setPositionType)\(|const_cast<yoga::Style", text):
        adopters.add(path.name)
expected = {
    "SafeAreaViewComponentDescriptor.h",
    "ModalHostViewComponentDescriptor.h",
    "InputAccessoryComponentDescriptor.h",
    "AndroidTextInputComponentDescriptor.h",
}
assert adopters == expected, ("locked RN adopted-style audit changed", adopters)

svg = (
    native
    / "node_modules/react-native-svg/common/cpp/react/renderer/components/rnsvg/RNSVGShadowNodes.h"
).read_text()
constructors = set()
for name, body in re.findall(r"using (RNSVG\w+)ShadowNode\s*=\s*([^;]+);", svg):
    if "YogaLayoutableShadowNode>" not in body:
        constructors.add(name)
mask_section = header.split("constexpr std::string_view names[]{", 1)[1].split("};", 1)[0]
actual = set(re.findall(r'"(RNSVG\w+)"', mask_section))
assert actual == constructors, ("locked SVG constructor audit changed", actual ^ constructors)
assert len(actual) == 26

for forbidden in ["getYogaNode", "yogaNode_", "const_cast", ".layoutTree(", ".layout(", ".adopt(", "setNativeProps", "getMostRecentState"]:
    assert forbidden not in implementation + adapter, ("original native mutation/access", forbidden)
assert "ConcreteState<T>" in implementation and "getData()" in implementation
assert "selectedProps != state.originalProps" not in implementation
assert "requireNativeEditorLayoutAuthority(style, copyNativeYogaStyle(original, false))" in implementation
assert "copyNativeYogaStyle(*props, false)" in implementation
assert "PortalShadowRegistry" not in implementation
assert "immutable portal host size unavailable" in header
assert "resolveIntrinsic(source, context, selectedProps)" in adapter
assert "applyNativeLayoutState(layoutState, selectedProps, swap)" in adapter
print("NativeLayoutState locked source audit: 4 RN adopters, 26 SVG constructors, immutable props/state boundaries pass")
