package com.codonui.input;

import android.view.KeyEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.WeakHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

@DoNotStrip
final class CUIFieldInputBinding {
  interface Snapshot { JSONObject read() throws Exception; }
  private static final WeakHashMap<CUIFieldInputBinding, Boolean> bindings = new WeakHashMap<>();
  private static final ThreadLocal<KeyEvent> currentDefault = new ThreadLocal<>();
  private final WeakReference<CUIFormMetadataView> metadata;
  private final WeakReference<FabricUIManager> manager;
  private final Snapshot snapshot;
  private WeakReference<View> outer = new WeakReference<>(null), input = new WeakReference<>(null);
  private String outerInstance = "", inputInstance = "", bindingId = "", ownerId = "", lease = "", fingerprint = "", lastError = "";
  private long epoch = 1, eventId;
  private boolean closed, capturing;
  private final HashSet<Integer> consumed = new HashSet<>();
  private static native String nativeDispatchFieldKey(FabricUIManager manager, CUIFieldInputBinding binding,
    String document, String snapshot, String key, String declarations, double epoch);
  private static native void nativeRetireBinding(String lease, String owner, String binding);

  CUIFieldInputBinding(CUIFormMetadataView metadata, FabricUIManager manager, Snapshot snapshot) {
    UiThreadUtil.assertOnUiThread();
    this.metadata = new WeakReference<>(metadata); this.manager = new WeakReference<>(manager); this.snapshot = snapshot;
    bindings.put(this, true); refresh();
  }
  private JSONObject capture() {
    if (closed || capturing || metadata.get() == null || manager.get() == null) return null;
    capturing = true;
    try {
      CUIFormMetadataView metadata = this.metadata.get(); FabricUIManager manager = this.manager.get();
      JSONObject value = snapshot.read(), declaration = new JSONObject(metadata.fieldGroupBinding);
      JSONObject current = value.getJSONObject("fieldGroupSnapshot");
      if ((!bindingId.isEmpty() && !bindingId.equals(declaration.getString("bindingId"))) ||
          (!ownerId.isEmpty() && !ownerId.equals(declaration.getString("ownerId")))) throw new IllegalStateException("field-input-original-binding-retired");
      View outer = manager.resolveView(declaration.getInt("outerTarget")), input = manager.resolveView(declaration.getInt("inputTarget"));
      if (outer == null || input == null || (!outerInstance.isEmpty() && !outerInstance.equals(current.getString("outerInstance"))) ||
          (!inputInstance.isEmpty() && !inputInstance.equals(current.getString("inputInstance"))))
        throw new IllegalStateException("field-input-original-root-instance-retired");
      String fingerprint = new JSONArray().put(value.getString("documentId")).put(value.getInt("surfaceId"))
        .put(current.getString("windowId")).put(current.getString("outerInstance")).put(current.getString("inputInstance"))
        .put(metadata.fieldGroupBinding).put(metadata.ownedEditorBinding).toString();
      if (!this.fingerprint.isEmpty() && !this.fingerprint.equals(fingerprint)) { retirePending(); epoch++; }
      this.fingerprint = fingerprint; this.outer = new WeakReference<>(outer); this.input = new WeakReference<>(input);
      outerInstance = current.getString("outerInstance"); inputInstance = current.getString("inputInstance");
      bindingId = declaration.getString("bindingId"); ownerId = declaration.getString("ownerId"); lease = declaration.getString("moduleLease");
      lastError = ""; return value;
    } catch (Exception error) {
      retirePending();
      if (!lastError.equals(String.valueOf(error.getMessage()))) {
        lastError = String.valueOf(error.getMessage());
        record("status", lastError);
      }
      return null;
    } finally { capturing = false; }
  }
  void refresh() { if (!closed && !capturing) capture(); }
  private void record(String kind, String error) {
    CUIFormMetadataView metadata = this.metadata.get();
    if (metadata == null) return;
    try { metadata.emitFieldInputRecord(new JSONObject().put("kind", kind).put("error", error).toString()); }
    catch (Exception ignored) { /* The original native failure remains the decision. */ }
  }
  private void retirePending() {
    if (!lease.isEmpty() && !bindingId.isEmpty()) nativeRetireBinding(lease, ownerId, bindingId);
    consumed.clear();
  }
  void retire() { if (closed) return; closed = true; retirePending(); bindings.remove(this); }
  private static boolean descendant(View view, View root) {
    if (root == null) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == root) return true;
    return false;
  }
  static boolean inDefault(KeyEvent event) { return currentDefault.get() == event; }
  static KeyEvent beginDefault(KeyEvent event) {
    KeyEvent previous = currentDefault.get(); currentDefault.set(event); return previous;
  }
  static void endDefault(KeyEvent event, KeyEvent previous) {
    if (currentDefault.get() != event) return;
    if (previous == null) currentDefault.remove(); else currentDefault.set(previous);
  }
  static final class Decision {
    final CUIFieldInputBinding owner;
    final boolean prevented;
    final JSONObject record;
    Decision(CUIFieldInputBinding owner, boolean prevented, JSONObject record) { this.owner = owner; this.prevented = prevented; this.record = record; }
    void finish(boolean invoked, boolean handled, String error) {
      CUIFormMetadataView metadata = owner.metadata.get(); if (metadata == null) return;
      try {
        record.put("originalDefaultInvoked", invoked).put("originalDefaultReturned", invoked && error.isEmpty())
          .put("originalDispatchHandled", handled).put("originalDefaultError", error);
        metadata.emitFieldInputRecord(record.toString());
      }
      catch (Exception failure) { owner.record("failure", String.valueOf(failure.getMessage())); }
    }
  }
  static Decision dispatch(View window, KeyEvent event, View focused) {
    UiThreadUtil.assertOnUiThread();
    CUIFieldInputBinding selected = null;
    ArrayList<CUIFieldInputBinding> candidates = new ArrayList<>(bindings.keySet());
    JSONArray declarations = new JSONArray();
    for (CUIFieldInputBinding binding : candidates) {
      JSONObject value = binding.capture(); View outer = binding.outer.get();
      if (value == null || outer == null || outer.getRootView() != window.getRootView() || !descendant(focused, outer)) continue;
      try {
        declarations.put(new JSONObject().put("encodedDocument", value.getString("encodedDocument"))
          .put("snapshot", value.getJSONObject("fieldGroupSnapshot")).put("epoch", binding.epoch));
        if (selected != null && selected.outer.get() == outer) return null;
        if (selected == null || descendant(outer, selected.outer.get())) selected = binding;
      } catch (Exception error) { binding.record("failure", String.valueOf(error.getMessage())); }
    }
    if (selected == null) return null;
    return selected.dispatch(event, focused, declarations);
  }
  private Decision dispatch(KeyEvent event, View focused, JSONArray declarations) {
    try {
      JSONObject value = capture(); FabricUIManager manager = this.manager.get();
      if (value == null || manager == null || !descendant(focused, outer.get())) return null;
      boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
      boolean intrinsic = consumed.contains(event.getKeyCode());
      if (down && focused instanceof CUIFocusView) intrinsic = ((CUIFocusView)focused).capturesObservedKey(event);
      if (down && intrinsic) consumed.add(event.getKeyCode());
      if (!down) consumed.remove(event.getKeyCode());
      int unicode = event.getUnicodeChar();
      String characters = unicode > 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
      JSONObject key = new JSONObject().put("kind", "keyboard").put("ownerId", ownerId).put("target", focused.getId())
        .put("key", CUIInputWindow.keyName(event)).put("nativeCode", event.getKeyCode()).put("characters", characters)
        .put("phase", down ? "down" : "up").put("repeat", down && event.getRepeatCount() > 0).put("cancelled", event.isCanceled())
        .put("shiftKey", event.isShiftPressed()).put("altKey", event.isAltPressed()).put("ctrlKey", event.isCtrlPressed()).put("metaKey", event.isMetaPressed())
        .put("capsLock", event.isCapsLockOn()).put("nativeModifierData", Integer.toUnsignedString(event.getMetaState()))
        .put("nativeDefaultHandled", intrinsic).put("timestamp", event.getEventTime()).put("eventId", ++eventId)
        .put("nativeScanCode", event.getScanCode()).put("nativeDeviceId", event.getDeviceId()).put("nativeSource", event.getSource())
        .put("nativeFlags", event.getFlags()).put("nativeDownTime", event.getDownTime())
        .put("code", CUIPhysicalKey.code(event.getKeyCode())).put("location", CUIPhysicalKey.location(event.getKeyCode()));
      JSONObject record = new JSONObject(nativeDispatchFieldKey(manager, this, value.getString("encodedDocument"),
        value.getJSONObject("fieldGroupSnapshot").toString(), key.toString(), declarations.toString(), epoch));
      return new Decision(this, intrinsic || "prevented".equals(record.getString("decision")), record);
    } catch (Exception error) { record("failure", String.valueOf(error.getMessage())); return null; }
  }
  @DoNotStrip
  String currentSnapshot() throws Exception {
    JSONObject value = capture();
    if (value == null) throw new IllegalStateException("field-input-current-snapshot-retired");
    return value.toString();
  }
  private CUIFieldInputBinding scopeOwner(int target) throws Exception {
    View originalOuter = outer.get();
    CUIFieldInputBinding found = null;
    for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
      View root = binding.outer.get();
      if (binding.closed || root == null || originalOuter == null || root.getId() != target ||
          root.getRootView() != originalOuter.getRootView() || !binding.lease.equals(lease)) continue;
      if (found != null) throw new IllegalStateException("field-input-original-group-ambiguous");
      found = binding;
    }
    if (found == null) throw new IllegalStateException("field-input-original-scope-retired");
    return found;
  }
  @DoNotStrip
  String currentScopeSnapshot(int target) throws Exception {
    CUIFieldInputBinding selected = scopeOwner(target);
    JSONObject value = selected.capture();
    if (value == null) throw new IllegalStateException("field-input-current-scope-retired");
    return value.put("scopeEpoch", selected.epoch).toString();
  }
  @DoNotStrip
  String focus(String encoded) throws Exception {
    JSONObject request = new JSONObject(encoded);
    return scopeOwner(request.getInt("scopeTarget")).focusOriginal(request);
  }
  private String focusOriginal(JSONObject request) {
    try {
      JSONObject value = capture();
      FabricUIManager manager = this.manager.get();
      if (value == null || manager == null || request.getLong("epoch") != epoch) throw new IllegalStateException("field-input-focus-binding-retired");
      int target = request.getInt("target");
      JSONObject expected = request.getJSONObject("original");
      View original = manager.resolveView(target), outer = this.outer.get();
      if (original == null || !descendant(original, outer) || !CUIFieldGroupDocument.matchesOriginal(manager, expected, original))
        throw new IllegalStateException("field-input-focus-original-retired");
      boolean alreadyFocused = original.isFocused();
      if (alreadyFocused) return new JSONObject().put("requested", false).put("observed", true).put("current", true).put("target", target)
        .put("nativeInstance", expected.getString("nativeInstance")).put("editorInstance", expected.getString("editorInstance")).put("error", "").toString();
      final boolean[] observed = {alreadyFocused};
      ViewTreeObserver observer = outer.getViewTreeObserver();
      ViewTreeObserver.OnGlobalFocusChangeListener listener = (previous, next) -> { if (next == original) observed[0] = true; };
      observer.addOnGlobalFocusChangeListener(listener);
      Object commandResult = JSONObject.NULL;
      try {
        if (original instanceof CUIDateSegment) commandResult = ((CUIDateSegment)original).requestFormSegmentFocus(expected.getJSONObject("segment"));
        else if (original instanceof ReactEditText) ((ReactEditText)original).requestFocusFromJS();
        else if (original instanceof CUIFocusView) ((CUIFocusView)original).requestKeyboardFocus(((CUIFocusView)original).fieldInputOwnerId());
        else throw new IllegalStateException("field-input-original-focus-command-unavailable");
        for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
          View root = binding.outer.get(); if (root instanceof CUIFocusView && root.getRootView() == outer.getRootView())
            ((CUIFocusView)root).synchronizeFocusWithin();
        }
      } finally { if (observer.isAlive()) observer.removeOnGlobalFocusChangeListener(listener); }
      JSONObject after = capture(), actual = null;
      if (after != null) {
        JSONArray originals = after.getJSONObject("fieldGroupSnapshot").getJSONArray("originals");
        for (int index = 0; index < originals.length(); index++) if (originals.getJSONObject(index).getInt("target") == target) actual = originals.getJSONObject(index);
      }
      boolean current = after != null && request.getLong("epoch") == epoch && manager.resolveView(target) == original && actual != null &&
        actual.getString("nativeInstance").equals(expected.getString("nativeInstance")) && actual.getString("editorInstance").equals(expected.getString("editorInstance"));
      boolean completed = observed[0];
      JSONObject response = new JSONObject().put("requested", true).put("observed", completed).put("current", current).put("target", target)
        .put("nativeInstance", expected.getString("nativeInstance")).put("editorInstance", expected.getString("editorInstance"))
        .put("error", completed ? "" : "field-input-original-focus-not-observed");
      CUIFormMetadataView metadata = this.metadata.get();
      if (metadata != null) metadata.emitFieldInputRecord(new JSONObject(response.toString()).put("kind", "focus")
        .put("nativeCommandResult", commandResult).put("after", after == null ? JSONObject.NULL : after.getJSONObject("fieldGroupSnapshot")).toString());
      return response.toString();
    } catch (Exception error) {
      try { return new JSONObject().put("requested", false).put("observed", false).put("current", false).put("target", 0)
        .put("nativeInstance", "").put("editorInstance", "").put("error", String.valueOf(error.getMessage())).toString(); }
      catch (Exception impossible) { throw new IllegalStateException(impossible); }
    }
  }
}
