import os
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
REPO = Path(os.environ.get('CODON_UI_REPOSITORY', str(HERE.parent))).resolve()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GUARD = load('adoption_guard', HERE / 'verify-native-ledger-adoption.py')
GATE = load('native_gate', REPO / GUARD.GATE)
MATRIX = (HERE / 'ledger-matrix.fixture.md').read_text()
CELL = 'CAT.indicator.G04'


def replace_status(text, cell, status):
    component, gate = cell.rsplit('.', 1)
    rows = text.splitlines(keepends=True)
    for i, line in enumerate(rows):
        if line.startswith('|') and line.split('|')[1].strip(' `') == component:
            fields = line.split('|')
            fields[int(gate[1:]) + 1] = ' ' + status + ' '
            rows[i] = '|'.join(fields)
            return ''.join(rows)
    raise AssertionError(cell)


class NewPassReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='codon-ledger-guard-controls-')
        self.root = Path(self.tmp.name)
        self.preflight = {'status': 'PASS', 'cell': CELL, 'checklistVersion': GATE.VERSION, 'checklistSHA256': GATE.digest(GATE.CHECKLIST), 'planSHA256': 'a' * 64, 'driverSHA256': 'b' * 64, 'checkedUTC': '2026-11-05T07:00:00+00:00'}
        self.done = {'kind': 'native_cell_completion', 'schemaVersion': 1, 'status': 'PASS', 'cell': CELL, 'checklistVersion': GATE.VERSION, 'checklistSHA256': GATE.digest(GATE.CHECKLIST), 'planSHA256': 'a' * 64, 'driverSHA256': 'b' * 64, 'criteriaComplete': True, 'cleanupVerified': True, 'finishedUTC': '2026-11-05T07:10:00+00:00', 'nativeMethodEvidenceClaimed': False, 'nativeMethods': []}

        driver = self.root / "driver.py"
        driver.write_text("# Synthetic maintained-driver binding control\n")
        self.preflight["driverSHA256"] = self.done["driverSHA256"] = GATE.digest(driver)
        self.done["driver"] = {"path": "driver.py", "sha256": GATE.digest(driver)}
        ios = self.root / "ios.log"
        ios.write_text("Test Case '-[Module.Case testBaseline]' passed (1.4 seconds).\n")
        android = self.root / "android.json"
        android.write_text(json.dumps({"cohorts": [{"name": "baseline", "status": "NATIVE_ASSERTIONS_PASSED_PENDING_COLOR_AND_ROOT_REVIEW", "elapsedMs": 1400}]}))
        self.done["nativeMethodEvidenceClaimed"] = True
        self.done["nativeMethods"] = [
            {"kind": "native_method", "claim": "Synthetic native proof-reader control", "path": str(ios), "sha256": GATE.digest(ios), "format": "xctest_log", "method": "testBaseline", "maximumSeconds": 180},
            {"kind": "native_method", "claim": "Synthetic native proof-reader control", "path": str(android), "sha256": GATE.digest(android), "format": "android_receipt", "method": "baseline", "maximumSeconds": 180},
        ]

    def tearDown(self):
        self.tmp.cleanup()

    def bind(self, name, value):
        path = self.root / name
        path.write_text(json.dumps(value))
        return {'path': str(path), 'sha256': GATE.digest(path)}

    def materialize(self):
        self.done['preflight'] = self.bind('preflight.json', self.preflight)
        return {'schemaVersion': 1, 'cells': {CELL: {'completion': self.bind('completion.json', self.done)}}}

    def validate(self, index=None):
        if index is None:
            index = self.materialize()
        return GUARD.validate_promotions([CELL], index, GATE.VERSION, GATE.digest(GATE.CHECKLIST), lambda p: (Path(p) if Path(p).is_absolute() else self.root / p).read_bytes(), GATE.native_method)

    def test_actual477_cell_parser_and_grandfathered223_passes(self):
        cells = GUARD.ledger_cells(MATRIX)
        self.assertEqual(len(cells), 477)
        self.assertEqual(sum(v == 'PASS' for v in cells.values()), 223)
        self.assertEqual(GUARD.newly_passing(MATRIX, MATRIX), [])

    def test_only_newly_promoted_cell_selected(self):
        self.assertEqual(GUARD.newly_passing(MATRIX, replace_status(MATRIX, CELL, 'PASS(SYNTHETIC)')), [CELL])

    def test_historical_pass_alias_edit_needs_no_new_receipt(self):
        after = replace_status(MATRIX, 'CAT.indicator.G01', 'PASS(HISTORICAL_ALIAS_EDIT)')
        self.assertEqual(GUARD.newly_passing(MATRIX, after), [])

    def test_nonpass_changes_need_no_receipt(self):
        self.assertEqual(GUARD.newly_passing(MATRIX, replace_status(MATRIX, CELL, 'BLOCKED(SYNTHETIC)')), [])

    def test_missing_new_pass_receipt_rejects(self):
        with self.assertRaisesRegex(ValueError, 'lacks a bound completion'):
            self.validate({'schemaVersion': 1, 'cells': {}})

    def test_valid_exact_cell_completion_and_preflight(self):
        self.assertEqual(self.validate(), [CELL])

    def test_admission_only_is_not_completion(self):
        index = {'schemaVersion': 1, 'cells': {CELL: {'completion': self.bind('admission-only.json', self.preflight)}}}
        with self.assertRaisesRegex(ValueError, 'Admission alone'):
            self.validate(index)

    def test_wrong_completion_cell_or_component_aggregate_rejects(self):
        for cell in ['CAT.text.G04', 'CAT.indicator']:
            with self.subTest(cell=cell):
                self.done['cell'] = cell
                with self.assertRaises(ValueError): self.validate()

    def test_completion_failure_partial_or_uncertain_cleanup_rejects(self):
        for key, value in [('status', 'FAIL'), ('criteriaComplete', False), ('cleanupVerified', False), ('kind', 'admission')]:
            with self.subTest(key=key):
                original = self.done[key]; self.done[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.done[key] = original

    def test_preflight_wrong_cell_failed_or_stale_version_rejects(self):
        for key, value in [('cell', 'CAT.text.G04'), ('status', 'REJECTED'), ('checklistVersion', 'NATIVE-CELL-OLD'), ('checklistSHA256', '0' * 64)]:
            with self.subTest(key=key):
                original = self.preflight[key]; self.preflight[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.preflight[key] = original

    def test_completion_stale_version_or_binding_rejects(self):
        for key, value in [('checklistVersion', 'NATIVE-CELL-OLD'), ('checklistSHA256', '0' * 64), ('driverSHA256', 'c' * 64), ('planSHA256', 'd' * 64)]:
            with self.subTest(key=key):
                original = self.done[key]; self.done[key] = value
                with self.assertRaises(ValueError): self.validate()
                self.done[key] = original

    def test_changed_completion_hash_rejects(self):
        index = self.materialize(); index['cells'][CELL]['completion']['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash mismatch'): self.validate(index)

    def test_changed_preflight_hash_rejects(self):
        index = self.materialize()
        self.done['preflight']['sha256'] = '0' * 64
        index['cells'][CELL]['completion'] = self.bind('completion.json', self.done)
        with self.assertRaisesRegex(ValueError, 'hash mismatch'): self.validate(index)

    def test_incomplete_native_method_claim_rejects(self):
        self.done['nativeMethodEvidenceClaimed'] = True
        self.done['nativeMethods'] = []
        with self.assertRaisesRegex(ValueError, 'claim/list mismatch'): self.validate()

    def native_log(self, text):
        path = self.root / 'native.log'; path.write_text(text)
        self.done['nativeMethodEvidenceClaimed'] = True
        self.done['nativeMethods'] = [{'kind': 'native_method', 'claim': 'Synthetic saved receipt reader control only', 'path': str(path), 'sha256': GATE.digest(path), 'format': 'xctest_log', 'method': 'testI06ShapeAndCallbackFinalStyle', 'maximumSeconds': 180}] + [self.done['nativeMethods'][-1]]

    def test_clean209_second_native_method_has_no_independent180_second_rejection(self):
        self.native_log("Test Case '-[Module.Case testI06ShapeAndCallbackFinalStyle]' passed (209.779 seconds).\n")
        self.validate()

    def test_native_method_cannot_exceed_the_overall30_minute_attempt(self):
        self.native_log("Test Case '-[Module.Case testI06ShapeAndCallbackFinalStyle]' passed (1800.001 seconds).\n")
        with self.assertRaisesRegex(ValueError, 'enclosing maximum attempt duration'): self.validate()

    def test_timeout_warning_with_raw_pass_within_budget_rejected(self):
        self.native_log("Test Case '-[Module.Case testI06ShapeAndCallbackFinalStyle]' exceeded execution time allowance of 3 minutes.\nTest Case '-[Module.Case testI06ShapeAndCallbackFinalStyle]' passed (100 seconds).\n")
        with self.assertRaisesRegex(ValueError, 'Failed/timed-out'): self.validate()

    def test_bound_native_pass_within_existing_limit(self):
        self.native_log("Test Case '-[Module.Case testI06ShapeAndCallbackFinalStyle]' passed (119.752 seconds).\n")
        self.assertEqual(self.validate(), [CELL])

    def test_completion_cannot_predate_preflight(self):
        self.done['finishedUTC'] = '2026-11-05T06:50:00+00:00'
        with self.assertRaises(ValueError): self.validate()

    def test_missing_or_naive_completion_time_rejects(self):
        for value in [None, '2026-11-05T07:10:00']:
            self.done['finishedUTC'] = value
            with self.assertRaises((ValueError, TypeError)): self.validate()

    def test_changed_maintained_driver_rejects(self):
        (self.root / "driver.py").write_text("# changed after admission\n")
        with self.assertRaisesRegex(ValueError, "Maintained driver bytes"): self.validate()

    def test_absolute_or_escaping_driver_rejects(self):
        for name in [str(self.root / "driver.py"), "../driver.py"]:
            self.done["driver"]["path"] = name
            with self.assertRaisesRegex(ValueError, "maintained repository driver"): self.validate()

    def test_g04_requires_both_platforms(self):
        for format in ["xctest_log", "android_receipt"]:
            with self.subTest(format=format):
                previous = self.done["nativeMethods"]
                self.done["nativeMethods"] = [method for method in previous if method["format"] == format]
                with self.assertRaisesRegex(ValueError, "required platform evidence"): self.validate()
                self.done["nativeMethods"] = previous

    def test_platform_gate_requires_only_its_platform(self):
        for gate, format in [("G07", "android_receipt"), ("G08", "xctest_log")]:
            cell = "CAT.indicator." + gate
            methods = self.done["nativeMethods"]
            self.done["nativeMethods"] = [method for method in methods if method["format"] == format]
            self.done["cell"] = self.preflight["cell"] = cell
            self.done["preflight"] = self.bind("preflight.json", self.preflight)
            index = {"schemaVersion": 1, "cells": {cell: {"completion": self.bind("completion.json", self.done)}}}
            self.assertEqual(GUARD.validate_promotions([cell], index, GATE.VERSION, GATE.digest(GATE.CHECKLIST), lambda name: (self.root / name).read_bytes(), GATE.native_method), [cell])
            self.done["nativeMethods"] = methods

    def test_cli_uses_staged_ledger_index_and_receipts_without_git_writes(self):
        index = self.materialize()
        staged_done = json.dumps(self.done).encode()
        index['cells'][CELL]['completion'] = {'path': 'planning/component-library/fixtures/native-base-controls/example-completion.json', 'sha256': __import__('hashlib').sha256(staged_done).hexdigest()}
        blobs = {'HEAD:' + GUARD.LEDGER: MATRIX.encode(), ':' + GUARD.LEDGER: replace_status(MATRIX, CELL, 'PASS(SYNTHETIC)').encode(), ':' + GUARD.INDEX: json.dumps(index).encode(), ':' + GUARD.CHECKLIST: (REPO / GUARD.CHECKLIST).read_bytes(), ':' + GUARD.GATE: (REPO / GUARD.GATE).read_bytes(), ':planning/component-library/fixtures/native-base-controls/example-completion.json': staged_done}
        blobs[":driver.py"] = (self.root / "driver.py").read_bytes()
        calls = []
        def fake_git(argv, **kwargs):
            self.assertEqual(argv[:2], ['git', 'show']); calls.append(argv[2]); return blobs[argv[2]]
        with mock.patch.object(sys, 'argv', ['guard', '--repository', str(REPO)]), mock.patch.object(GUARD.subprocess, 'check_output', side_effect=fake_git):
            self.assertEqual(GUARD.main(), 0)
        self.assertIn(':planning/component-library/fixtures/native-base-controls/example-completion.json', calls)

    def test_cli_no_promotion_does_not_load_new_index_or_receipts(self):
        calls = []
        def fake_git(argv, **kwargs):
            self.assertEqual(argv[:2], ['git', 'show']); calls.append(argv[2]); return MATRIX.encode()
        with mock.patch.object(sys, 'argv', ['guard', '--repository', str(REPO)]), mock.patch.object(GUARD.subprocess, 'check_output', side_effect=fake_git):
            self.assertEqual(GUARD.main(), 0)
        self.assertEqual(calls, ['HEAD:' + GUARD.LEDGER, ':' + GUARD.LEDGER])


if __name__ == '__main__':
    unittest.main()
