package com.codonui.input;

import android.graphics.Rect;
import android.os.SystemClock;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ViewGroupClickEvent;
import java.util.HashSet;
import java.util.Set;

public final class CUIFocusView extends ReactViewGroup implements View.OnClickListener {
  private final SparseArray<KeyEvent> held = new SparseArray<>();
  private final Set<Integer> consumed = new HashSet<>();
  private Set<String> capturedKeys = new HashSet<>();
  private String ownerId = "";
  private String origin = "unknown";
  private boolean keyboardFocusable = true;
  private boolean nativePressable = false;

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
    synchronizeKeyboardFocusability();
  }

  void setNativePressable(boolean enabled) {
    if (nativePressable && !enabled) {
      setOnClickListener(null);
      setClickable(false);
    }
    nativePressable = enabled;
  }
  boolean isNativePressable() { return nativePressable; }

  void synchronizeNativeClick() {
    setOnClickListener(this);
    setClickable(true);
  }

  @Override public void onClick(View view) {
    if (!nativePressable || !isAttachedToWindow() || !isShown()) return;
    ThemedReactContext context = (ThemedReactContext) getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new ViewGroupClickEvent(UIManagerHelper.getSurfaceId(this), getId()));
  }

  void synchronizeKeyboardFocusability() {
    setFocusable(keyboardFocusable);
    setFocusableInTouchMode(keyboardFocusable);
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
    data.putString("key", CUIInputWindow.keyName(event));
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
      if (held.get(code) == null) handled = capturedKeys.contains(CUIInputWindow.keyToken(event));
      held.put(code, new KeyEvent(event));
      if (handled) consumed.add(code);
    }
    origin = "keyboard";
    CUIInputWindow.record(this, "keyboard");
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
    data.putString("origin", origin.equals("programmatic") ? origin : CUIInputWindow.modality(this));
    boolean nativeNonTouchFocus = !isInTouchMode() && !CUIInputWindow.dispatchingPointer(this) && !origin.equals("programmatic");
    data.putBoolean("isFocusVisible", focused && hasWindowFocus() && (CUIInputWindow.modality(this).equals("keyboard") || nativeNonTouchFocus));
    data.putDouble("timestamp", SystemClock.uptimeMillis());
    emit("topNativeFocusChange", data);
    if (!ReactNativeFeatureFlags.enableImperativeFocus()) {
      WritableMap bubbled = Arguments.createMap(); bubbled.putInt("target", getId());
      emit(focused ? "topFocus" : "topBlur", bubbled);
    }
    if (!focused) origin = "unknown";
  }

  @Override
  public boolean onTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN) { origin = "pointer"; CUIInputWindow.record(this, "pointer"); }
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
