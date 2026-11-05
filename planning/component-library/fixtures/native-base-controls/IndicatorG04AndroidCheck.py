"""Thin Indicator G04 adapter over unchanged native style geometry/PNG/oracle machinery."""
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
FIXTURE = Path(__file__).resolve().parent
sys.path.insert(0, str(FIXTURE))
from NativeAndroidTestSupport import stop_owned_process

ROOT = Path(__file__).parent
BINDING = ['rootTag', 'refIdentity', 'attaches', 'detaches']
BINDINGS = json.loads((ROOT / 'IndicatorG04Cases.json').read_text())
METHODS = [row['name'] for row in BINDINGS['cohorts']]
BOOK = BINDINGS['cases']


class HostStop(BaseException):
    pass


def retained(original, state):
    assert state['rootTag'] > 0 and state['refIdentity'] > 0
    assert all(state[key] == original[key] for key in BINDING), 'Actual public root/ref lifetime changed'


def rectangle(native):
    left, top, right, bottom = map(int, native['bounds'].split())
    assert right >= left and bottom >= top
    return [left, top, right - left, bottom - top]


def contained(inner, outer):
    x, y, w, h = inner;left, top, width, height = outer
    return w > 0 and h > 0 and x >= left and y >= top and x + w <= left + width and y + h <= top + height


def no_anr(windows):
    assert windows['windowRoots'] > 0
    assert not any("isn't responding" in (row.get('text') or '') for row in windows['windowNodes']), 'Actual in-case ANR is fatal'


def layout(state, owner):
    row = state['layouts'][owner]
    assert row['nativeTarget'] == row['currentTarget'] and row['nativeTarget'] > 0
    if owner == 'target':
        assert row['currentTarget'] == state['rootTag'], 'Native onLayout delivery belongs to another public root'
    return row['layout']


def image(observation, directory, landscape):
    value = observation['image'];relative = Path(value['png'])
    assert len(relative.parts) == 1 and relative.name.endswith('.png')
    png = directory / relative
    assert png.resolve().is_relative_to(directory.resolve())
    raw = png.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n' and raw[12:16] == b'IHDR'
    width, height = struct.unpack('>II', raw[16:24])
    assert (width > height) == landscape and value['screenRect'] == [0, 0, width, height], 'Actual native PNG orientation differs from fixed profile phase'
    for field, native in [('parentBounds', 'nativeParent'), ('referenceParentBounds', 'nativeReferenceParent')]:
        assert value[field] == observation[native]['bounds']
        assert contained(rectangle(observation[native]), [0, 0, width, height])
    return png


