package com.codonui.input;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUIKeyboardScopeManagerDelegate;
import com.facebook.react.viewmanagers.CUIKeyboardScopeManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@ReactModule(name = CUIKeyboardScopeManager.NAME)
public final class CUIKeyboardScopeManager extends ReactViewManager implements CUIKeyboardScopeManagerInterface<ReactViewGroup> {
  static final String NAME = "CUIKeyboardScope";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUIKeyboardScopeManagerDelegate<ReactViewGroup, CUIKeyboardScopeManager> delegate = new CUIKeyboardScopeManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("ownerId".equals(name) || "enabled".equals(name) || "policies".equals(name) || "acceptedWindowId".equals(name) || "acceptedEpoch".equals(name) || "policyRevision".equals(name) || "floatingTargets".equals(name) || "observations".equals(name) || "observationRevision".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };
  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIKeyboardScope(context); }
  @Override @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) { ((CUIKeyboardScope) view).setOwnerId(value); }
  @Override @ReactProp(name = "enabled", defaultBoolean = true) public void setEnabled(ReactViewGroup view, boolean value) { ((CUIKeyboardScope) view).setCaptureEnabled(value); }
  @Override @ReactProp(name = "acceptedWindowId") public void setAcceptedWindowId(ReactViewGroup view, String value) { ((CUIKeyboardScope) view).setAcceptedWindowId(value); }
  @Override @ReactProp(name = "acceptedEpoch") public void setAcceptedEpoch(ReactViewGroup view, double value) { ((CUIKeyboardScope) view).setAcceptedEpoch(value); }
  @Override @ReactProp(name = "policyRevision") public void setPolicyRevision(ReactViewGroup view, double value) { ((CUIKeyboardScope) view).setPolicyRevision(value); }
  @Override @ReactProp(name = "observationRevision") public void setObservationRevision(ReactViewGroup view, double value) { ((CUIKeyboardScope) view).setObservationRevision(value); }
  @Override @ReactProp(name = "observations") public void setObservations(ReactViewGroup view, ReadableArray value) {
    List<CUIKeyboardScope.Observation> observations = new ArrayList<>();
    if (value != null) for (int index = 0; index < value.size(); index++) {
      ReadableMap observation = value.getMap(index); observations.add(new CUIKeyboardScope.Observation(observation.getString("id"), observation.getInt("targetTag")));
    }
    ((CUIKeyboardScope) view).setObservations(observations);
  }
  @Override @ReactProp(name = "floatingTargets") public void setFloatingTargets(ReactViewGroup view, ReadableArray value) {
    List<CUIFloatingObserver.Target> targets = new ArrayList<>();
    if (value != null) for (int index = 0; index < value.size(); index++) {
      ReadableMap target = value.getMap(index); targets.add(new CUIFloatingObserver.Target(target.getString("id"), target.getInt("targetTag"), target.getInt("descriptionTag")));
    }
    ((CUIKeyboardScope) view).setFloatingTargets(targets);
  }
  @Override @ReactProp(name = "policies") public void setPolicies(ReactViewGroup view, ReadableArray value) {
    List<CUIKeyboardScope.Policy> policies = new ArrayList<>();
    if (value != null) for (int index = 0; index < value.size(); index++) {
      ReadableMap policy = value.getMap(index); Set<String> tokens = new HashSet<>(); ReadableArray keys = policy.getArray("tokens");
      for (int key = 0; key < keys.size(); key++) tokens.add(keys.getString(key));
      policies.add(new CUIKeyboardScope.Policy(policy.getString("id"), tokens, policy.getBoolean("excludeEditable"), policy.getBoolean("excludeComposing"), policy.getInt("targetTag")));
    }
    ((CUIKeyboardScope) view).setPolicies(policies);
  }
  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>(); Map<String, Object> existing = super.getExportedCustomDirectEventTypeConstants();
    if (existing != null) events.putAll(existing);
    events.put("topNativeScopedKey", Collections.singletonMap("registrationName", "onNativeScopedKey"));
    events.put("topNativeInputModality", Collections.singletonMap("registrationName", "onNativeInputModality"));
    events.put("topNativeScopeStatus", Collections.singletonMap("registrationName", "onNativeScopeStatus"));
    events.put("topNativeFloatingObservation", Collections.singletonMap("registrationName", "onNativeFloatingObservation"));
    events.put("topNativeObservedKey", Collections.singletonMap("registrationName", "onNativeObservedKey"));
    events.put("topNativeObservationStatus", Collections.singletonMap("registrationName", "onNativeObservationStatus"));
    return events;
  }
  @Override public void onDropViewInstance(ReactViewGroup view) { ((CUIKeyboardScope) view).retireHeld(); super.onDropViewInstance(view); }
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view); ((CUIKeyboardScope) view).publishStatus(); }
}
