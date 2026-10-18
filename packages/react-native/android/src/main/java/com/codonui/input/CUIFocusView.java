package com.codonui.input;

import android.graphics.Rect;
import android.os.SystemClock;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.MotionEvent;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.HashSet;
import java.util.Set;

public final class CUIFocusView extends ReactViewGroup {
  private final SparseArray<KeyEvent> held = new SparseArray<>();
  private final Set<Integer> consumed = new HashSet<>();
  private Set<String> capturedKeys = new HashSet<>();
  private String ownerId = "";
  private String origin = "unknown";
  private boolean keyboardFocusable = true;

  public CUIFocusView(ThemedReactContext context) {
    super(context);
    setFocusable(true);
    setFocusableInTouchMode(true);
  }

  void setOwnerId(String next) {
    if (next == null) next = "";
    if (!ownerId.equals(next)) cancelHeldKeys();
    ownerId = next;
  }

  void setKeyboardFocusable(boolean enabled) {
    keyboardFocusable = enabled;
    if (!enabled) {
      cancelHeldKeys();
      clearFocus();
    }
    setFocusable(enabled);
    setFocusableInTouchMode(enabled);
  }

  void setCapturedKeys(Set<String> next) {
    if (!capturedKeys.equals(next)) cancelHeldKeys();
    capturedKeys = next;
  }

  void requestKeyboardFocus(String owner) {
    if (!ownerId.equals(owner) || !keyboardFocusable || !isAttachedToWindow() || !isShown()) return;
    origin = "programmatic";
    requestFocus();
  }

  void requestKeyboardBlur(String owner) {
    if (ownerId.equals(owner)) clearFocus();
  }

  private static String keyName(KeyEvent event) {
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
        if (event.getKeyCode() >= KeyEvent.KEYCODE_F1 && event.getKeyCode() <= KeyEvent.KEYCODE_F12) {
          return "F" + (event.getKeyCode() - KeyEvent.KEYCODE_F1 + 1);
        }
        return "Unidentified";
    }
  }

  private static String captureToken(KeyEvent event) {
    return (event.isShiftPressed() ? "1" : "0") + (event.isAltPressed() ? "1" : "0")
        + (event.isCtrlPressed() ? "1" : "0") + (event.isMetaPressed() ? "1" : "0") + ":" + keyName(event);
  }

  private WritableMap baseData() {
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId);
    data.putInt("target", getId());
    return data;
  }

  private void emit(String name, WritableMap data) {
    ThemedReactContext context = (ThemedReactContext) getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new InputEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data));
  }

  private void emitKey(KeyEvent event, boolean down, boolean cancelled, boolean handled) {
    WritableMap data = baseData();
    data.putString("kind", "keyboard");
    data.putString("key", keyName(event));
    data.putInt("nativeCode", event.getKeyCode());
    int unicode = event.getUnicodeChar();
    String characters = event.getCharacters();
    if (characters == null) characters = unicode != 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
    data.putString("characters", characters);
    data.putString("phase", down ? "down" : "up");
    data.putBoolean("repeat", down && event.getRepeatCount() > 0);
    data.putBoolean("cancelled", cancelled);
    data.putBoolean("shiftKey", event.isShiftPressed());
    data.putBoolean("altKey", event.isAltPressed());
    data.putBoolean("ctrlKey", event.isCtrlPressed());
    data.putBoolean("metaKey", event.isMetaPressed());
    data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState()));
    data.putBoolean("nativeDefaultHandled", handled);
    data.putDouble("timestamp", cancelled ? SystemClock.uptimeMillis() : event.getEventTime());
    emit("topNativeKey", data);
  }

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (!keyboardFocusable || !isFocused() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) {
      return super.dispatchKeyEvent(event);
    }
    int code = event.getKeyCode();
    boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
    boolean handled = consumed.contains(code);
    if (down) {
      if (held.get(code) == null) handled = capturedKeys.contains(captureToken(event));
      held.put(code, new KeyEvent(event));
      if (handled) consumed.add(code);
    }
    origin = "keyboard";
    emitKey(event, down, event.isCanceled(), handled);
    if (!down) {
      held.remove(code);
      consumed.remove(code);
    }
    return handled || super.dispatchKeyEvent(event);
  }

  void cancelHeldKeys() {
    for (int index = 0; index < held.size(); index++) {
      int code = held.keyAt(index);
      emitKey(held.valueAt(index), false, true, consumed.contains(code));
    }
    held.clear();
    consumed.clear();
  }

  @Override
  protected void onFocusChanged(boolean focused, int direction, Rect previous) {
    super.onFocusChanged(focused, direction, previous);
    if (!focused) cancelHeldKeys();
    WritableMap data = baseData();
    data.putBoolean("isFocused", focused);
    data.putString("origin", origin);
    data.putDouble("timestamp", SystemClock.uptimeMillis());
    emit("topNativeFocusChange", data);
    if (!focused) origin = "unknown";
  }

  @Override
  public boolean onTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN) origin = "pointer";
    return super.onTouchEvent(event);
  }

  @Override
  protected void onDetachedFromWindow() {
    cancelHeldKeys();
    clearFocus();
    origin = "unknown";
    super.onDetachedFromWindow();
  }

  @Override
  public void onWindowFocusChanged(boolean focused) {
    if (!focused) cancelHeldKeys();
    super.onWindowFocusChanged(focused);
  }

  private static final class InputEvent extends Event<InputEvent> {
    private final String name;
    private final WritableMap data;

    InputEvent(int surface, int tag, String name, WritableMap data) {
      super(surface, tag);
      this.name = name;
      this.data = data;
    }

    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
