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
import java.util.ArrayList;
import java.util.List;
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
      if ("ownerId".equals(name) || "keyboardFocusable".equals(name) || "nativePressable".equals(name) || "nativeMotionGeometryBinding".equals(name) || "nativeMotionGeometryRevision".equals(name) || "nativeMotionColorObservation".equals(name) || "nativeNavigation".equals(name) || "nativeNavigationLabel".equals(name) || "capturedKeys".equals(name) || "nativeLabelledBy".equals(name) || "nativeDescribedBy".equals(name) || "nativeDetailsBy".equals(name) || "nativeDescriptionTag".equals(name) || "nativeDescriptionLabel".equals(name) || "nativeDetailsLabel".equals(name) || "nativeScrollAnchorTag".equals(name) || "nativeScrollAnchorKey".equals(name) || "nativeScrollAnchorRevision".equals(name)) super.setProperty(view, name, value);
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

  @Override @ReactProp(name = "nativePressable", defaultBoolean = false)
  public void setNativePressable(ReactViewGroup view, boolean value) { ((CUIFocusView) view).setNativePressable(value); }

  @Override @ReactProp(name = "nativeMotionGeometryBinding")
  public void setNativeMotionGeometryBinding(ReactViewGroup view, String value) { ((CUIFocusView)view).setNativeMotionGeometryBinding(value); }
  @Override @ReactProp(name = "nativeMotionGeometryRevision")
  public void setNativeMotionGeometryRevision(ReactViewGroup view, String value) { ((CUIFocusView)view).setNativeMotionGeometryRevision(value); }

  @Override @ReactProp(name = "nativeMotionColorObservation", defaultBoolean = false)
  public void setNativeMotionColorObservation(ReactViewGroup view, boolean enabled) { ((CUIFocusView) view).setNativeMotionColorObservation(enabled); }

  @Override @ReactProp(name = "nativeNavigation", defaultBoolean = false)
  public void setNativeNavigation(ReactViewGroup view, boolean value) { ((CUIFocusView) view).setNativeNavigation(value); }

  @Override @ReactProp(name = "nativeNavigationLabel")
  public void setNativeNavigationLabel(ReactViewGroup view, String value) { ((CUIFocusView) view).setNativeNavigationLabel(value); }

  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) {
    super.onAfterUpdateTransaction(view);
    // Keep native activation independent of keyboard focus eligibility.
    if (((CUIFocusView) view).isNativePressable()) ((CUIFocusView) view).synchronizeNativeClick();
    ((CUIFocusView) view).synchronizeKeyboardFocusability();
    ((CUIFocusView) view).prepareScrollAnchor();
    ((CUIFocusView) view).synchronizeMotionColors();
    ((CUIFocusView) view).synchronizeMotionGeometry();
  }

  @Override @ReactProp(name = "capturedKeys")
  public void setCapturedKeys(ReactViewGroup view, ReadableArray value) {
    Set<String> keys = new HashSet<>();
    if (value != null) for (int index = 0; index < value.size(); index++) keys.add(value.getString(index));
    ((CUIFocusView) view).setCapturedKeys(keys);
  }

  private static List<String> strings(ReadableArray value) {
    List<String> ids = new ArrayList<>();
    if (value != null) for (int i = 0; i < value.size(); i++) ids.add(value.getString(i));
    return ids;
  }
  @Override @ReactProp(name = "nativeLabelledBy")
  public void setNativeLabelledBy(ReactViewGroup view, ReadableArray value) { ((CUIFocusView) view).setNativeLabelledBy(strings(value)); }
  @Override @ReactProp(name = "nativeDescribedBy")
  public void setNativeDescribedBy(ReactViewGroup view, ReadableArray value) { ((CUIFocusView) view).setNativeDescribedBy(strings(value)); }
  @Override @ReactProp(name = "nativeDetailsBy")
  public void setNativeDetailsBy(ReactViewGroup view, ReadableArray value) { ((CUIFocusView) view).setNativeDetailsBy(strings(value)); }
  @Override @ReactProp(name = "nativeDescriptionTag", defaultInt = 0)
  public void setNativeDescriptionTag(ReactViewGroup view, int value) { ((CUIFocusView) view).setNativeDescriptionTag(value); }
  @Override @ReactProp(name = "nativeDescriptionLabel")
  public void setNativeDescriptionLabel(ReactViewGroup view, String value) { /* Android exposes a typed tooltip field without a caption. */ }
  @Override @ReactProp(name = "nativeDetailsLabel")
  public void setNativeDetailsLabel(ReactViewGroup view, String value) { /* Android exposes a typed supplemental description without a caption. */ }
  @Override @ReactProp(name = "nativeScrollAnchorTag", defaultInt = 0)
  public void setNativeScrollAnchorTag(ReactViewGroup view, int value) { ((CUIFocusView) view).setNativeScrollAnchorTag(value); }
  @Override @ReactProp(name = "nativeScrollAnchorKey")
  public void setNativeScrollAnchorKey(ReactViewGroup view, String value) { ((CUIFocusView) view).setNativeScrollAnchorKey(value); }
  @Override @ReactProp(name = "nativeScrollAnchorRevision")
  public void setNativeScrollAnchorRevision(ReactViewGroup view, String value) { ((CUIFocusView) view).setNativeScrollAnchorRevision(value); }
  @Override public void queryMotionGeometry(ReactViewGroup view, String owner, String binding, String requestId) { ((CUIFocusView)view).queryMotionGeometry(owner, binding, requestId); }
  @Override public void sampleMotionColors(ReactViewGroup view, String ownerId, String requestId, String request) { ((CUIFocusView) view).sampleMotionColors(ownerId, requestId, request); }
  @Override public void inspectAccessibility(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).inspectAccessibility(ownerId); }

  @Override public void requestKeyboardFocus(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).requestKeyboardFocus(ownerId); }
  @Override public void requestContainerFocus(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).requestContainerFocus(ownerId); }
  @Override public void requestKeyboardBlur(ReactViewGroup view, String ownerId) { ((CUIFocusView) view).requestKeyboardBlur(ownerId); }

  @Override public void receiveCommand(ReactViewGroup view, String command, ReadableArray args) {
    if ("requestKeyboardFocus".equals(command) || "requestContainerFocus".equals(command) || "requestKeyboardBlur".equals(command) || "inspectAccessibility".equals(command) || "sampleMotionColors".equals(command) || "queryMotionGeometry".equals(command)) delegate.receiveCommand(view, command, args);
    else super.receiveCommand(view, command, args);
  }

  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>();
    Map<String, Object> inherited = super.getExportedCustomDirectEventTypeConstants();
    if (inherited != null) events.putAll(inherited);
    events.put("topNativeMotionGeometry", Collections.singletonMap("registrationName", "onNativeMotionGeometry"));
    events.put("topNativeMotionColors", Collections.singletonMap("registrationName", "onNativeMotionColors"));
    events.put("topNativeActivation", Collections.singletonMap("registrationName", "onNativeActivation"));
    events.put("topNativeAccessibilitySnapshot", Collections.singletonMap("registrationName", "onNativeAccessibilitySnapshot"));
    events.put("topNativeKey", Collections.singletonMap("registrationName", "onNativeKey"));
    events.put("topNativeFocusChange", Collections.singletonMap("registrationName", "onNativeFocusChange"));
    return events;
  }

  @Override public void onDropViewInstance(ReactViewGroup view) {
    ((CUIFocusView) view).cancelHeldKeys();
    ((CUIFocusView) view).invalidateMotionColors();
    ((CUIFocusView) view).invalidateMotionGeometry();
    super.onDropViewInstance(view);
  }
}