def decode_batch(request, oracle, expected_sha, output, deadline):
    assert hashlib.sha256(oracle.read_bytes()).hexdigest() == expected_sha
    assert deadline - time.time() > 18, 'Host color deadline reserve exhausted'
    output.with_suffix('.request.json').write_text(json.dumps(request, indent=2) + '\n')
    process = subprocess.Popen([str(oracle)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    record = {'argv': [str(oracle)], 'pid': process.pid, 'startedEpoch': time.time()}
    try:
        stdout, stderr = process.communicate(json.dumps(request).encode(), timeout=min(10, deadline - time.time() - 8))
        output.with_suffix('.stdout').write_bytes(stdout);output.with_suffix('.stderr').write_bytes(stderr)
        record['exitCode'] = process.returncode
        result = json.loads(stdout)
        assert process.returncode == 0 and result['status'] == 'DECODE_BATCH_COMPLETE', result
        return result
    finally:
        cleanup_error = None
        record['ownedGroupGone'] = False
        try:
            record['ownedGroupGone'] = stop_owned_process(process)
            if not record['ownedGroupGone']:
                cleanup_error = 'Host color process group unresolved'
                record['cleanupError'] = cleanup_error
        except BaseException as error:
            cleanup_error = repr(error)
            record['cleanupError'] = cleanup_error
        finally:
            record['endedEpoch'] = time.time()
            output.with_suffix('.command.json').write_text(json.dumps(record, indent=2) + '\n')
        if cleanup_error is not None:
            raise HostStop('Fatal color cleanup: ' + cleanup_error)

def request_key(request):
    return json.dumps(request, sort_keys=True, separators=(',', ':'), allow_nan=False)


def style_request(observation, density, png, target_layout, reference_layout):
    value = observation['image']
    return {'png': str(png), 'screenRect': value['screenRect'], 'targetParentRect': rectangle(observation['nativeParent']), 'referenceParentRect': rectangle(observation['nativeReferenceParent']), 'targetLayout': [target_layout[key] for key in ['x', 'y', 'width', 'height']], 'referenceLayout': [reference_layout[key] for key in ['x', 'y', 'width', 'height']], 'coordinatesPerLogicalPoint': density / 160, 'pixelsPerLogicalPoint': density / 160, 'mode': 'absent-paint' if observation['state']['index'] in [3, 5] or observation['state']['index'] == 6 and observation['state']['zeroOpacity'] else 'center-rgba'}


def point_request(png, points):
    _, size = png_path(png.parent, png.name)
    points = list(dict.fromkeys(tuple(point) for point in points))
    assert points and len(points) <= 8192
    assert all(len(p) == 2 and all(isinstance(v, int) for v in p) and 0 <= p[0] < size[0] and 0 <= p[1] < size[1] for p in points)
    return {'png': str(png), 'points': [list(p) for p in points]}


def row_requests(cohort, observation, state, request, density, png, directory):
    points, _, _, _ = supplement_points(observation, state, density)
    rows = [row for row in cohort.get('paintReadiness', []) if row['name'] == observation['name']]
    assert len(rows) == 1 and len(rows[0]['trials']) >= 2
    requests = [('style', request), ('supplement', point_request(png, points))]
    for index, trial in enumerate(rows[0]['trials'][-2:]):
        path, _ = png_path(directory, trial['png'])
        requests.append(('readiness-' + str(index), point_request(path, [trial['targetPixel'], trial['referencePixel']])))
    return requests


def prepare_row_decode(cohort, observation, state, request, density, png, directory, args, output):
    args.row_decode_results = {}
    requests = row_requests(cohort, observation, state, request, density, png, directory)
    snapshots = {request_key(value): hashlib.sha256(Path(value['png']).read_bytes()).hexdigest() for _, value in requests}
    payload = {'batch': [{'id': name, 'requestJSON': json.dumps(value)} for name, value in requests]}
    decoded = decode_batch(payload, args.color_oracle, args.expected_color_oracle_sha256, output, args.deadline_unix)
    assert decoded['requestCount'] == 4 and decoded['errorCount'] == 0, decoded
    assert [row['id'] for row in decoded['results']] == [name for name, _ in requests], decoded
    for (_, value), row in zip(requests, decoded['results']):
        assert row['exitCode'] == 0 and row['result']['status'] == 'PASS', row
        assert row['result']['png'] == value['png']
        args.row_decode_results[request_key(value)] = {'result': row['result'], 'pngSHA256': snapshots[request_key(value)]}


def decoder_result(request, args):
    record = args.row_decode_results[request_key(request)]
    assert hashlib.sha256(Path(request['png']).read_bytes()).hexdigest() == record['pngSHA256'], 'PNG changed after the bounded row decode'
    return record['result']


def main_geometry(state, case, observation, density):
    scale = density / 160
    for owner in ['target', 'reference']:
        actual = layout(state, owner)
        assert abs(actual['width'] - case['nativeLogicalDimensions'][0]) * scale <= 1
        assert abs(actual['height'] - case['nativeLogicalDimensions'][1]) * scale <= 1
        assert abs(actual['x']) * scale <= 1 and abs(actual['y'] - case['nativeMarginTop']) * scale <= 1
    for owner, native in [('parent', 'nativeParent'), ('referenceParent', 'nativeReferenceParent')]:
        actual = layout(state, owner);frame = rectangle(observation[native])
        assert abs(actual['width'] - 120) * scale <= 1 and abs(actual['height'] - 120) * scale <= 1
        assert abs(frame[2] - 120 * scale) <= 1 and abs(frame[3] - 120 * scale) <= 1
    for owner, native, key in [('target', 'nativeParent', 'rootRect'), ('reference', 'nativeReferenceParent', 'referenceRect')]:
        actual = layout(state, owner);parent = rectangle(observation[native])
        expected = [parent[0] + actual['x'] * scale, parent[1] + actual['y'] * scale, actual['width'] * scale, actual['height'] * scale]
        assert all(math.isclose(a, b, abs_tol=1e-5) for a, b in zip(observation['image'][key], expected))


def spec(index, mode='light', active=True, named=False, override=False, border=False, opacity=False, shape=None, landscape=False):
    return {'index': index, 'case': BOOK[index]['name'], 'mode': mode, 'active': active, 'named': named,
            'override': override, 'borderOverride': border, 'zeroOpacity': opacity,
            'shape': shape or ('rounded' if index == 2 else 'circle'), 'actions': 0, 'landscape': landscape}


def expectations(method):
    if method in ['light-cases', 'dark-cases']:
        mode = method.split('-')[0]
        return {mode + '-' + row['name']: spec(row['index'], mode) for row in BOOK}
    if method == 'context-naming-foreground':
        return {
            'default-before-name': spec(0), 'named-generic-view': spec(0, named=True),
            'restored-decorative-view': spec(0),
            'inactive-gray-active-lime-border': spec(1, active=False),
            'inactive-gray-explicit-blue-border': spec(1, active=False, border=True),
            'square-fractional': spec(2, active=False, border=True, shape='square'),
            'provider-and-owned-foreground': spec(0, override=True, border=True),
            'provider-restored': spec(0, border=True),
            'callback-current-inactive': spec(6, active=False, border=True),
            'callback-zero-opacity': spec(6, active=False, border=True, opacity=True),
        }
    assert method == 'window-end-reset'
    return {'window-before-zero': spec(3), 'window-after-zero': spec(3, landscape=True),
            'reset-default': spec(0, landscape=True)}


def retained_both(original, state):
    retained(original, state)
    retained(original['ownedBinding'], state['ownedBinding'])
    assert state['rootTag'] != state['ownedBinding']['rootTag']


def whole(native, viewport):
    frame = rectangle(native)
    return native['visible'] and contained(frame, viewport) and frame[1] >= viewport[1] + 2 and frame[1] + frame[3] <= viewport[1] + viewport[3] - 2


def png_path(directory, name):
    relative = Path(name)
    assert len(relative.parts) == 1 and relative.suffix == '.png'
    path = directory / relative
    assert path.resolve().is_relative_to(directory.resolve())
    raw = path.read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n' and raw[12:16] == b'IHDR'
    return path, struct.unpack('>II', raw[16:24])


def native_observation(observation, original, expected, density, directory):
    state = observation['state'];retained_both(original, state)
    for key, value in expected.items():
        if key != 'landscape':
            assert state[key] == value, (key, state[key], value)
    assert math.isclose(state['window']['scale'], density / 160, abs_tol=1e-5)
    assert state['window']['fontScale'] > 0 and math.isclose(state['window']['fontScale'], original['window']['fontScale'], abs_tol=.01)
    assert (state['window']['width'] > state['window']['height']) == expected['landscape']
    case = dict(BOOK[state['index']]);case['nativeLogicalDimensions'] = list(case['expectedLogicalSize'])
    if state['index'] == 6 and not state['active']:
        case['nativeLogicalDimensions'] = [28, 10]
    case['nativeMarginTop'] = 5 if state['index'] == 6 else 0
    case['paintComparison'] = 'absent-paint' if state['index'] in [3, 5] or state['index'] == 6 and state['zeroOpacity'] else 'center-rgba'
    main_geometry(state, case, observation, density)
    scale = density / 160;value = observation['image'];row = rectangle(observation['nativeOwnedRow'])
    assert value['ownedRowBounds'] == observation['nativeOwnedRow']['bounds']
    owned_row_layout = layout(state, 'ownedRow')
    assert abs(row[2] - owned_row_layout['width'] * scale) <= 1 and abs(row[3] - owned_row_layout['height'] * scale) <= 1
    for owner, field in [('ownedTarget', 'ownedRootRect'), ('ownedReference', 'ownedReferenceRect')]:
        actual = layout(state, owner)
        if owner == 'ownedTarget':
            assert state['layouts'][owner]['currentTarget'] == state['ownedBinding']['rootTag']
        assert abs(actual['width'] - 10) * scale <= 1 and abs(actual['height'] - 10) * scale <= 1
        derived = [row[0] + actual['x'] * scale, row[1] + actual['y'] * scale, actual['width'] * scale, actual['height'] * scale]
        assert all(math.isclose(a, b, abs_tol=1e-5) for a, b in zip(value[field], derived))
        assert contained([round_pixel(v) for v in derived], [round_pixel(v) for v in row])
    for node_key, image_key in [('nativeTarget', 'rootRect'), ('nativeReference', 'referenceRect'), ('nativeOwnedTarget', 'ownedRootRect'), ('nativeOwnedReference', 'ownedReferenceRect')]:
        target = observation[node_key]
        if target is not None and target['visible'] and all(v > 0 for v in rectangle(target)[2:]):
            assert all(abs(a - b) <= 1 for a, b in zip(rectangle(target), value[image_key]))
    windows = observation['windows'];no_anr(windows)
    viewports = [node for node in windows['windowNodes'] if node.get('id') == 'showcase-scroll']
    assert len(viewports) == 1
    viewport = rectangle(viewports[0])
    for key in ['nativeParent', 'nativeReferenceParent', 'nativeOwnedRow']:
        assert whole(observation[key], viewport), key
        assert len([node for node in windows['windowNodes'] if node.get('id') == observation[key]['id']]) == 1
    named = [node for node in windows['windowNodes'] if node.get('description') == 'G04 indicator']
    assert len(named) == int(state['named'])
    target = observation['nativeTarget']
    if state['named']:
        assert target and target['className'] == 'android.view.ViewGroup' and target['contentDescription'] == 'G04 indicator'
        assert target['rangeInfo'] is None and target['roleDescription'] in (None, '')
    if observation['name'] == 'restored-decorative-view':
        assert target and target['contentDescription'] == '' and target['focusable'] is False
    assert observation['captureStartedEpochMs'] <= windows['nativeEpochMs'] <= observation['captureFinishedEpochMs']
    for key in ['nativeParent', 'nativeReferenceParent', 'nativeOwnedRow']:
        assert observation['captureStartedEpochMs'] <= observation[key]['nativeEpochMs'] <= observation['captureFinishedEpochMs']
    png = image(observation, directory, expected['landscape'])
    return state, case, png


def round_pixel(value):
    assert math.isfinite(value) and value >= 0
    return math.floor(value + .5)


def center(rect):
    return (round_pixel(rect[0] + rect[2] / 2), round_pixel(rect[1] + rect[3] / 2))


def native_rgba(pixel):
    assert len(pixel) == 4 and all(isinstance(channel, int) and 0 <= channel <= 255 for channel in pixel)
    return pixel


def pixel_samples(png, points, args, output):
    _, size = png_path(png.parent, png.name)
    points = list(dict.fromkeys(tuple(point) for point in points))
    assert points and len(points) <= 8192
    assert all(len(p) == 2 and all(isinstance(v, int) for v in p) and 0 <= p[0] < size[0] and 0 <= p[1] < size[1] for p in points)
    result = decoder_result({'png': str(png), 'points': [list(p) for p in points]}, args)
    assert result['png'] == str(png) and (result['width'], result['height']) == size
    assert len(result['samples']) == len(points)
    decoded = {}
    for requested, sample in zip(points, result['samples']):
        assert sample['point'] == list(requested) and sample['crop'] == [*requested, 1, 1]
        decoded[requested] = native_rgba(sample['rgba'])
    return decoded


def literal_fill(state):
    if not state['active']:
        return [128, 128, 128, 255] if state['index'] in [1, 2, 7] else None
    if state['index'] == 1:
        return [0, 255, 0, 255]
    if state['index'] == 2:
        return [255, 99, 71, 255]
    if state['index'] in [0, 4]:
        return [255, 136, 0, 255] if state['override'] else [23, 23, 23, 255] if state['mode'] == 'light' else [255, 255, 255, 255]
    return None


def supplement_points(observation, state, density):
    value = observation['image'];a, b = value['ownedRootRect'], value['ownedReferenceRect']
    points = [center(a), center(b)];border_pairs = [];absence = []
    if state['index'] in [1, 2, 7]:
        # Same exact central border/fill strip at actual corresponding native roots.
        target, reference = value['rootRect'], value['referenceRect']
        for offset in range(0, math.ceil(4 * density / 160) + 1):
            pa = (center(target)[0], round_pixel(target[1]) + offset)
            pb = (center(reference)[0], round_pixel(reference[1]) + offset)
            border_pairs.append((pa, pb));points.extend([pa, pb])
    if not state['active']:
        # Actual gap between the delivered sibling rectangles is the Button background reference.
        assert a[0] + a[2] < b[0]
        background = (round_pixel((a[0] + a[2] + b[0]) / 2), center(a)[1])
        points.append(background)
        for rect in [a, b]:
            x, y, w, h = map(round_pixel, rect)
            assert w > 2 and h > 2
            for py in range(y + 1, y + h - 1):
                for px in range(x + 1, x + w - 1):
                    absence.append((px, py));points.append((px, py))
    else:
        background = None
    return points, border_pairs, absence, background


def check_supplement(observation, state, density, png, args, output):
    points, border_pairs, absence, background = supplement_points(observation, state, density)
    decoded = pixel_samples(png, points, args, output)
    a, b = center(observation['image']['ownedRootRect']), center(observation['image']['ownedReferenceRect'])
    assert decoded[a] == decoded[b], 'Actual Button child/reference center RGBA differs'
    expected = [8, 127, 140, 255] if state['override'] else [255, 255, 255, 255]
    if state['active']:
        assert decoded[a] == expected, ('Actual Button endpoint foreground', decoded[a], expected)
    else:
        assert all(decoded[p] == decoded[background] for p in absence), 'Inactive Button child/reference interior contains paint'
    # Compare solid coverage: inset one physical pixel from the outer edge and
    # omit the pixel intersecting the authored 2-point border/fill boundary.
    border_width_pixels = 2 * density / 160
    solid_border = list(range(1, math.floor(border_width_pixels))) if border_pairs else []
    solid_fill = list(range(math.ceil(border_width_pixels), len(border_pairs))) if border_pairs else []
    for offset in [*solid_border, *solid_fill] if border_pairs else []:
        pa, pb = border_pairs[offset]
        assert decoded[pa] == decoded[pb], 'Actual solid native border/fill RGBA differs from raw View'
    if border_pairs and state['index'] in [1, 2]:
        border = [0, 0, 0, 255] if state['index'] == 2 else [23, 78, 166, 255] if state['borderOverride'] else [0, 255, 0, 255]
        for offset in solid_border:
            pa, pb = border_pairs[offset]
            assert decoded[pa] == decoded[pb] == border
        if not state['active']:
            for offset in solid_fill:
                pa, pb = border_pairs[offset]
                assert decoded[pa] == decoded[pb] == [128, 128, 128, 255]
    return {'status': 'PASS', 'ownedCenterRGBA': decoded[a], 'ownedReferenceRGBA': decoded[b], 'borderPairedPixels': len(solid_border) + len(solid_fill), 'borderRequestedPairedPixels': len(border_pairs), 'solidBorderOffsets': solid_border, 'solidFillOffsets': solid_fill, 'excludedAAOffsets': [offset for offset in range(len(border_pairs)) if offset not in solid_border and offset not in solid_fill], 'inactiveInteriorPixels': len(absence), 'colorTolerance': 0}


def paint_readiness(cohort, observation, original, expected, density, directory, args, output):
    rows = [row for row in cohort.get('paintReadiness', []) if row['name'] == observation['name']]
    assert len(rows) == 1 and len(rows[0]['trials']) >= 2
    last = rows[0]['trials'][-2:]
    assert last[1]['captureStartedEpochMs'] - last[0]['captureFinishedEpochMs'] >= 100
    for index, trial in enumerate(last):
        state = trial['state'];retained_both(original, state)
        for key, value in expected.items():
            if key != 'landscape':
                assert state[key] == value
        parent = rectangle(trial['ownedRow']);scale = density / 160;points = []
        for owner, key in [('ownedTarget', 'targetPixel'), ('ownedReference', 'referencePixel')]:
            value = layout(state, owner)
            point = (round_pixel(parent[0] + (value['x'] + value['width'] / 2) * scale), round_pixel(parent[1] + (value['y'] + value['height'] / 2) * scale))
            assert list(point) == trial[key];points.append(point)
        png, _ = png_path(directory, trial['png'])
        decoded = pixel_samples(png, points, args, output.with_name(output.name + '-readiness-' + str(index)))
        assert decoded[points[0]] == trial['targetRGBA'] and decoded[points[1]] == trial['referenceRGBA']
        assert decoded[points[0]] == decoded[points[1]]
        if state['active']:
            assert decoded[points[0]] == ([8, 127, 140, 255] if state['override'] else [255, 255, 255, 255])
        assert trial['captureStartedEpochMs'] <= trial['captureFinishedEpochMs']


def baseline_context(args):
    value = json.loads(args.profile_context.read_text());assert value['profile'] == 'IndicatorG04' and value['fontWritePerformed'] is False
    for phase in ['before', 'after']:
        for field in ['Font', 'Pid', 'Activity', 'Events']:
            assert Path(value[phase + field + 'File']).is_file()
    assert 'dev.codonui.showcase' in Path(value['afterActivityFile']).read_text()
    return {'rawContext': str(args.profile_context), 'fontWritePerformed': False,
            'beforeFontSetting': Path(value['beforeFontFile']).read_text().strip(), 'afterFontSetting': Path(value['afterFontFile']).read_text().strip(),
            'pidBefore': Path(value['beforePidFile']).read_text().strip().split(), 'pidAfter': Path(value['afterPidFile']).read_text().strip().split(),
            'scope': 'Actual baseline context; no PID-only Activity-recreation or font-lifetime claim'}


def host_checks(cohort, original, directory, output, density, args):
    output.mkdir();errors = [];observed = [];manual = [];expected = expectations(cohort['name'])
    try:
        assert cohort['status'] == 'NATIVE_ASSERTIONS_PASSED_PENDING_COLOR_AND_ROOT_REVIEW', cohort.get('error', cohort['status'])
        assert 0 <= cohort['elapsedMs'] <= 180000
        assert [row['name'] for row in cohort.get('observations', [])] == list(expected)
    except Exception as error:
        errors.append({'phase': 'native-cohort-or-observation-set', 'error': repr(error)})
    for observation in cohort.get('observations', []):
        try:
            state, case, png = native_observation(observation, original, expected[observation['name']], density, directory)
            value = observation['image']
            target_layout, reference_layout = layout(state, 'target'), layout(state, 'reference')
            request = style_request(observation, density, png, target_layout, reference_layout)
            prepare_row_decode(cohort, observation, state, request, density, png, directory, args, output / (observation['name'] + '-decode-batch'))
            result = decoder_result(request, args)
            literal = literal_fill(state)
            if literal is not None and case['paintComparison'] == 'center-rgba':
                assert result['chosenReferenceCenterRGBA'] == literal
            supplement = check_supplement(observation, state, density, png, args, output / (observation['name'] + '-pixels'))
            paint_readiness(cohort, observation, original, expected[observation['name']], density, directory, args, output / observation['name'])
            observed.append({'name': observation['name'], 'nativeGeometryBindingSemantics': 'PASS', 'nativeColorOrAbsence': result, 'ownedAndBorderPixels': supplement})
            manual.append({'name': observation['name'], 'png': str(png), 'predicate': 'Original native paired edge/radius/opacity review remains; exact center/border/absence checks do not invent geometric or color tolerance.'})
        except Exception as error:
            errors.append({'phase': 'observation', 'name': observation.get('name'), 'error': repr(error)})
    if cohort['name'] == 'window-end-reset':
        try:
            transition = cohort['windowTransition'];before, after = transition['before'], transition['after']
            retained_both(original, before);retained_both(before, after)
            assert transition['accepted'] is True and transition['requestedRotation'] == 1
            assert before['window']['height'] > before['window']['width'] and after['window']['width'] > after['window']['height']
            for key in ['index', 'case', 'active', 'shape', 'named', 'override', 'borderOverride', 'zeroOpacity', 'actions']:
                assert before[key] == after[key]
            assert before['index'] == 3 and before['case'] == 'zero' and before['actions'] == 0
            reach = cohort['endReachability'];a, b = reach['before'], reach['after'];retained_both(original, a);retained_both(a, b)
            assert a['index'] == b['index'] == 3 and a['actions'] == 0 and b['actions'] == 1
            no_anr(reach['windows']);viewport = rectangle(reach['scroll'])
            assert whole(reach['end'], viewport) and whole(reach['action'], viewport)
            assert 'A long English indicator description' in reach['copyText'] and 'description française' in reach['copyText']
            for name in [reach['copyPNG'], reach['png']]:
                png_path(directory, name)
            tail = reach['tail'];no_anr(tail['windows']);retained_both(b, tail['state'])
            assert tail['text'].startswith('Long descriptive copy:') and whole(tail['node'], rectangle(tail['scroll']))
            assert tail['actualBottomReached'] is True and tail['steps'] and tail['steps'][-1]['accepted'] is False
            assert all(row['accepted'] is True for row in tail['steps'][:-1])
            for key in ['index', 'case', 'active', 'shape', 'named', 'override', 'borderOverride', 'zeroOpacity', 'actions']:
                assert tail['state'][key] == b[key]
            png_path(directory, tail['png'])
            actions = cohort['actions'];finals = [i for i, row in enumerate(actions) if row.get('label') == 'G04 IND final action' and row.get('accepted') is True]
            resets = [i for i, row in enumerate(actions) if row.get('label') == 'G04 prepare Indicator' and row.get('accepted') is True]
            assert len(finals) == 1 and len(resets) == 2 and finals[0] < resets[-1]
            reset = cohort['reset'];retained_both(original, reset['before']);retained_both(original, reset['after'])
            assert reset['before']['index'] == 3 and reset['before']['actions'] == 1
            for key, value in spec(0, landscape=True).items():
                if key != 'landscape':
                    assert reset['after'][key] == value
            manual.extend([{'name': 'copy', 'png': str(directory / reach['copyPNG'])}, {'name': 'end', 'png': str(directory / reach['png'])}, {'name': 'actual-tail', 'png': str(directory / tail['png'])}])
        except Exception as error:
            errors.append({'phase': 'window-end-reset', 'error': repr(error)})
    return {'cohort': cohort['name'], 'status': 'AUTOMATED_PROFILE_SCOPED_CHECKS_PASSED_PENDING_ROOT_REVIEW' if not errors else 'FAILED_OR_INCOMPLETE', 'errors': errors, 'observations': observed, 'manualVisualReview': manual}


def main(args):
    admission = None
    if getattr(args, 'cell', None):
        from NativeCellVerification import load_admission
        admission = load_admission(__file__, args.cell, {'ios': [], 'android': []})
    args.out.mkdir(exist_ok=False);verdicts = [];errors = [];data = {};context = {}
    try:
        assert args.profile == 'IndicatorG04'
        assert hashlib.sha256(args.color_oracle.read_bytes()).hexdigest() == args.expected_color_oracle_sha256
        data = json.loads((args.input / 'receipt.json').read_text())
        assert data['operation'] == 'indicator-g04-batch' and data['profile'] == args.profile
        assert data['selectedMethods'] == METHODS and data['selectedMethodCount'] == 4 and [row['name'] for row in data['cohorts']] == METHODS
        assert data['epochStartedMs'] <= data['epochFinishedMs'] and data['methodLimitMs'] == 180000 and data['batchLimitMs'] == 780000
        context = baseline_context(args)
        if data['status'] != 'NATIVE_PROFILE_COMPLETE_PENDING_HOST_COLOR' or data['nativeActionSucceeded'] is not True or data.get('hasFailedCohorts') is not False:
            errors.append('Native batch has failed/unsafe/incomplete outcomes; individual cohorts still preserved')
        if data.get('nativeRestoration', {}).get('rotationUnfreezeAccepted') is not True or data.get('nativeRestoration', {}).get('error'):
            errors.append('Native rotation restoration failed/uncertain')
        densities = re.findall(r'(?:Override|Physical) density:\s*(\d+)', args.density.read_text());assert densities and int(densities[-1]) > 0
        original = data['cohorts'][0]['prepared']
        for cohort in data['cohorts']:
            verdicts.append(host_checks(cohort, original, args.input, args.out / cohort['name'], int(densities[-1]), args))
    except BaseException as error:
        errors.append(repr(error))
        for name in METHODS:
            if name not in [row['cohort'] for row in verdicts]:
                verdicts.append({'cohort': name, 'status': 'FAILED_OR_INCOMPLETE', 'errors': [{'phase': 'batch-or-transport', 'error': repr(error)}]})
    passed = not errors and len(verdicts) == 4 and all(row['status'] == 'AUTOMATED_PROFILE_SCOPED_CHECKS_PASSED_PENDING_ROOT_REVIEW' for row in verdicts)
    terminal = {'cell': 'CAT.indicator.G04', 'profile': args.profile, 'status': 'INDICATOR_BATCH_PENDING_ROOT_REVIEW' if passed else 'FAILED_OR_INCOMPLETE', 'batchErrors': errors, 'cohorts': verdicts, 'ledgerPromotion': False, 'profileSettingContext': context, 'nativeReceiptSHA256': hashlib.sha256((args.input / 'receipt.json').read_bytes()).hexdigest() if (args.input / 'receipt.json').exists() else None, 'finishedEpoch': time.time()}
    if admission is not None:
        terminal.update(cell=args.cell, sourceEvidenceCell='CAT.indicator.G04', nativeCellAdmission=admission, scope='Saved installed observations replay; no guest, installation or new component observation')
    (args.out / 'terminal.json').write_text(json.dumps(terminal, indent=2) + '\n');print(json.dumps({'status': terminal['status']}), flush=True)
    return 0 if passed else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cell', choices=['CAT.indicator.G07'])
    parser.add_argument('--input', type=Path, required=True);parser.add_argument('--out', type=Path, required=True);parser.add_argument('--density', type=Path, required=True)
    parser.add_argument('--color-oracle', type=Path, required=True);parser.add_argument('--expected-color-oracle-sha256', required=True);parser.add_argument('--deadline-unix', type=float, required=True)
    parser.add_argument('--profile', choices=['IndicatorG04'], required=True);parser.add_argument('--profile-context', type=Path, required=True)
    args = parser.parse_args()
    def interrupted(signum, _frame):
        raise HostStop('Owner signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted);signal.signal(signal.SIGINT, interrupted)
    raise SystemExit(main(args))

