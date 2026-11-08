"""Fixed Meter G02 host checks over pulled native receipts and actual PNGs."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import signal
import struct
import subprocess
import sys
import time

sys.dont_write_bytecode = True
FIXTURE = Path('/Users/gabrielbourget/Desktop/Dev/wavemap/tendril-systems/codon-ui/planning/component-library/fixtures/native-base-controls')
sys.path.insert(0, str(FIXTURE))
from NativeAndroidTestSupport import stop_owned_process

METHODS = ['values', 'format', 'motion', 'events']
TARGET = 'meter-g02-target'
NAME = 'G02 meter'
BINDING = ['rootTag', 'refIdentity', 'attaches', 'detaches']
TOUCH = {'touchStart', 'touchEnd', 'touchCancel'}
ORACLE_SHA256 = '2726cfdead8392e6abe9492323b04cdd846af5a1e22dcb9f0a8af1595456a2b2'


class HostStop(BaseException):
    pass


def expectation(owner, semantic, fraction, paint=True):
    return {'owner': owner, 'semantic': semantic, 'fraction': fraction, 'paint': paint}


ZERO = expectation({'value': 0}, (0, 100, 0, '0%'), 0)
FULL = expectation({'value': 80, 'minValue': -50, 'maxValue': 50}, (-50, 50, 50, '100%'), 1)
CASES = {
    'values': {
        'zero-baseline': ZERO, 'full-baseline': FULL,
        'value25': expectation({'value': 25}, (0, 100, 25, '25%'), .25),
        'explicit-zero': expectation({'value': 0, 'minValue': 0, 'maxValue': 100}, (0, 100, 0, '0%'), 0),
        'negative25': expectation({'value': -25, 'minValue': -50, 'maxValue': 50}, (-50, 50, -25, '25%'), .25),
        'lower-clamp': expectation({'value': -80, 'minValue': -50, 'maxValue': 50}, (-50, 50, -50, '0%'), 0),
        'upper-clamp': FULL,
        'default-bounds80': expectation({'value': 80}, (0, 100, 80, '80%'), .8),
        'deferred35': expectation({'value': 35, 'minValue': -5, 'maxValue': 75, 'valueLabel': ''}, (-5, 75, 35, None), .5),
    },
    'format': {
        'zero-baseline': ZERO, 'full-baseline': FULL,
        'english1250': expectation({'value': 1250, 'maxValue': 2000, 'locale': 'en-US', 'formatOptions': {'style': 'decimal'}}, (0, 2000, 1250, '1,250'), .625),
        'french1250': expectation({'value': 1250, 'maxValue': 2000, 'locale': 'fr-CA', 'formatOptions': {'style': 'decimal'}}, (0, 2000, 1250, 'french-decimal'), .625),
        'authored-label25': expectation({'value': 25, 'valueLabel': 'One quarter'}, (0, 100, 25, 'One quarter'), .25),
        'empty-label0': expectation({'value': 0, 'valueLabel': ''}, (0, 100, 0, None), 0),
        'context-changed0': expectation({'value': 0, 'valueLabel': ''}, (0, 100, 0, None), 0, False),
        'context-restored0': expectation({'value': 0, 'valueLabel': ''}, (0, 100, 0, None), 0),
    },
    'motion': {
        'zero-baseline': ZERO, 'full-baseline': FULL,
        'known25': expectation({'value': 25}, (0, 100, 25, '25%'), .25),
        'known75': expectation({'value': 75}, (0, 100, 75, '75%'), .75),
        **{f'latest10-{index}': expectation({'value': 10}, (0, 100, 10, '10%'), .1) for index in range(3)},
        'reinsert-zero-before-calibration': ZERO, 'reinsert-zero-baseline': ZERO, 'reinsert-full-baseline': FULL,
        'reinsert-zero-quiet0': ZERO, 'reinsert-zero-quiet1': ZERO,
    },
    'events': {
        'initial-default0': expectation({'value': 0}, (0, 100, 0, '0%'), 0, False),
        'reinsert-zero-before-calibration': ZERO, 'reinsert-zero-baseline': ZERO, 'reinsert-full-baseline': FULL,
        'reinsert-zero-quiet': ZERO,
    },
}


def state(value):
    assert isinstance(value, dict) and value['dropped'] == 0
    trace = value['receipts']
    assert [row['sequence'] for row in trace] == list(range(1, len(trace) + 1)), 'Noncumulative receipt sequence'
    for row in trace:
        assert isinstance(row['receivedAt'], (int, float))
    return value


def retained(original, current):
    state(original);state(current)
    assert current['visible'] and current['rootTag'] > 0 and current['refIdentity'] > 0
    assert all(current[key] == original[key] for key in BINDING), 'Public root/ref identity changed'


def delta(before, after, kinds=None):
    state(before);state(after)
    assert after['receipts'][:len(before['receipts'])] == before['receipts'], 'Cumulative trace prefix changed'
    rows = after['receipts'][len(before['receipts']):]
    return rows if kinds is None else [row for row in rows if row['kind'] in kinds]


def semantic(native, minimum, maximum, now, text):
    assert native['id'] == TARGET and native['visible'] and native['className'] == 'android.view.View' and native.get('roleDescription') == 'Progress Bar'
    assert native['windowRoots'] > 0
    assert len([row for row in native['windowNodes'] if row.get('id') == TARGET or row.get('description') == TARGET]) == 1, 'Exactly one actual public target required'
    assert not any("isn't responding" in (row.get('text') or '') for row in native['windowNodes']), 'In-case ANR is fatal'
    assert all(key in native for key in ['stateDescription', 'contentDescription', 'rangeInfo', 'currentValue', 'text', 'textIsNull', 'nativeUptimeMs', 'nativeEpochMs'])
    assert isinstance(native['textIsNull'], bool)
    if now is None:
        assert native['rangeInfo'] is None and native['currentValue'] is None, 'Unknown progress retained numeric range'
    else:
        actual = native['rangeInfo']
        assert isinstance(actual, dict)
        assert all(math.isclose(actual[key], expected, abs_tol=1e-5) for key, expected in [('min', minimum), ('max', maximum), ('current', now)])
        assert math.isclose(native['currentValue'], now, abs_tol=1e-5)
    assert isinstance(native['contentDescription'], str) and native['contentDescription'].startswith(NAME)
    suffix = native['contentDescription'][len(NAME):]
    if text is None:
        assert suffix in ('', ', '), 'Empty/unknown label retained numeric text'
    elif text == 'french-decimal':
        assert re.fullmatch(r', 1\s250', suffix), 'Actual French decimal mismatch'
    else:
        assert suffix == ', ' + text, 'Actual value text mismatch'


def bounds(native):
    left, top, right, bottom = map(int, native['bounds'].split())
    assert right > left and bottom > top
    return [left, top, right - left, bottom - top]


def image(observation, directory):
    native = observation['native'];value = observation['image']
    assert value['rootRect'] == bounds(native), 'PNG crop differs from actual native root frame'
    relative = Path(value['png'])
    assert len(relative.parts) == 1 and relative.name.endswith('.png'), 'PNG must be one retained relative filename'
    path = directory / relative
    assert path.resolve().is_relative_to(directory.resolve())
    raw = path.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n' and raw[12:16] == b'IHDR'
    width, height = struct.unpack('>II', raw[16:24])
    assert height > width and value['screenRect'] == [0, 0, width, height]
    left, top, w, h = value['rootRect']
    assert 0 <= left and 0 <= top and left + w <= width and top + h <= height
    current = observation['state']
    assert observation['calibrationKey'] == ':'.join(map(str, [current['rootTag'], current['refIdentity'], w, h]))
    assert observation['captureStartedEpochMs'] <= native['nativeEpochMs'] <= observation['captureFinishedEpochMs']
    return {'png': str(path), 'rootRect': value['rootRect'], 'screenRect': value['screenRect']}


def all_states(value):
    if isinstance(value, dict):
        if 'receipts' in value and 'owner' in value:
            yield state(value)
        else:
            for child in value.values():
                yield from all_states(child)
    elif isinstance(value, list):
        for child in value:
            yield from all_states(child)


def trace_checks(cohort):
    states = cohort['states'];original = state(states['prepare'])
    traces = sorted(all_states(cohort), key=lambda value: len(value['receipts']))
    for before, after in zip(traces, traces[1:]):
        delta(before, after)
    assert original['owner'] == {'value': 0} and original['callback'] == 'original' and original['pointerEvents'] == 'auto'
    assert original['expanded'] and original['visible'] and original['pending'] is None and not original['retireOnStart']
    if states['prepareBaseline'] is not None and states['prepareBaseline']['visible']:
        retained(states['prepareBaseline'], original)
    baseline = len(states['prepareBaseline']['receipts']) if states['prepareBaseline'] is not None else 0
    final_trace = max(traces, key=lambda value: len(value['receipts']))['receipts']
    for row in final_trace[baseline:]:
        if row['kind'] in TOUCH | {'layout'}:
            assert not row['afterDetach'] and row['rootTag'] is not None
            assert row['data']['currentTarget'] == row['rootTag'], 'Callback targets missing/retired/wrong root'
    assert any(row['kind'] == 'layout' and row['rootTag'] == original['rootTag'] for row in final_trace)
    owner_controls = {
        'G02 MT zero defaults': ZERO['owner'], 'G02 MT upper clamp': FULL['owner'],
        'G02 MT value 25': {'value': 25},
        'G02 MT explicit zero bounds': CASES['values']['explicit-zero']['owner'],
        'G02 MT negative bounded': CASES['values']['negative25']['owner'],
        'G02 MT lower clamp': CASES['values']['lower-clamp']['owner'],
        'G02 MT restore default bounds': {'value': 80},
        'G02 MT deferred 35': CASES['values']['deferred35']['owner'],
        'G02 MT English decimal': CASES['format']['english1250']['owner'],
        'G02 MT French decimal': CASES['format']['french1250']['owner'],
        'G02 MT authored label': CASES['format']['authored-label25']['owner'],
        'G02 MT empty label': CASES['format']['empty-label0']['owner'],
        'G02 MT value 75': CASES['motion']['known75']['owner'],
        'G02 MT widen root': {'value': 0, 'width': 180},
    }
    for update in states.get('ownerUpdates', []):
        before, acknowledged, quiet = [state(update[key]) for key in ['before', 'acknowledged', 'quiet']]
        retained(before, acknowledged);retained(before, quiet)
        assert acknowledged['pending'] is None and quiet['owner'] == acknowledged['owner'] == owner_controls[update['label']]
        assert not delta(before, quiet, TOUCH), 'Programmatic owner update fabricated contact'
        if update['label'] != 'G02 MT widen root':
            assert not delta(before, quiet, {'layout'}), 'Owner-only update fabricated layout'
    expected_flags = {f'G02 MT {panel} controls': ('panel', panel) for panel in ['values', 'format', 'motion', 'events']}
    expected_flags.update({'G02 MT replace callbacks': ('callback', 'current'), 'G02 MT ignore pointer input': ('pointerEvents', 'none'), 'G02 MT accept pointer input': ('pointerEvents', 'auto'), 'G02 MT retire on touch start': ('retireOnStart', True)})
    for update in states.get('flagUpdates', []):
        before, acknowledged, quiet = [state(update[key]) for key in ['before', 'acknowledged', 'quiet']]
        retained(before, acknowledged);retained(before, quiet)
        assert before['owner'] == acknowledged['owner'] == quiet['owner']
        assert not delta(before, quiet, TOUCH | {'layout'})
        flag, expected = expected_flags[update['label']]
        assert acknowledged[flag] == quiet[flag] == expected
    if cohort['name'] == 'format':
        changed, restored = state(states['contextChanged']), state(states['contextRestored'])
        empty = next(row['state'] for row in cohort['observations'] if row['name'] == 'empty-label0')
        retained(original, changed);retained(original, restored)
        assert changed['owner'] == restored['owner'] == empty['owner']
        assert not delta(empty, restored, TOUCH)
    if cohort['name'] == 'values':
        final = max(all_states(cohort), key=lambda value: len(value['receipts']))
        assert any(row['kind'] == 'scheduled' and row['data']['operation'] == 'deferred-35' for row in final['receipts'])
    if cohort['name'] == 'motion':
        final = max(all_states(cohort), key=lambda value: len(value['receipts']))
        assert any(row['kind'] == 'scheduled' and row['data']['operation'] == 'supersede-latest' for row in final['receipts'])
        before, delivered = state(states['supersedeBefore']), state(states['supersedeDelivered'])
        retained(original, delivered)
        assert delivered['owner'] == {'value': 10} and delivered['pending'] is None
        assert not delta(before, delivered, TOUCH | {'layout'})
        latest = next(row['state'] for row in cohort['observations'] if row['name'] == 'latest10-2')
        assert not delta(delivered, latest, TOUCH | {'layout'})
    if cohort['name'] == 'events':
        assert {'G02 MT replace callbacks', 'G02 MT ignore pointer input', 'G02 MT accept pointer input', 'G02 MT retire on touch start'} <= {update['label'] for update in states['flagUpdates']}
        physical_rows = [row for row in cohort['actions'] if 'command' in row]
        physical = {row['label']: row for row in physical_rows}
        assert len(physical) == len(physical_rows)
        expected_contacts = ['original-contact', 'current-contact', 'ignored-contact', 'restored-contact']
        assert set(physical) == set(expected_contacts + ['held-retirement-contact'])
        for label, action in physical.items():
            left, top, width, height = bounds(action)
            x, y = left + width // 2, top + height // 2
            duration = 3000 if label == 'held-retirement-contact' else 200
            assert action['command'] == f'input touchscreen swipe {x} {y} {x} {y} {duration}'
            assert action['exitCode'] == 0 and re.search(r'(?:^|\n)CODON_INPUT_EXIT=0\r?\n', action['output'])
            assert action['transport'] == 'UiAutomation.executeShellCommandRw(sh),same connection'
            assert action['finishedUptimeMs'] >= action['startedUptimeMs']
        contacts = states['contacts']
        assert [row['name'] for row in contacts] == ['original-contact', 'current-contact', 'ignored-contact', 'restored-contact']
        for contact, recipient, enabled in zip(contacts, ['original', 'current', 'current', 'current'], [True, True, False, True]):
            before, after = state(contact['before']), state(contact['after'])
            retained(original, before);retained(original, after)
            assert before['owner'] == after['owner'] and contact['durationMs'] == 200
            assert bounds(contact['nativeBefore']) == bounds(physical[contact['name']])
            events = delta(before, after, TOUCH)
            assert events == contact['events']
            if not enabled:
                assert not events and before['pointerEvents'] == after['pointerEvents'] == 'none'
                continue
            assert [row['kind'] for row in events] == ['touchStart', 'touchEnd']
            assert all(row['data']['recipient'] == recipient and row['rootTag'] == original['rootTag'] for row in events)
            changed = [row['data']['native']['changedTouches'] for row in events]
            assert all(len(touches) == 1 for touches in changed) and changed[0][0]['identifier'] == changed[1][0]['identifier']
            assert events[0]['data']['native']['timestamp'] <= events[1]['data']['native']['timestamp']
        layout = states['layout'];before, after = state(layout['before']), state(layout['after'])
        retained(original, before);retained(original, after)
        layouts = delta(before, after, {'layout'})
        assert after['owner'] == {'value': 0, 'width': 180} and not delta(before, after, TOUCH)
        assert layouts and layouts == layout['newLayouts']
        assert all(row['data']['recipient'] == 'current' and row['data']['currentTarget'] == original['rootTag'] for row in layouts)
        assert math.isclose(layouts[-1]['data']['native']['layout']['width'], 180, abs_tol=.01)
        assert bounds(layout['nativeAfter'])[2] > bounds(layout['nativeBefore'])[2]
    if cohort['name'] in ['motion', 'events']:
        assert len(states['retirements']) == 1
        retirement = states['retirements'][0]
        assert retirement['name'] == ('visual-retirement' if cohort['name'] == 'motion' else 'held-retirement')
        before, removed, fresh = [state(retirement[key]) for key in ['before', 'removed', 'reinserted']]
        assert before['visible'] and not removed['visible'] and removed['rootTag'] is None and removed['pending'] is None
        assert removed['detaches'] == original['detaches'] + 1
        absence = retirement['absence']
        assert absence['windowRoots'] > 0 and not any(row.get('id') == TARGET or row.get('description') == TARGET for row in absence['windowNodes'])
        assert not any("isn't responding" in (row.get('text') or '') for row in absence['windowNodes'])
        assert fresh['visible'] and fresh['owner'] == {'value': 0} and fresh['rootTag'] != original['rootTag'] and fresh['refIdentity'] != original['refIdentity']
        assert fresh['attaches'] == original['attaches'] + 1
        assert len(retirement['quietStates']) == (2 if cohort['name'] == 'motion' else 1)
        for quiet in retirement['quietStates']:
            retained(fresh, quiet)
            assert quiet['owner'] == {'value': 0} and quiet['pending'] is None
        if cohort['name'] == 'events':
            events = delta(before, removed)
            starts = [row for row in events if row['kind'] == 'touchStart'];detaches = [row for row in events if row['kind'] == 'detach']
            assert len(starts) == len(detaches) == 1 and starts[0]['sequence'] < detaches[0]['sequence']
            assert starts[0]['data']['recipient'] == 'current' and starts[0]['data']['currentTarget'] == original['rootTag']
            assert not [row for row in events if row['kind'] in TOUCH and row['sequence'] > detaches[0]['sequence']]
        else:
            assert not delta(before, removed, TOUCH)
            quiet_removed = state(retirement['quietRemoved'])
            assert not quiet_removed['visible'] and quiet_removed['rootTag'] is None
    return original


def paint(request, oracle, output, deadline):
    assert hashlib.sha256(oracle.read_bytes()).hexdigest() == ORACLE_SHA256
    assert deadline - time.time() > 8, 'Host paint deadline reserve exhausted'
    output.with_suffix('.request.json').write_text(json.dumps(request, indent=2) + '\n')
    process = subprocess.Popen([str(oracle)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    record = {'argv': [str(oracle)], 'pid': process.pid, 'startedEpoch': time.time()}
    try:
        stdout, stderr = process.communicate(json.dumps(request).encode(), timeout=deadline - time.time() - 8)
        output.with_suffix('.stdout').write_bytes(stdout);output.with_suffix('.stderr').write_bytes(stderr)
        record['exitCode'] = process.returncode
        result = json.loads(stdout)
        assert process.returncode == 0 and result['status'] == 'PASS', result
        return result
    finally:
        cleanup_error = None
        record['ownedGroupGone'] = False
        try:
            record['ownedGroupGone'] = stop_owned_process(process)
            if not record['ownedGroupGone']:
                cleanup_error = 'Host oracle process group unresolved'
                record['cleanupError'] = cleanup_error
        except BaseException as error:
            cleanup_error = repr(error)
            record['cleanupError'] = cleanup_error
        finally:
            record['endedEpoch'] = time.time()
            output.with_suffix('.command.json').write_text(json.dumps(record, indent=2) + '\n')
        if cleanup_error is not None:
            raise HostStop('Fatal oracle cleanup: ' + cleanup_error)


def check_cohort(cohort, directory, out, scale, oracle, deadline):
    name = cohort['name'];errors = [];checked = [];manual = []
    out.mkdir()
    try:
        assert cohort['status'] == 'NATIVE_ASSERTIONS_PASSED_PENDING_PAINT', cohort.get('error', cohort['status'])
        assert 0 <= cohort['elapsedMs'] <= 1800000
        original = trace_checks(cohort)
    except Exception as error:
        errors.append({'phase': 'native-and-trace', 'error': repr(error)})
        original = cohort.get('states', {}).get('prepare')
    observations = cohort.get('observations', [])
    by_name = {row['name']: row for row in observations}
    if len(by_name) != len(observations) or set(by_name) != set(CASES[name]):
        errors.append({'phase': 'observation-set', 'actual': list(by_name), 'expected': list(CASES[name])})
    for key, expected in CASES[name].items():
        try:
            observation = by_name[key];current = state(observation['state'])
            assert current['owner'] == expected['owner'] and current['pending'] is None, 'Authored owner differs from independent casebook'
            assert current['visible'] and current['rootTag'] > 0 and current['refIdentity'] > 0
            if key.startswith('reinsert-'):
                retained(cohort['states']['retirements'][0]['reinserted'], current)
            else:
                retained(original, current)
            semantic(observation['native'], *expected['semantic'])
            current_image = image(observation, directory)
            assert observation['presentation'] == ('unknown' if expected['fraction'] is None else 'determinate')
            if not expected['paint']:
                manual.append({'observation': key, 'png': current_image['png'], 'predicate': 'Retained empty-track appearance; native/ref/state independently checked; no cross-theme or cross-root numeric paint comparison'})
                checked.append({'name': key, 'nativeAndState': 'PASS', 'paint': 'ROOT_MANUAL_REVIEW_RETAINED_SCOPE'})
                continue
            prefix = 'reinsert-' if key.startswith('reinsert-') else ''
            zero = by_name[prefix + 'zero-baseline'];full = by_name[prefix + 'full-baseline']
            assert zero['calibrationKey'] == full['calibrationKey'] == observation['calibrationKey'], 'Paint calibration root/ref/frame mismatch'
            request = {'zero': image(zero, directory), 'full': image(full, directory), 'current': current_image, 'pixelsPerLogicalPoint': scale, 'quantizationPixels': 2}
            request.update({'expectedPresentation': 'unknown'} if expected['fraction'] is None else {'expectedFraction': expected['fraction']})
            result = paint(request, oracle, out / key, deadline)
            checked.append({'name': key, 'nativeAndState': 'PASS', 'paint': result})
        except Exception as error:
            errors.append({'phase': 'observation', 'name': key, 'error': repr(error)})
    return {'cohort': name, 'nativeStatus': cohort.get('status'), 'status': 'AUTOMATED_SCOPED_CHECKS_PASSED_PENDING_ROOT_REVIEW' if not errors else 'FAILED_OR_INCOMPLETE', 'errors': errors, 'observations': checked, 'manualVisualReview': manual}


def main(args):
    args.out.mkdir(exist_ok=False)
    verdicts = [];batch_errors = [];data = {}
    try:
        data = json.loads((args.input / 'receipt.json').read_text())
        assert data['operation'] == 'meter-g02-batch'
        names = [row['name'] for row in data['cohorts']]
        assert len(names) == 4 and names == METHODS, 'Expected exactly the four selected Meter methods'
        assert data.get('selectedMethods') == METHODS and data.get('selectedMethodCount') == 4, 'Native witness selection mismatch'
        assert data['epochStartedMs'] <= data['epochFinishedMs']
        try:
            assert data['status'] == 'NATIVE_BATCH_COMPLETE_PENDING_HOST_PAINT' and data['nativeActionSucceeded'] is True, 'Native batch unsafe/incomplete'
            traces = sorted(all_states(data), key=lambda value: len(value['receipts']))
            for before, after in zip(traces, traces[1:]):
                delta(before, after)
        except Exception as error:
            batch_errors.append(repr(error))
        density = re.findall(r'(?:Override|Physical) density:\s*(\d+)', args.density.read_text())
        assert density and int(density[-1]) > 0
        cohorts = data['cohorts'] + [{'name': name, 'status': 'NOT_RUN_UNSAFE', 'observations': [], 'states': {}} for name in METHODS[len(names):]]
        for cohort in cohorts:
            verdicts.append(check_cohort(cohort, args.input, args.out / cohort['name'], int(density[-1]) / 160, args.paint_oracle, args.deadline_unix))
    except BaseException as error:
        batch_errors.append(repr(error))
        for name in METHODS:
            if name not in [row['cohort'] for row in verdicts]:
                verdicts.append({'cohort': name, 'status': 'FAILED_OR_INCOMPLETE', 'errors': [{'phase': 'batch-or-transport', 'error': repr(error)}]})
    passed = not batch_errors and len(verdicts) == len(METHODS) and all(row['status'] == 'AUTOMATED_SCOPED_CHECKS_PASSED_PENDING_ROOT_REVIEW' for row in verdicts)
    terminal = {'cell': 'CAT.meter.G02', 'status': 'FOUR_COHORT_OBSERVATIONS_PENDING_ROOT_VISUAL_REVIEW' if passed else 'FAILED_OR_INCOMPLETE', 'nativeBatchStatus': data.get('status'), 'batchErrors': batch_errors, 'cohorts': verdicts, 'nativeReceiptSHA256': hashlib.sha256((args.input / 'receipt.json').read_bytes()).hexdigest() if (args.input / 'receipt.json').is_file() else None, 'paintOracleSHA256': ORACLE_SHA256, 'ledgerPromotion': False, 'finishedEpoch': time.time()}
    (args.out / 'terminal.json').write_text(json.dumps(terminal, indent=2) + '\n')
    print(json.dumps({'status': terminal['status'], 'cohorts': [{'cohort': row['cohort'], 'status': row['status']} for row in verdicts]}), flush=True)
    return 0 if passed else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--density', type=Path, required=True)
    parser.add_argument('--paint-oracle', type=Path, required=True)
    parser.add_argument('--deadline-unix', type=float, required=True)
    args = parser.parse_args()
    def interrupted(signum, _frame):
        raise HostStop('Owner signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted);signal.signal(signal.SIGINT, interrupted)
    raise SystemExit(main(args))
