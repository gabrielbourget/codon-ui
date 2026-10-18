package com.codonui.input;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUIFocusViewManagerDelegate;
import com.facebook.react.viewmanagers.CUIFocusViewManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

@ReactModule(name = CUIFocusViewManager.NAME)
public final class CUIFocusViewManager extends ReactViewManager implements CUIFocusViewManagerInterface<ReactViewGroup> {
  static final String NAME = "CUIFocusView";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUIFocusViewManagerDelegate<ReactViewGroup, CUIFocusViewManager> delegate = new CUIFocusViewManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("ownerId".equals(name) || "keyboardFocusable".equals(name) || "capturedKeys".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };

  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIFocusView(context); }

  @Override @ReactProp(name = "ownerId")
  public void setOwnerId(ReactViewGroup view, String value) { ((CUIFocusView) view).setOwnerId(value); }

  @Override @ReactProp(name = "keyboardFocusable", defaultBoolean = true)
  public void setKeyboardFocusable(ReactViewGroup view, boolean value) { ((CUIFocusView) view).setKeyboardFocusable(value); }

  @Override @ReactProp(name = "capturedKeys")
  public void setCapturedKeys(ReactViewGroup view, ReadableArray value) {
    Set<String> keys = new HashSet<>();
    if (value != null) for (int index = 0; index < value.size(); index++) keys.add(value.getString(index));
    ((CUIFocusView) view).setCapturedKeys(keys);
  }

  @Override public void requestKeyboardFocus(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).requestKeyboardFocus(ownerId); }
  @Override public void requestKeyboardBlur(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).requestKeyboardBlur(ownerId); }

  @Override public void receiveCommand(ReactViewGroup view, String command, ReadableArray args) {
    if ("requestKeyboardFocus".equals(command) || "requestKeyboardBlur".equals(command)) delegate.receiveCommand(view, command, args);
    else super.receiveCommand(view, command, args);
  }

  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>();
    Map<String, Object> inherited = super.getExportedCustomDirectEventTypeConstants();
    if (inherited != null) events.putAll(inherited);
    events.put("topNativeKey", Collections.singletonMap("registrationName", "onNativeKey"));
    events.put("topNativeFocusChange", Collections.singletonMap("registrationName", "onNativeFocusChange"));
    return events;
  }

  @Override public void onDropViewInstance(ReactViewGroup view) {
    ((CUIFocusView) view).cancelHeldKeys();
    super.onDropViewInstance(view);
  }
}
