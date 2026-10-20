"""Compile both owned physical-code tables and compare SDK/HID reference vectors.

References: https://www.w3.org/TR/uievents-code/ and the locked SDK's public
UIKeyboardHIDUsage / KeyEvent constants. This does not inject native key events.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile


def verify(args):
    repo = Path(__file__).resolve().parents[4]
    vectors = [(4 + i, letter, 'Key' + letter, 0) for i, letter in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')]
    vectors += [(30 + i, digit, 'Digit' + digit, 0) for i, digit in enumerate('1234567890')]
    vectors += [(58 + i if i < 12 else 104 + i - 12, 'F' + str(i + 1), 'F' + str(i + 1), 0) for i in range(24)]
    vectors += [(89 + i if i < 9 else 98, 'NUMPAD_' + digit, 'Numpad' + digit, 3) for i, digit in enumerate('1234567890')]
    vectors += [
        (40, 'ENTER', 'Enter', 0), (41, 'ESCAPE', 'Escape', 0),
        (42, 'DEL', 'Backspace', 0), (43, 'TAB', 'Tab', 0), (44, 'SPACE', 'Space', 0),
        (45, 'MINUS', 'Minus', 0), (46, 'EQUALS', 'Equal', 0),
        (47, 'LEFT_BRACKET', 'BracketLeft', 0), (48, 'RIGHT_BRACKET', 'BracketRight', 0),
        (49, 'BACKSLASH', 'Backslash', 0), (51, 'SEMICOLON', 'Semicolon', 0),
        (52, 'APOSTROPHE', 'Quote', 0), (53, 'GRAVE', 'Backquote', 0),
        (54, 'COMMA', 'Comma', 0), (55, 'PERIOD', 'Period', 0), (56, 'SLASH', 'Slash', 0),
        (57, 'CAPS_LOCK', 'CapsLock', 0), (70, 'SYSRQ', 'PrintScreen', 0),
        (71, 'SCROLL_LOCK', 'ScrollLock', 0), (72, 'BREAK', 'Pause', 0),
        (73, 'INSERT', 'Insert', 0), (74, 'MOVE_HOME', 'Home', 0), (75, 'PAGE_UP', 'PageUp', 0),
        (76, 'FORWARD_DEL', 'Delete', 0), (77, 'MOVE_END', 'End', 0), (78, 'PAGE_DOWN', 'PageDown', 0),
        (79, 'DPAD_RIGHT', 'ArrowRight', 0), (80, 'DPAD_LEFT', 'ArrowLeft', 0),
        (81, 'DPAD_DOWN', 'ArrowDown', 0), (82, 'DPAD_UP', 'ArrowUp', 0),
        (83, 'NUM_LOCK', 'NumLock', 3), (84, 'NUMPAD_DIVIDE', 'NumpadDivide', 3),
        (85, 'NUMPAD_MULTIPLY', 'NumpadMultiply', 3), (86, 'NUMPAD_SUBTRACT', 'NumpadSubtract', 3),
        (87, 'NUMPAD_ADD', 'NumpadAdd', 3), (88, 'NUMPAD_ENTER', 'NumpadEnter', 3),
        (99, 'NUMPAD_DOT', 'NumpadDecimal', 3), (101, 'MENU', 'ContextMenu', 0),
        (102, 'POWER', 'Power', 0), (103, 'NUMPAD_EQUALS', 'NumpadEqual', 3),
        (117, 'HELP', 'Help', 0), (123, 'CUT', 'Cut', 0), (124, 'COPY', 'Copy', 0),
        (125, 'PASTE', 'Paste', 0), (127, 'VOLUME_MUTE', 'AudioVolumeMute', 0),
        (128, 'VOLUME_UP', 'AudioVolumeUp', 0), (129, 'VOLUME_DOWN', 'AudioVolumeDown', 0),
        (133, 'NUMPAD_COMMA', 'NumpadComma', 3), (135, 'RO', 'IntlRo', 0),
        (136, 'KATAKANA_HIRAGANA', 'KanaMode', 0), (137, 'YEN', 'IntlYen', 0),
        (138, 'HENKAN', 'Convert', 0), (139, 'MUHENKAN', 'NonConvert', 0),
        (145, 'EISU', 'Lang2', 0), (182, 'NUMPAD_LEFT_PAREN', 'NumpadParenLeft', 3),
        (183, 'NUMPAD_RIGHT_PAREN', 'NumpadParenRight', 3),
        (224, 'CTRL_LEFT', 'ControlLeft', 1), (225, 'SHIFT_LEFT', 'ShiftLeft', 1),
        (226, 'ALT_LEFT', 'AltLeft', 1), (227, 'META_LEFT', 'MetaLeft', 1),
        (228, 'CTRL_RIGHT', 'ControlRight', 2), (229, 'SHIFT_RIGHT', 'ShiftRight', 2),
        (230, 'ALT_RIGHT', 'AltRight', 2), (231, 'META_RIGHT', 'MetaRight', 2),
        (0, 'UNKNOWN', 'Unidentified', 0), (65535, None, 'Unidentified', 0),
    ]
    ios_vectors = [(usage, code, location) for usage, _, code, location in vectors] + [
        (50, 'Backslash', 0), (100, 'IntlBackslash', 0), (116, 'Open', 0),
        (119, 'Select', 0), (121, 'Again', 0), (122, 'Undo', 0), (126, 'Find', 0),
        (144, 'Lang1', 0), (146, 'Lang3', 0), (147, 'Lang4', 0), (148, 'Lang5', 0),
        (155, 'Abort', 0), (163, 'Props', 0), (187, 'NumpadBackspace', 3),
    ]
    android_vectors = [(name, code, location) for _, name, code, location in vectors] + [
        (name, code, 0) for name, code in [
            ('MEDIA_PLAY', 'MediaPlay'), ('MEDIA_PAUSE', 'MediaPause'),
            ('MEDIA_PLAY_PAUSE', 'MediaPlayPause'), ('MEDIA_STOP', 'MediaStop'),
            ('MEDIA_NEXT', 'MediaTrackNext'), ('MEDIA_PREVIOUS', 'MediaTrackPrevious'),
            ('MEDIA_REWIND', 'MediaRewind'), ('MEDIA_FAST_FORWARD', 'MediaFastForward'),
            ('SEARCH', 'BrowserSearch'), ('BACK', 'BrowserBack'), ('FORWARD', 'BrowserForward'),
            ('REFRESH', 'BrowserRefresh'), ('BOOKMARK', 'BrowserFavorites'),
            ('ZENKAKU_HANKAKU', 'Lang5'), ('KANA', 'Lang1'), ('SLEEP', 'Sleep'), ('WAKEUP', 'WakeUp'),
            ('MEDIA_EJECT', 'Eject'), ('CALCULATOR', 'LaunchApp2'), ('ENVELOPE', 'LaunchMail'),
            ('MUSIC', 'MediaSelect'), ('FUNCTION', 'Fn'), ('EXPLORER', 'Unidentified'),
            ('LANGUAGE_SWITCH', 'Unidentified'),
        ]
    ]
    with tempfile.TemporaryDirectory(prefix='codon-toaster-physical-') as temporary:
        root = Path(temporary)
        cpp = root / 'physical.cpp'
        cpp.write_text('#include <cstdio>\n#include "CUIPhysicalKey.h"\nint main() {\n' + ''.join(
            f'printf("%s\\t%d\\n", CUIPhysicalKeyCode({usage}), CUIPhysicalKeyLocation({usage}));\n' for usage, _, _ in ios_vectors
        ) + '}\n')
        subprocess.run([args.cxx, '-I' + str(repo / 'packages/react-native/ios'), str(cpp), '-o', str(root / 'physical')], check=True, timeout=30)
        ios = subprocess.check_output([str(root / 'physical')], text=True, timeout=10).splitlines()
        java = root / 'PhysicalProbe.java'
        java.write_text('package com.codonui.input;\nimport android.view.KeyEvent;\nclass PhysicalProbe { public static void main(String[] args) {\n' + ''.join(
            f'System.out.println(CUIPhysicalKey.code({("KeyEvent.KEYCODE_" + name) if name else "65535"}) + "\\t" + CUIPhysicalKey.location({("KeyEvent.KEYCODE_" + name) if name else "65535"}));\n' for name, _, _ in android_vectors
        ) + '} }\n')
        subprocess.run([args.javac, '-cp', args.android_jar, '-d', str(root), str(java), str(repo / 'packages/react-native/android/src/main/java/com/codonui/input/CUIPhysicalKey.java')], check=True, timeout=30)
        android = subprocess.check_output([args.java, '-cp', str(root), 'com.codonui.input.PhysicalProbe'], text=True, timeout=10).splitlines()
        for platform, actual, reference_vectors in [('ios', ios, ios_vectors), ('android', android, android_vectors)]:
            expected = [f'{code}\t{location}' for _, code, location in reference_vectors]
            assert len(actual) == len(expected)
            for vector, result, reference in zip(reference_vectors, actual, expected):
                assert result == reference, (platform, vector, result, reference)
    receipt = {'vectorsPerPlatform': {'ios': len(ios_vectors), 'android': len(android_vectors)}, 'platforms': ['ios', 'android'], 'compiledTables': True, 'installedActions': 0}
    Path(args.output).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['cxx', 'javac', 'java', 'android-jar', 'output']:
        parser.add_argument('--' + name, required=True)
    verify(parser.parse_args())
