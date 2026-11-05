"""Portable transport controls; actual checker functions, synthetic files, no process/SDK."""
import ast
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time
import types
import unittest

CHECKER = Path(__file__).with_name('IndicatorG04AndroidCheck.py')
NAMES = {'HostStop', 'decode_batch', 'request_key', 'prepare_row_decode', 'decoder_result'}


class IndicatorTransportTests(unittest.TestCase):
    def test_reused_cell_requires_admission_before_output_or_decoder(self):
        import os
        import unittest.mock
        tree = ast.parse(CHECKER.read_text())
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
        namespace = {'__file__': str(CHECKER)}
        exec(compile(ast.Module(body=[main], type_ignores=[]), str(CHECKER), 'exec'), namespace)
        output = self.root / 'never-opened-without-admission'
        with unittest.mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'Use NativeCellVerification.py'):
                namespace['main'](types.SimpleNamespace(cell='CAT.indicator.G07', out=output))
        self.assertFalse(output.exists())

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='codon-indicator-transport-')
        self.root = Path(self.temp.name)
        self.png = self.root / 'synthetic-immutable-image.dat'
        self.png.write_bytes(b'Transport binding fixture only; no image decode.')
        self.binary = self.root / 'synthetic-nonexecutable-decoder.dat'
        self.binary.write_bytes(b'Never executed; Popen is a test double.')
        self.requests = [(name, {'png': str(self.png), 'tag': name}) for name in ['style', 'supplement', 'readiness-0', 'readiness-1']]
        self.response = {'status': 'DECODE_BATCH_COMPLETE', 'requestCount': 4, 'errorCount': 0, 'results': [{'id': name, 'exitCode': 0, 'result': {'status': 'PASS', 'png': request['png']}} for name, request in self.requests]}
        self.returncode = 0; self.raw = None; self.communicate_error = None; self.gone = True; self.calls = 0; self.stops = 0
        owner = self
        class Process:
            pid = 17
            @property
            def returncode(self): return owner.returncode
            def communicate(self, data, timeout):
                if owner.communicate_error: raise owner.communicate_error
                owner.assertEqual(len(json.loads(data)['batch']), 4)
                owner.assertLessEqual(timeout, 10)
                return (owner.raw if owner.raw is not None else json.dumps(owner.response).encode(), b'')
        def popen(*args, **kwargs):
            self.calls += 1
            self.assertTrue(kwargs['start_new_session'])
            return Process()
        def stop(_process):
            self.stops += 1
            return self.gone
        module = ast.parse(CHECKER.read_text())
        selected = [node for node in module.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in NAMES]
        self.ns = {'json': json, 'Path': Path, 'hashlib': hashlib, 'time': time,
                   'subprocess': types.SimpleNamespace(Popen=popen, PIPE=subprocess.PIPE), 'stop_owned_process': stop}
        exec(compile(ast.Module(body=selected, type_ignores=[]), str(CHECKER), 'exec'), self.ns)
        self.ns['row_requests'] = lambda *args: copy.deepcopy(self.requests)
        self.args = types.SimpleNamespace(color_oracle=self.binary, expected_color_oracle_sha256=hashlib.sha256(self.binary.read_bytes()).hexdigest(), deadline_unix=time.time() + 60)
        self.output = self.root / 'row'

    def tearDown(self): self.temp.cleanup()

    def prepare(self):
        self.ns['prepare_row_decode']({}, {}, {}, {}, 1, self.png, self.root, self.args, self.output)

    def assert_cleaned(self):
        self.assertEqual(self.stops, 1)
        receipt = json.loads(self.output.with_suffix('.command.json').read_text())
        self.assertEqual(receipt['ownedGroupGone'], self.gone)

    def test_positive_one_process_for_four_requests(self):
        self.prepare()
        self.assertEqual(self.calls, 1)
        self.assert_cleaned()
        self.assertEqual(len(self.args.row_decode_results), 4)
        self.assertEqual(self.ns['decoder_result'](self.requests[0][1], self.args)['status'], 'PASS')

    def test_nonzero_transport_rejects_and_cleans(self):
        self.returncode = 1
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_wrong_transport_envelope_rejects_and_cleans(self):
        self.response['status'] = 'PASS'
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_malformed_transport_json_rejects_and_cleans(self):
        self.raw = b'not JSON'
        with self.assertRaises(json.JSONDecodeError): self.prepare()
        self.assert_cleaned()

    def test_timeout_rejects_and_cleans(self):
        self.communicate_error = subprocess.TimeoutExpired('synthetic decoder', 10)
        with self.assertRaises(subprocess.TimeoutExpired): self.prepare()
        self.assert_cleaned()

    def test_unresolved_group_is_fatal(self):
        self.gone = False
        with self.assertRaises(self.ns['HostStop']): self.prepare()
        self.assert_cleaned()

    def test_missing_item_rejects(self):
        self.response['results'].pop()
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_duplicate_item_id_rejects(self):
        self.response['results'][1]['id'] = 'style'
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_nonzero_item_error_count_rejects(self):
        self.response['errorCount'] = 1
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_failed_item_cannot_hide_in_complete_transport(self):
        self.response['results'][1]['exitCode'] = 1
        self.response['results'][1]['result']['status'] = 'FAIL'
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_wrong_png_result_rejects(self):
        self.response['results'][1]['result']['png'] = 'another-file'
        with self.assertRaises(AssertionError): self.prepare()
        self.assert_cleaned()

    def test_png_drift_after_decode_rejects(self):
        self.prepare()
        self.png.write_bytes(b'changed')
        with self.assertRaises(AssertionError): self.ns['decoder_result'](self.requests[0][1], self.args)


if __name__ == '__main__':
    unittest.main()
