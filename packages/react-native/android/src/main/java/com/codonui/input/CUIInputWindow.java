package com.codonui.input;

import android.view.KeyEvent;
import android.view.View;
import java.util.WeakHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

final class CUIInputWindow {
  private static final WeakHashMap<View, State> states = new WeakHashMap<>();
  private static final AtomicLong identities = new AtomicLong();

  private static final class State {
    final String identity = "native-window-" + identities.incrementAndGet();
    String modality = "unknown";
    long policyOrder;
    int pointerDispatches;
    final WeakHashMap<CUIKeyboardScope, Boolean> scopes = new WeakHashMap<>();
  }

  private static State state(View view) {
    View root = view.getRootView();
    State value = states.get(root);
    if (value == null) { value = new State(); states.put(root, value); }
    return value;
  }

  static String identity(View view) { return state(view).identity; }
  static String modality(View view) { return state(view).modality; }
  static void record(View view, String origin) { state(view).modality = origin; }
  static void register(CUIKeyboardScope scope) { state(scope).scopes.put(scope, Boolean.TRUE); }
  static void unregister(View root, CUIKeyboardScope scope) { State value = states.get(root); if (value != null) value.scopes.remove(scope); }
  static List<CUIKeyboardScope> scopes(View view) { return new ArrayList<>(state(view).scopes.keySet()); }
  static long nextPolicyOrder(View view) { return ++state(view).policyOrder; }
  static void beginPointer(View view) { state(view).pointerDispatches++; }
  static void endPointer(View view) { State value = state(view); value.pointerDispatches = Math.max(0, value.pointerDispatches - 1); }
  static boolean dispatchingPointer(View view) { return state(view).pointerDispatches > 0; }

  static String keyName(KeyEvent event) {
    switch (event.getKeyCode()) {
      case KeyEvent.KEYCODE_ENTER:
      case KeyEvent.KEYCODE_NUMPAD_ENTER: return "Enter";
      case KeyEvent.KEYCODE_ESCAPE: return "Escape";
      case KeyEvent.KEYCODE_TAB: return "Tab";
      case KeyEvent.KEYCODE_DEL: return "Backspace";
      case KeyEvent.KEYCODE_FORWARD_DEL: return "Delete";
      case KeyEvent.KEYCODE_DPAD_RIGHT: return "ArrowRight";
      case KeyEvent.KEYCODE_DPAD_LEFT: return "ArrowLeft";
      case KeyEvent.KEYCODE_DPAD_DOWN: return "ArrowDown";
      case KeyEvent.KEYCODE_DPAD_UP: return "ArrowUp";
      case KeyEvent.KEYCODE_MOVE_HOME: return "Home";
      case KeyEvent.KEYCODE_MOVE_END: return "End";
      case KeyEvent.KEYCODE_PAGE_UP: return "PageUp";
      case KeyEvent.KEYCODE_PAGE_DOWN: return "PageDown";
      case KeyEvent.KEYCODE_SPACE: return " ";
      case KeyEvent.KEYCODE_SHIFT_LEFT:
      case KeyEvent.KEYCODE_SHIFT_RIGHT: return "Shift";
      case KeyEvent.KEYCODE_CTRL_LEFT:
      case KeyEvent.KEYCODE_CTRL_RIGHT: return "Control";
      case KeyEvent.KEYCODE_ALT_LEFT:
      case KeyEvent.KEYCODE_ALT_RIGHT: return "Alt";
      case KeyEvent.KEYCODE_META_LEFT:
      case KeyEvent.KEYCODE_META_RIGHT: return "Meta";
      case KeyEvent.KEYCODE_CAPS_LOCK: return "CapsLock";
      default:
        int unicode = event.getUnicodeChar();
        if (unicode != 0 && Character.isValidCodePoint(unicode)) return new String(Character.toChars(unicode));
        if (event.getKeyCode() >= KeyEvent.KEYCODE_F1 && event.getKeyCode() <= KeyEvent.KEYCODE_F12) return "F" + (event.getKeyCode() - KeyEvent.KEYCODE_F1 + 1);
        return "Unidentified";
    }
  }

  static String keyToken(KeyEvent event) {
    return (event.isShiftPressed() ? "1" : "0") + (event.isAltPressed() ? "1" : "0")
        + (event.isCtrlPressed() ? "1" : "0") + (event.isMetaPressed() ? "1" : "0") + ":" + keyName(event);
  }
}
