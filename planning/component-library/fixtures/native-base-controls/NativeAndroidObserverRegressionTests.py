"""Replay saved Android observer failures without ADB, compilation or a guest."""

import ast
import copy
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


root = Path(__file__).parent
source = ast.parse((root / "PlaceholderG02AndroidTests.py").read_text())
helpers = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in {"measured_bounds", "bounds"}]
selection = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == "selection_s03")
copy_query = next(node for node in selection.body if isinstance(node, ast.FunctionDef) and node.name == "copy_node")
namespace = {"ET": ET, "re": re}
exec(compile(ast.Module(body=helpers + [copy_query], type_ignores=[]), "saved-observer-helpers", "exec"), namespace)
data = json.loads((root / "NativeAndroidObserverRegressions.json").read_text())
checks = 0


def rejects(operation, *arguments):
    global checks
    try:
        operation(*arguments)
    except AssertionError:
        checks += 1
        return
    raise AssertionError("Invalid target or ambiguous action was admitted")


clipped = ET.Element("node", data["clippedBounds"]["node"])
viewport = namespace["bounds"](ET.Element("node", data["clippedBounds"]["viewport"]))
assert namespace["measured_bounds"](clipped, viewport) == [45, 1596, 674, 1558]
checks += 1
rejects(namespace["bounds"], clipped)
rejects(namespace["measured_bounds"], clipped)
rejects(namespace["measured_bounds"], ET.Element("node", bounds="[45,800][674,700]"), viewport)
rejects(namespace["bounds"], ET.Element("node", bounds="[45,800][45,800]"))
assert namespace["bounds"](ET.Element("node", bounds="[45,600][674,680]")) == [45, 600, 674, 680]
checks += 1

for case in data["selectionCases"]:
    result = namespace["copy_node"](ET.Element("hierarchy"), case["native"])
    assert (result is not None) == case["expectedCopy"], case["name"]
    if result is not None:
        assert result.get("text") == "Copy" and result.get("enabled") == "true"
        namespace["bounds"](result)
    checks += 1

positive = next(case["native"] for case in data["selectionCases"] if case["expectedCopy"])
separate = copy.deepcopy(positive)
container = next(row for row in separate["windowNodes"] if row.get("description") == "Copy")
container["windowId"] = -777
rejects(namespace["copy_node"], ET.Element("hierarchy"), separate)
disjoint = copy.deepcopy(positive)
container = next(row for row in disjoint["windowNodes"] if row.get("description") == "Copy")
container["bounds"] = "1 1 2 2"
rejects(namespace["copy_node"], ET.Element("hierarchy"), disjoint)
duplicate = copy.deepcopy(positive)
title = copy.deepcopy(next(row for row in duplicate["windowNodes"] if row.get("text") == "Copy"))
title["windowId"] = -888
duplicate["windowNodes"].append(title)
rejects(namespace["copy_node"], ET.Element("hierarchy"), duplicate)

print(f"PASS: {checks} saved-observer checks; no native actions")
