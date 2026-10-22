package com.codonui.input;

import android.text.Editable;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewParent;
import android.view.inputmethod.BaseInputConnection;
import android.widget.EditText;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

final class CUIEditorKeyboardBindings {
  static final class Registration {
    final String id, revision, moduleLease;
    final int targetTag;
    WeakReference<View> original;
    String published = "";
    Registration(String id, String revision, int targetTag, String moduleLease) {
      this.id = id; this.revision = revision; this.targetTag = targetTag; this.moduleLease = moduleLease;
    }
    boolean matches(Registration other) {
      return id.equals(other.id) && revision.equals(other.revision) && targetTag == other.targetTag && moduleLease.equals(other.moduleLease);
    }
  }
  private final CUIKeyboardScope scope;
  private List<Registration> registrations = new ArrayList<>();
  private final java.util.Set<String> conflictingIds = new java.util.HashSet<>();
  private final java.util.Set<Integer> conflictingTargets = new java.util.HashSet<>();
  private long sequence, eventId;
  CUIEditorKeyboardBindings(CUIKeyboardScope scope) { this.scope = scope; }
  void update(List<Registration> next) {
    List<Registration> retained = new ArrayList<>();
    java.util.Set<String> ids = new java.util.HashSet<>();
    java.util.Set<Integer> targets = new java.util.HashSet<>();
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
      View found = scope.findViewById(registration.targetTag);
      if (found != null) registration.original = new WeakReference<>(found);
    }
    View target = registration.original == null ? null : registration.original.get();
    if (target == null || target.getId() != registration.targetTag || !target.isAttachedToWindow() ||
      target.getRootView() != scope.getRootView() || !target.isShown()) return null;
    for (View view = target; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view == scope) return target;
    return null;
  }
  private WritableMap identity(Registration registration) {
    WritableMap data = Arguments.createMap(); scope.writePointerSession(data);
    data.putString("bindingId", registration.id); data.putString("bindingRevision", registration.revision);
    data.putInt("target", registration.targetTag); return data;
  }
  void publish() {
    for (Registration registration : registrations) {
      View target = original(registration);
      boolean ready = scope.menuPointerCaptureReady() && target != null && CUIEditorKeyboardDefaultsModule.forLease(registration.moduleLease) != null;
      String signature = scope.menuPointerOwnerId() + ":" + CUIInputWindow.identity(scope) + ":" + scope.menuPointerEpoch() + ":" + ready;
      if (signature.equals(registration.published)) continue;
      registration.published = signature;
      WritableMap data = identity(registration); data.putDouble("sequence", ++sequence);
      data.putBoolean("ready", ready); data.putBoolean("windowActive", scope.hasWindowFocus() && scope.isShown());
      data.putString("error", ready ? "" : target == null ? "original-editor-unavailable" : "native-binding-not-ready");
      scope.emitEditorKeyboard("topNativeEditorKeyboardStatus", data, false);
    }
  }
  private Registration forFocus(View focused) {
    if (!scope.menuPointerCaptureReady() || !(focused instanceof EditText)) return null;
    Registration match = null;
    for (Registration registration : registrations) {
      if (original(registration) != focused || CUIEditorKeyboardDefaultsModule.forLease(registration.moduleLease) == null) continue;
      if (match != null) return null;
      match = registration;
    }
    return match;
  }
  static boolean dispatch(List<CUIKeyboardScope> scopes, KeyEvent event, View focused) {
    CUIEditorKeyboardBindings owner = null;
    Registration registration = null;
    for (CUIKeyboardScope candidate : scopes) {
      Registration match = candidate.editorKeyboard.forFocus(focused);
      if (match == null) continue;
      if (owner != null) return false;
      owner = candidate.editorKeyboard; registration = match;
    }
    return owner != null && owner.dispatch(registration, event, focused);
  }
  private boolean dispatch(Registration registration, KeyEvent event, View focused) {
    CUIEditorKeyboardDefaultFrames frames = CUIEditorKeyboardDefaultsModule.forLease(registration.moduleLease);
    if (frames == null || forFocus(focused) != registration) return false;
    CUIEditorKeyboardDefaultFrames.Identity id = new CUIEditorKeyboardDefaultFrames.Identity(scope.menuPointerOwnerId(),
      registration.id, registration.revision, registration.targetTag, CUIInputWindow.identity(scope), (long)scope.menuPointerEpoch());
    String phase = event.isCanceled() ? "cancel" : event.getAction() == KeyEvent.ACTION_DOWN ? "down" : "up";
    long serial = ++eventId, token = frames.begin(id, serial, phase);
    if (token == 0) return false;
    long started = android.os.SystemClock.uptimeMillis();
    CUIEditorKeyboardDefaultFrames.Disposition decision;
    try {
      WritableMap data = identity(registration); data.putDouble("eventId", serial); data.putString("phase", phase);
      int code = event.getKeyCode(); data.putString("key", CUIInputWindow.keyName(event)); data.putString("code", CUIPhysicalKey.code(code));
      data.putInt("nativeCode", code); data.putInt("location", CUIPhysicalKey.location(code));
      data.putBoolean("repeat", event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() > 0);
      data.putBoolean("cancelled", event.isCanceled());
      Editable text = ((EditText)focused).getText(); data.putBoolean("isComposing", text != null && BaseInputConnection.getComposingSpanStart(text) >= 0);
      data.putBoolean("shiftKey", event.isShiftPressed()); data.putBoolean("altKey", event.isAltPressed());
      data.putBoolean("ctrlKey", event.isCtrlPressed()); data.putBoolean("metaKey", event.isMetaPressed()); data.putBoolean("capsLock", event.isCapsLockOn());
      data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState())); data.putDouble("timestamp", event.getEventTime());
      scope.emitEditorKeyboard("topNativeEditorKey", data, true);
    } catch (RuntimeException failure) {
      registration.published = "";
    } finally {
      boolean current = registrations.contains(registration) && original(registration) == focused &&
        scope.menuPointerCaptureReady() && id.windowId.equals(CUIInputWindow.identity(scope)) && id.epoch == scope.menuPointerEpoch() &&
        CUIEditorKeyboardDefaultsModule.forLease(registration.moduleLease) == frames;
      decision = frames.end(token, current);
    }
    WritableMap result = identity(registration); result.putDouble("eventId", serial); result.putString("phase", phase);
    result.putString("decision", decision.name().toLowerCase(java.util.Locale.ROOT)); result.putDouble("elapsedMs", android.os.SystemClock.uptimeMillis() - started);
    scope.emitEditorKeyboard("topNativeEditorKeyboardDecision", result, false);
    return decision == CUIEditorKeyboardDefaultFrames.Disposition.PREVENTED;
  }
}
