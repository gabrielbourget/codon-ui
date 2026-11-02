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
    final boolean subtree, toolbarTargetOnly, toolbarSubtreeOnly;
    WeakReference<View> original;
    String published = "";
    Registration(String id, String revision, int targetTag, boolean subtree, boolean toolbarTargetOnly, boolean toolbarSubtreeOnly) { this.id = id; this.revision = revision; this.targetTag = targetTag; this.subtree = subtree; this.toolbarTargetOnly=toolbarTargetOnly; this.toolbarSubtreeOnly=toolbarSubtreeOnly; }
    boolean matches(Registration other) { return id.equals(other.id) && revision.equals(other.revision) && targetTag == other.targetTag && subtree == other.subtree && toolbarTargetOnly == other.toolbarTargetOnly && toolbarSubtreeOnly == other.toolbarSubtreeOnly; }
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
      for (Registration old : registrations) {
        if (value.matches(old)) { selected = old; break; }
        if (value.id.equals(old.id) && value.revision.equals(old.revision) && value.targetTag == old.targetTag) value.original=old.original;
      }
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
  boolean canObserveTarget(View target) {
    if (!scope.menuPointerCaptureReady() || target == null) return false;
    for (Registration registration : registrations) if (original(registration) == target) return true;
    return false;
  }
  private Registration forFocus(View focused, KeyEvent event) {
    if (!scope.menuPointerCaptureReady() || focused == null || focused instanceof CUIDateSegment) return null;
    boolean toolbarObservation=CUIKeyboardScope.toolbarRouteForOriginal(focused,event) != null;
    Registration selected = null;
    for (Registration registration : registrations) {
      View target = original(registration);
      if (target != focused || (registration.toolbarTargetOnly && !toolbarObservation)) continue;
      if (selected != null) return null;
      selected = registration;
    }
    if (selected != null) return selected;
    for (Registration registration : registrations) if (registration.subtree && (!registration.toolbarSubtreeOnly || toolbarObservation) && original(registration) != null) selected = registration;
    return selected;
  }
  org.json.JSONObject actionBinding(View focused, KeyEvent event) {
    Registration registration=forFocus(focused,event);
    if (registration==null || focused==null || registration.targetTag!=focused.getId() || original(registration)!=focused) return null;
    try { return new org.json.JSONObject().put("bindingId",registration.id).put("bindingRevision",registration.revision); }
    catch (org.json.JSONException unavailable) { return null; }
  }
  static void dispatch(List<CUIKeyboardScope> scopes, KeyEvent event, View focused, boolean captured) {
    dispatch(scopes,event,focused,captured,false);
  }
  static void dispatchToolbarCancellation(List<CUIKeyboardScope> scopes, KeyEvent event, View focused, boolean captured) {
    dispatch(scopes,event,focused,captured,true);
  }
  private static void dispatch(List<CUIKeyboardScope> scopes, KeyEvent event, View focused, boolean captured, boolean lifecycleCancelled) {
    if (!lifecycleCancelled && CUIKeyboardScope.toolbarCancelledOriginal(focused,event)) return;
    CUIOrdinaryEditorKeys owner = null; Registration registration = null;
    CUIKeyboardScope toolbarOwner=CUIKeyboardScope.toolbarOriginalOwner(focused,event);
    String actionMetadata=CUIKeyboardScope.originalEditorActionForOriginal(focused,event);
    String actionOwner="";
    if (actionMetadata!=null) try { actionOwner=new org.json.JSONObject(actionMetadata).getString("ownerId"); } catch (org.json.JSONException invalid) { return; }
    int bestPriority=0;
    for (CUIKeyboardScope candidate : scopes) {
      Registration match = candidate.ordinaryEditorKeys.forFocus(focused,event);
      if (match == null) continue;
      if (!actionOwner.isEmpty()) {
        if (!actionOwner.equals(candidate.menuPointerOwnerId()) || match.targetTag!=focused.getId()) continue;
        if (owner!=null) return;owner=candidate.ordinaryEditorKeys;registration=match;
      } else if (toolbarOwner == null) {
        if (owner != null) return;
        owner=candidate.ordinaryEditorKeys; registration=match;
      } else {
        int priority=candidate.ordinaryEditorKeys.original(match) == focused ? 2 : candidate == toolbarOwner ? 1 : 0;
        if (priority == 0 || priority < bestPriority) continue;
        if (priority == bestPriority && owner != null) return;
        owner=candidate.ordinaryEditorKeys; registration=match; bestPriority=priority;
      }
    }
    if (owner != null) owner.dispatch(registration, event, focused, captured, lifecycleCancelled);
  }
  void appendToolbarObservers(org.json.JSONArray observers) throws org.json.JSONException {
    for (Registration candidate : registrations) if (candidate.subtree && original(candidate) != null)
      observers.put(new org.json.JSONObject().put("bindingId",candidate.id).put("bindingRevision",candidate.revision).put("targetTag",candidate.targetTag)
        .put("ownerId",scope.menuPointerOwnerId()).put("windowId",CUIInputWindow.identity(scope)).put("epoch",scope.menuPointerEpoch()));
  }
  private void dispatch(Registration registration, KeyEvent event, View focused, boolean captured) {
    dispatch(registration,event,focused,captured,false);
  }
  private void dispatch(Registration registration, KeyEvent event, View focused, boolean captured, boolean lifecycleCancelled) {
    if (forFocus(focused,event) != registration) return;
    View original = focused;
    while (original != null && original != scope) {
      try {
        com.facebook.react.bridge.UIManager manager = UIManagerHelper.getUIManagerForReactTag((com.facebook.react.bridge.ReactContext)scope.getContext(), original.getId());
        if (manager != null && manager.resolveView(original.getId()) == original) break;
      } catch (RuntimeException unavailable) { }
      original = original.getParent() instanceof View ? (View)original.getParent() : null;
    }
    if (original == null || original == scope) return;
    captured = captured || (focused instanceof CUIFocusView && ((CUIFocusView)focused).capturesObservedKey(event));
    WritableMap data = identity(registration); int code = event.getKeyCode();
    int unicode = event.getUnicodeChar();
    String characters = unicode > 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
    String toolbarRoute=CUIKeyboardScope.toolbarRouteForOriginal(original,event);
    org.json.JSONArray observers = new org.json.JSONArray();
    try {
      if (toolbarRoute != null || CUIKeyboardScope.originalEditorActionForOriginal(original,event)!=null) for (CUIKeyboardScope candidate : CUIInputWindow.scopes(scope)) candidate.ordinaryEditorKeys.appendToolbarObservers(observers);
      else for (Registration candidate : registrations) if (candidate.subtree && original(candidate) != null)
        observers.put(new org.json.JSONObject().put("bindingId", candidate.id).put("bindingRevision", candidate.revision).put("targetTag", candidate.targetTag));
    } catch (org.json.JSONException invalid) { return; }
    data.putString("observerBindings", observers.toString()); data.putInt("target", original.getId());
    data.putString("kind", "keyboard"); data.putDouble("eventId", ++eventId);
    data.putString("key", CUIInputWindow.keyName(event)); data.putString("code", CUIPhysicalKey.code(code));
    data.putInt("nativeCode", code); data.putInt("location", CUIPhysicalKey.location(code)); data.putString("characters", characters);
    data.putString("phase", event.getAction() == KeyEvent.ACTION_DOWN && !lifecycleCancelled ? "down" : "up");
    data.putBoolean("repeat", event.getAction() == KeyEvent.ACTION_DOWN && !lifecycleCancelled && event.getRepeatCount() > 0);
    data.putBoolean("cancelled", event.isCanceled() || lifecycleCancelled);
    Editable text = focused instanceof EditText ? ((EditText)focused).getText() : null;
    data.putBoolean("isComposing", text != null && BaseInputConnection.getComposingSpanStart(text) >= 0);
    data.putBoolean("shiftKey", event.isShiftPressed()); data.putBoolean("altKey", event.isAltPressed());
    data.putBoolean("ctrlKey", event.isCtrlPressed()); data.putBoolean("metaKey", event.isMetaPressed()); data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState()));
    data.putBoolean("nativeDefaultHandled", captured); data.putDouble("timestamp", event.getEventTime());
    if (toolbarRoute != null) data.putString("toolbarRoute",toolbarRoute);
    String action=CUIKeyboardScope.originalEditorActionForOriginal(original,event);
    if (action!=null) data.putString("originalEditorAction",action);
    boolean emitted=scope.emitOrdinaryEditorKey(original.getId(), data);
    if (toolbarRoute != null && emitted) CUIKeyboardScope.toolbarOriginalDidEmit(original,event);
  }
}
