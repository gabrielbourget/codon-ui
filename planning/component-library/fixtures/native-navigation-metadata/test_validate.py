"""Synthetic unit fixtures exercise the validator, never installed acceptance."""
import copy
import unittest

from validate import CONFIGURATION, PREFIX, parse_records, validate


def synthetic_records(platform):
    phases = CONFIGURATION["phases"]
    session = {"windowId": "synthetic-unit-window", "epoch": 1}
    result = [{"kind": "begin", "libraryProducer": CONFIGURATION["libraryProducer"], "phases": [p["id"] for p in phases]}]
    for index, phase in enumerate(phases):
        result.append({"kind": "request", "phase": phase["id"], "targets": list(range(1, 8)), "session": session})
        reference = {"initial": "First Second", "changed": "Changed A Changed B", "returned": "Return A Return B"}.get(phase.get("referenceMode"))
        for tag in range(1, 8):
            label = reference or phase.get("paginationLabel" if tag == 1 else "breadcrumbLabel", "Probe pagination" if tag == 1 else "Probe trail")
            navigation = tag == 1 or (tag == 2 and not phase.get("breadcrumbDisabled", False))
            selected, value = False, ""
            if tag > 2:
                page = tag - 2
                label = "Go To Page " + str(page) if page <= 3 else ["Previous Page", "Next Page"][page - 4]
                selected = page == phase["page"]
                value = ", ".join(v for v in [phase.get("valueAlias", ""), phase.get("currentText", "Current page") if selected else ""] if v)
                navigation = False
                if platform == "android" and value:
                    label += ", " + value
            actual = {"platform": platform, "target": tag, "ownerId": "synthetic-" + str(tag), "windowId": session["windowId"], "observedAt": index + 1, "selected": selected, "containerType": (3 if navigation else 0) if platform == "ios" else -1, "containerTitle": label if platform == "android" and navigation else "", "roleDescription": phase.get("role", "Navigation") if platform == "android" and navigation else "", "label": label, "value": value if platform == "ios" else "", "hint": "", "description": "", "details": ""}
            result.append({"kind": "snapshot", "phase": phase["id"], "session": session, "actual": actual})
        result.append({"kind": "phase-complete", "phase": phase["id"]})
    result.append({"kind": "complete", "phases": len(phases), "snapshots": len(phases) * 7})
    return result


class ValidatorTests(unittest.TestCase):
    def test_valid_synthetic_platform_contracts(self):
        for platform in ["android", "ios"]:
            self.assertEqual(validate(synthetic_records(platform), platform)["nativeSnapshots"], 77)

    def test_completion_without_observations_is_rejected(self):
        with self.assertRaises(AssertionError):
            validate([{"kind": "complete", "snapshots": 77}], "ios")

    def test_missing_or_duplicate_native_packet_is_rejected(self):
        for duplicate in [False, True]:
            data = synthetic_records("ios")
            first = next(row for row in data if row["kind"] == "snapshot")
            data.remove(first)
            if duplicate:
                data.append(copy.deepcopy(next(row for row in data if row["kind"] == "snapshot")))
            with self.assertRaises(AssertionError):
                validate(data, "ios")

    def test_mismatched_actual_fields_are_rejected(self):
        changes = {"platform": "android", "windowId": "foreign", "selected": True, "observedAt": -1, "ownerId": "", "containerType": 0, "label": "guessed", "containerTitle": "invented"}
        for field, value in changes.items():
            with self.subTest(field=field):
                data = synthetic_records("ios")
                first = next(row for row in data if row["kind"] == "snapshot")
                first["actual"][field] = value
                with self.assertRaises(AssertionError):
                    validate(data, "ios")

    def test_current_status_or_fixed_name_loss_is_rejected(self):
        for replacement in ["", "Current page"]:
            data = synthetic_records("android")
            first = next(row for row in data if row["kind"] == "snapshot" and row["actual"]["target"] == 3)
            first["actual"]["label"] = replacement
            with self.assertRaises(AssertionError):
                validate(data, "android")

    def test_actual_packet_survives_log_envelope_and_unrelated_lines(self):
        import json
        row = {"probe": CONFIGURATION["probe"], "kind": "snapshot", "actual": {"label": "", "observedAt": 0}}
        self.assertEqual(parse_records("unrelated\nOS logger: " + PREFIX + json.dumps(row) + "\n"), [row])
        self.assertEqual(parse_records(PREFIX + "invalid json\n"), [])


if __name__ == "__main__":
    unittest.main()
