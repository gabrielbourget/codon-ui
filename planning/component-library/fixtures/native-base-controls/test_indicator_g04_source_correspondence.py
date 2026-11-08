"""Portable source controls only; actual native qualification has separate receipts."""
import collections
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
BASELINE = json.loads((ROOT / 'IndicatorG04SourceBaseline.json').read_text())
SOURCE = (ROOT / 'IndicatorG04UITests.swift').read_text()


def body(source, name):
    match = re.search(r'\bfunc ' + re.escape(name) + r'\(', source)
    assert match, name
    start, depth = source.index('{', match.start()), 0
    for token in re.finditer(r'"(?:\\.|[^"\\])*"|//[^\n]*|[{}]', source[start:]):
        if token.group() == '{': depth += 1
        elif token.group() == '}':
            depth -= 1
            if depth == 0: return source[start:start + token.end()]
    raise AssertionError('Unclosed ' + name)


def check(source):
    for key in ['priorNineMethodBodySHA256', 'unchangedHelperBodySHA256']:
        for name, expected in BASELINE[key].items():
            current = BASELINE.get('timingPolicyHelperBodySHA256', {}).get(name, expected)
            assert hashlib.sha256(body(source, name).encode()).hexdigest() == current, name
    actual = collections.Counter(line.strip() for line in body(source, 'verify').splitlines() if 'XCTAssert' in line)
    assert not (collections.Counter(BASELINE['verifyAssertionCounter']) - actual), 'Lost/changed native assertion'
    observation = body(source, 'focusedObservation')
    for text in ['let root = try app.snapshot()', 'XCTAssertLessThanOrEqual(matches.count, 1', 'identified("state")', 'identified("parent")', 'identified("reference-parent")', 'identified("target", required: false)']:
        assert text in observation, text
    for text in ['let after = try focusedObservation()', 'XCTAssertEqual(after.stateLabel, before.stateLabel', 'XCTAssertEqual(after.target, before.target', 'private func verify(_ index: Int, _ label: String, focused: Bool = false)', 'let referenceParent = observation?.referenceParent ?? node("reference-parent").frame']:
        assert text in source, text
    for name, expected in BASELINE['pendingMethodSixObservationLabels'].items():
        actual = [list(row) for row in re.findall(r'try verify\((\d+), ("[^"]+"), focused: true\)', body(source, name))]
        assert expected == actual and len(actual) == 3, name
    return True


class IndicatorG04SourceCorrespondenceTests(unittest.TestCase):
    def test_executed_source_identity(self):
        self.assertEqual(BASELINE['sourceSHA256'], 'bbb43ed9e9171270c81cace5a9200cf3df62da7dbbb9ee0aebb4381d9f043b54')
        self.assertEqual(hashlib.sha256((ROOT / 'IndicatorG04UITests.swift').read_bytes()).hexdigest(), BASELINE.get('currentSourceSHA256', BASELINE['executedSourceSHA256']))
        self.assertEqual(BASELINE['executedSourceSHA256'], 'f1af481aaae607e8f6baaa1e987d3a993664c8912e52e7d13e165f145ae1c0eb')
    def test_positive_original_nine_helpers_assertions_and_six_labels(self): self.assertTrue(check(SOURCE))
    def test_negative_missing_exact_color_assertion(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('            XCTAssertEqual(center, rawCenter, "Exact same-screen native center RGB")\n', '', 1))
    def test_negative_relaxed_geometry(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('XCTAssertEqual(frame.width, CGFloat(expected.0), accuracy: onePixel)', 'XCTAssertEqual(frame.width, CGFloat(expected.0), accuracy: 2 * onePixel)', 1))
    def test_negative_wrong_reference_target(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('let referenceParent = observation?.referenceParent ?? node("reference-parent").frame', 'let referenceParent = observation?.referenceParent ?? node("parent").frame', 1))
    def test_negative_stale_snapshot_reuse(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('let after = try focusedObservation()', 'let after = before', 1))
    def test_negative_duplicate_target_guard_removed(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('XCTAssertLessThanOrEqual(matches.count, 1', 'XCTAssertLessThanOrEqual(matches.count, 2', 1))
    def test_negative_prior_method_changed(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('try matrix(0...3, "light")', 'try matrix(0...2, "light")', 1))
    def test_negative_observation_label_removed(self):
        with self.assertRaises(AssertionError): check(SOURCE.replace('"IND-callback-zero-opacity", focused: true', '"wrong-label", focused: true', 1))


if __name__ == '__main__': unittest.main(verbosity=2)
