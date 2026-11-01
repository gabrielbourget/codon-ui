package com.codonui.input;

import android.text.Editable;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.BaseInputConnection;
import android.widget.EditText;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class CUIOrdinaryEditorKeys {
  static final class Registration {
    final String id, revision;
    final int targetTag;
    final boolean subtree;
    WeakReference<View> original;
    String published = "";
    Registration(String id, String revision, int targetTag, boolean subtree) { this.id = id; this.revision = revision; this.targetTag = targetTag; this.subtree = subtree; }
    boolean matches(Registration other) { return id.equals(other.id) && revision.equals(other.revision) && targetTag == other.targetTag && subtree == other.subtree; }
  }
  private final CUIKeyboardScope scope;
  private List<Registration> registrations = new ArrayList<>();
  private final Set<String> conflictingIds = new HashSet<>();
  private final Set<Integer> conflictingTargets = new HashSet<>();
  private long sequence, eventId;
  CUIOrdinaryEditorKeys(CUIKeyboardScope scope) { this.scope = scope; }
  void update(List<Registration> next) {
    List<Registration> retained = new ArrayList<>();
    Set<String> ids = new HashSet<>(); Set<Integer> targets = new HashSet<>();
    conflictingIds.clear(); conflictingTargets.clear();
    for (Registration value : next) {
      Registration selected = value;
      for (Registration old : registrations) if (value.matches(old)) { selected = old; break; }
      if (!ids.add(selected.id)) conflictingIds.add(selected.id);
      if (!targets.add(selected.targetTag)) conflictingTargets.add(selected.targetTag);
      retained.add(selected);
    }
    registrations = retained;
  }
  private View original(Registration registration) {
    if (registration.targetTag <= 0 || registration.id.isEmpty() || registration.revision.isEmpty() ||
        conflictingIds.contains(registration.id) || conflictingTargets.contains(registration.targetTag)) return null;
    if (registration.original == null) {
      View found = null;
      try {
        com.facebook.react.bridge.UIManager manager = UIManagerHelper.getUIManagerForReactTag((com.facebook.react.bridge.ReactContext)scope.getContext(), registration.targetTag);
        if (manager != null) found = manager.resolveView(registration.targetTag);
      } catch (RuntimeException unavailable) { }
      if (found != null) registration.original = new WeakReference<>(found);
    }
    View target = registration.original == null ? null : registration.original.get();
    if (target == null || target.getId() != registration.targetTag || !target.isAttachedToWindow() || !target.isShown() ||
        target.getRootView() != scope.getRootView()) return null;
    return target;
  }
  private WritableMap identity(Registration registration) {
    WritableMap data = Arguments.createMap(); scope.writePointerSession(data);
    data.putString("bindingId", registration.id); data.putString("bindingRevision", registration.revision);
    data.putInt("target", registration.targetTag); return data;
  }
  private static void structure(View view, StringBuilder signature) {
    if (view == null) return;
    signature.append(view.getId()).append('@').append(System.identityHashCode(view)).append('(');
    if (view instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) structure(group.getChildAt(index), signature);
    }
    signature.append(')');
  }
  void publish() {
    for (Registration registration : registrations) {
      View target = original(registration);
      boolean ready = scope.menuPointerCaptureReady() && target != null;
      String signature = scope.menuPointerOwnerId() + ":" + CUIInputWindow.identity(scope) + ":" + scope.menuPointerEpoch() + ":" + ready;
      if (registration.subtree) { StringBuilder hierarchy = new StringBuilder(); structure(target, hierarchy); signature += ":" + hierarchy; }
      if (signature.equals(registration.published)) continue;
      registration.published = signature;
      WritableMap data = identity(registration); data.putDouble("sequence", ++sequence);
      data.putBoolean("ready", ready); data.putBoolean("windowActive", scope.hasWindowFocus() && scope.isShown());
      data.putString("error", ready ? "" : "original-editor-unavailable");
      scope.emitOrdinaryEditorStatus(data);
    }
  }
  private Registration forFocus(View focused) {
    if (!scope.menuPointerCaptureReady() || focused == null || focused instanceof CUIDateSegment) return null;
    Registration selected = null;
    for (Registration registration : registrations) {
      View target = original(registration);
      if (target != focused) continue;
      if (selected != null) return null;
      selected = registration;
    }
    if (selected != null) return selected;
    for (Registration registration : registrations) if (registration.subtree && original(registration) != null) selected = registration;
    return selected;
  }
  static void dispatch(List<CUIKeyboardScope> scopes, KeyEvent event, View focused, boolean captured) {
    CUIOrdinaryEditorKeys owner = null; Registration registration = null;
    for (CUIKeyboardScope candidate : scopes) {
      Registration match = candidate.ordinaryEditorKeys.forFocus(focused);
      if (match == null) continue;
      if (owner != null) return;
      owner = candidate.ordinaryEditorKeys; registration = match;
    }
    if (owner != null) owner.dispatch(registration, event, focused, captured);
  }
  private void dispatch(Registration registration, KeyEvent event, View focused, boolean captured) {
    if (forFocus(focused) != registration) return;
    View original = focused;
    while (original != null && original != scope) {
      try {
        com.facebook.react.bridge.UIManager manager = UIManagerHelper.getUIManagerForReactTag((com.facebook.react.bridge.ReactContext)scope.getContext(), original.getId());
        if (manager != null && manager.resolveView(original.getId()) == original) break;
      } catch (RuntimeException unavailable) { }
      original = original.getParent() instanceof View ? (View)original.getParent() : null;
    }
    if (original == null || original == scope) return;
    WritableMap data = identity(registration); int code = event.getKeyCode();
    int unicode = event.getUnicodeChar();
    String characters = unicode > 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
    org.json.JSONArray observers = new org.json.JSONArray();
    try {
      for (Registration candidate : registrations) if (candidate.subtree && original(candidate) != null)
        observers.put(new org.json.JSONObject().put("bindingId", candidate.id).put("bindingRevision", candidate.revision).put("targetTag", candidate.targetTag));
    } catch (org.json.JSONException invalid) { return; }
    data.putString("observerBindings", observers.toString()); data.putInt("target", original.getId());
    data.putString("kind", "keyboard"); data.putDouble("eventId", ++eventId);
    data.putString("key", CUIInputWindow.keyName(event)); data.putString("code", CUIPhysicalKey.code(code));
    data.putInt("nativeCode", code); data.putInt("location", CUIPhysicalKey.location(code)); data.putString("characters", characters);
    data.putString("phase", event.getAction() == KeyEvent.ACTION_DOWN ? "down" : "up");
    data.putBoolean("repeat", event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() > 0);
    data.putBoolean("cancelled", event.isCanceled());
    Editable text = focused instanceof EditText ? ((EditText)focused).getText() : null;
    data.putBoolean("isComposing", text != null && BaseInputConnection.getComposingSpanStart(text) >= 0);
    data.putBoolean("shiftKey", event.isShiftPressed()); data.putBoolean("altKey", event.isAltPressed());
    data.putBoolean("ctrlKey", event.isCtrlPressed()); data.putBoolean("metaKey", event.isMetaPressed()); data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState()));
    data.putBoolean("nativeDefaultHandled", captured); data.putDouble("timestamp", event.getEventTime());
    scope.emitOrdinaryEditorKey(original.getId(), data);
  }
}
