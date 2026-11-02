package com.codonui.input;

import android.content.Context;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewParent;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.LifecycleState;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUICollectionRoot extends ReactViewGroup implements UIManagerListener, LifecycleEventListener {
  interface CurrentFieldGuard { boolean check(); }
  static final class Admission {
    final View originalOption;
    final String opaqueFocusIdentity;
    private final CurrentFieldGuard check;
    Admission(View option, String identity, CurrentFieldGuard check) { originalOption = option; opaqueFocusIdentity = identity; this.check = check; }
    boolean current() { return check.check(); }
  }
  private static final Map<String, WeakReference<CUICollectionRoot>> publishers = new HashMap<>();
  private static long nextInstance;
  private static final class Record {
    final WeakReference<View> original;
    final Object window;
    final JSONObject intent;
    final String binding, lease;
    View.OnAttachStateChangeListener listener;
    Record(View view, JSONObject intent, String binding, String lease) {
      original = new WeakReference<>(view); window = view.getWindowToken(); this.intent = intent; this.binding = binding; this.lease = lease;
    }
    void retire() { View view = original.get(); if (view != null && listener != null) view.removeOnAttachStateChangeListener(listener); }
  }
  private String publisher = "", publication = "", requests = "[]", lastSnapshot = "", lifetime = "";
  private long instance, sequence, epoch, lastRequestSequence, nextAvailabilityCheck;
  private UIManager manager;
  private boolean mounting, resumed, committed, awaitingAcknowledgement;
  private JSONObject model, rootIntent;
  private JSONArray receiverIntents = new JSONArray();
  private final Map<String, Record> records = new LinkedHashMap<>();

  CUICollectionRoot(Context context) { super(context); renewPublisher(); enforceInert(); }
  private static String newIdentity() { return UUID.randomUUID().toString(); }
  private void renewPublisher() {
    publishers.remove(publisher); publisher = newIdentity(); instance = ++nextInstance; sequence = 0; lastRequestSequence = 0;
    publishers.put(publisher, new WeakReference<>(this));
  }
  void enforceInert() { setAlpha(0); setFocusable(false); setClickable(false); setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS); }
  private void connect() {
    if (manager != null || !(getContext() instanceof ReactContext)) return;
    ReactContext context = (ReactContext)getContext();
    manager = UIManagerHelper.getUIManagerForReactTag(context, getId());
    resumed = context.getLifecycleState() == LifecycleState.RESUMED;
    if (manager != null) manager.addUIManagerEventListener(this);
    context.addLifecycleEventListener(this);
  }
  private void disconnect() {
    if (manager != null) manager.removeUIManagerEventListener(this);
    manager = null;
    if (getContext() instanceof ReactContext) ((ReactContext)getContext()).removeLifecycleEventListener(this);
  }
  @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); connect(); revokeAll(); }
  @Override protected void onDetachedFromWindow() { revokeAll(); publish(); disconnect(); super.onDetachedFromWindow(); }
  @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); revokeAll(); reconcile(); }
  @Override public void onHostResume() { resumed = true; revokeAll(); reconcile(); }
  @Override public void onHostPause() { resumed = false; revokeAll(); publish(); }
  @Override public void onHostDestroy() { resumed = false; revokeAll(); publish(); }
  void retire() { revokeAll(); publish(); disconnect(); publishers.remove(publisher); model = null; rootIntent = null; receiverIntents = new JSONArray(); publication = ""; requests = "[]"; }
  private void revokeAll() {
    if (records.isEmpty() && lifetime.isEmpty()) return;
    for (Record record : records.values()) record.retire();
    records.clear(); lifetime = ""; epoch++; lastSnapshot = "";
  }
  private void removeRecord(String id) { Record record = records.remove(id); if (record != null) record.retire(); }
  private boolean active() { return committed && !mounting && resumed && manager != null && isAttachedToWindow() && hasWindowFocus() && UIManagerHelper.getSurfaceId(this) > 0; }
  private static boolean string(JSONObject object, String key) { return object != null && object.opt(key) instanceof String && !object.optString(key).isEmpty(); }
  private static int tag(JSONObject object, String key) {
    Object value = object == null ? null : object.opt(key);
    if (!(value instanceof Number)) return 0;
    double exact = ((Number)value).doubleValue();
    return Double.isFinite(exact) && exact > 0 && exact <= Integer.MAX_VALUE && exact == Math.floor(exact) ? (int)exact : 0;
  }
  private static boolean equal(JSONObject left, JSONObject right) { return left != null && right != null && left.toString().equals(right.toString()); }
  void setPublication(String value) {
    value = value == null ? "" : value;
    if (publication.equals(value)) return;
    publication = value; committed = false;
    try {
      JSONObject packet = new JSONObject(value), nextModel = packet.optJSONObject("model"), nextRoot = packet.optJSONObject("root");
      JSONArray items = nextModel == null ? null : nextModel.optJSONArray("items"), receivers = packet.optJSONArray("receivers");
      boolean valid = string(packet, "intent") && string(nextModel, "ownerId") && string(nextModel, "generation") && string(nextModel, "revision") &&
        items != null && string(nextRoot, "id") && tag(nextRoot, "tag") > 0 && receivers != null;
      Set<String> ids = new HashSet<>();
      if (valid) for (int i = 0; i < items.length(); i++) {
        JSONObject item = items.optJSONObject(i);
        if (!string(item, "itemId") || !string(item, "itemRevision") || !ids.add(item.optString("itemId"))) { valid = false; break; }
      }
      if (!valid || !equal(model, nextModel) || !equal(rootIntent, nextRoot)) revokeAll();
      model = valid ? nextModel : null; rootIntent = valid ? nextRoot : null; receiverIntents = valid ? receivers : new JSONArray();
    } catch (JSONException invalid) { revokeAll(); model = null; rootIntent = null; receiverIntents = new JSONArray(); }
  }
  void setActionRequests(String value) { requests = value == null ? "[]" : value; }
  private boolean member(JSONObject intent) {
    if (equal(intent, rootIntent)) return true;
    JSONArray items = model == null ? null : model.optJSONArray("items");
    if (items == null || !string(intent, "itemId") || !string(intent, "itemRevision")) return false;
    for (int i = 0; i < items.length(); i++) {
      JSONObject item = items.optJSONObject(i);
      if (item != null && item.optString("itemId").equals(intent.optString("itemId")) && item.optString("itemRevision").equals(intent.optString("itemRevision"))) return true;
    }
    return false;
  }
  private View resolveView(int target) {
    try { return manager == null ? null : manager.resolveView(target); } catch (RuntimeException unavailable) { return null; }
  }
  private boolean visible(View view) {
    if (view == null || !view.isAttachedToWindow() || !view.hasWindowFocus() || view.getWindowToken() != getWindowToken() || UIManagerHelper.getSurfaceId(view) != UIManagerHelper.getSurfaceId(this)) return false;
    for (View current = view; current != null;) {
      if (current.getVisibility() != View.VISIBLE || current.getAlpha() <= 0) return false;
      ViewParent parent = current.getParent(); current = parent instanceof View ? (View)parent : null;
    }
    Rect rectangle = new Rect(); return view.getGlobalVisibleRect(rectangle) && !rectangle.isEmpty();
  }
  private static boolean descendant(View view, View root) {
    if (view == root) return true;
    for (ViewParent parent = view == null ? null : view.getParent(); parent != null; parent = parent.getParent()) if (parent == root) return true;
    return false;
  }
  private boolean matches(Record record) {
    View view = record == null ? null : record.original.get();
    return active() && view != null && view.getId() == tag(record.intent, "tag") && resolveView(view.getId()) == view && record.window == getWindowToken() && visible(view);
  }
  private void reconcile() {
    if (model == null || !active()) { awaitingAcknowledgement = false; revokeAll(); publish(); return; }
    List<JSONObject> desired = new ArrayList<>(); desired.add(rootIntent);
    for (int i = 0; i < receiverIntents.length(); i++) if (receiverIntents.optJSONObject(i) != null) desired.add(receiverIntents.optJSONObject(i));
    Map<String, JSONObject> accepted = new LinkedHashMap<>(); Set<String> duplicates = new HashSet<>(), occurrences = new HashSet<>(); Set<Integer> tags = new HashSet<>();
    for (JSONObject intent : desired) {
      if (!string(intent, "id") || tag(intent, "tag") <= 0 || !member(intent)) continue;
      String id = intent.optString("id"), occurrence = equal(intent, rootIntent) ? "" : intent.optString("itemId");
      if (!tags.add(tag(intent, "tag")) || occurrences.contains(occurrence) || accepted.containsKey(id)) {
        duplicates.add(id);
        for (Map.Entry<String, JSONObject> previous : accepted.entrySet()) if (tag(previous.getValue(), "tag") == tag(intent, "tag") || previous.getValue().optString("itemId").equals(occurrence)) duplicates.add(previous.getKey());
      }
      occurrences.add(occurrence); accepted.put(id, intent);
    }
    for (String id : duplicates) accepted.remove(id);
    for (String id : new ArrayList<>(records.keySet())) if (!equal(accepted.get(id), records.get(id).intent) || !matches(records.get(id))) removeRecord(id);
    if (!records.containsKey(rootIntent.optString("id"))) revokeAll();
    try {
      for (JSONObject intent : desired) {
        String id = intent.optString("id");
        if (!accepted.containsKey(id) || records.containsKey(id)) continue;
        View view = resolveView(tag(intent, "tag"));
        if (view == this || !visible(view)) continue;
        Record root = records.get(rootIntent.optString("id"));
        if (!equal(intent, rootIntent) && (root == null || !descendant(view, root.original.get()))) continue;
        if (equal(intent, rootIntent)) { lifetime = newIdentity(); epoch++; }
        String lease = newIdentity();
        JSONObject binding = new JSONObject().put("publisher", publisher).put("lease", lease).put("ownerId", model.getString("ownerId"))
          .put("rootId", model.getString("generation")).put("rootRevision", model.getString("revision")).put("target", getId())
          .put("surfaceId", UIManagerHelper.getSurfaceId(this)).put("windowId", CUIInputWindow.identity(this)).put("epoch", epoch).put("sequence", epoch)
          .put("descriptorId", intent.optString("itemId")).put("descriptorRevision", intent.optString("itemRevision"));
        Record record = new Record(view, intent, binding.toString(), lease);
        record.listener = new View.OnAttachStateChangeListener() {
          @Override public void onViewAttachedToWindow(View original) {}
          @Override public void onViewDetachedFromWindow(View original) { originalChanged(original); }
        };
        records.put(id, record); view.addOnAttachStateChangeListener(record.listener);
      }
    } catch (JSONException invalid) { revokeAll(); }
    if (!records.containsKey(rootIntent.optString("id"))) revokeAll();
    awaitingAcknowledgement = records.size() < accepted.size();
    publish();
  }
  private void emit(String name, JSONObject packet) {
    if (!(getContext() instanceof ReactContext)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) return;
    WritableMap data = Arguments.createMap(); data.putString("data", packet.toString());
    dispatcher.dispatchEvent(new ReceiptEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data));
  }
  private void publish() {
    try {
      JSONArray registrations = new JSONArray();
      for (Map.Entry<String, Record> entry : records.entrySet()) registrations.put(new JSONObject().put("id", entry.getKey()).put("tag", tag(entry.getValue().intent, "tag")).put("binding", entry.getValue().binding));
      JSONObject packet = new JSONObject().put("intent", new JSONObject(publication.isEmpty() ? "{}" : publication).optString("intent"))
        .put("publisher", publisher).put("instance", instance).put("lifetime", lifetime).put("registrations", registrations);
      String signature = packet.toString(); if (signature.equals(lastSnapshot)) return;
      lastSnapshot = signature; packet.put("sequence", ++sequence); emit("topNativeCollectionCommit", packet);
    } catch (JSONException invalid) { /* Invalid publication never acknowledges a target. */ }
  }
  private Record resolve(String binding, int target) {
    if (!active() || rootIntent == null) return null;
    Record root = records.get(rootIntent.optString("id"));
    if (!matches(root)) { revokeAll(); awaitingAcknowledgement = true; publish(); return null; }
    for (String id : new ArrayList<>(records.keySet())) {
      Record record = records.get(id);
      if (!record.binding.equals(binding) || tag(record.intent, "tag") != target) continue;
      if (matches(record) && descendant(record.original.get(), root.original.get())) return record;
      removeRecord(id); awaitingAcknowledgement = true; publish(); return null;
    }
    return null;
  }
  void requestTextInputFocus(int target, String binding) {
    Record record = resolve(binding, target);
    View original = record == null ? null : record.original.get();
    if (original instanceof ReactEditText) ((ReactEditText)original).requestFocusFromJS();
  }
  private static CUICollectionRoot publisherFor(String binding) {
    try { WeakReference<CUICollectionRoot> reference = publishers.get(new JSONObject(binding).optString("publisher")); return reference == null ? null : reference.get(); }
    catch (JSONException | RuntimeException invalid) { return null; }
  }
  static boolean acceptsCurrentBinding(String binding, View original) {
    CUICollectionRoot publisher = publisherFor(binding); Record record = publisher == null || original == null ? null : publisher.resolve(binding, original.getId());
    return record != null && record.original.get() == original;
  }
  private void originalChanged(View original) {
    if (rootIntent == null) return;
    Record root = records.get(rootIntent.optString("id"));
    if (root != null && root.original.get() == original) revokeAll();
    else for (String id : new ArrayList<>(records.keySet())) if (records.get(id).original.get() == original) removeRecord(id);
    awaitingAcknowledgement = true; publish();
  }
  static void originalLifecycleChanged(View original) {
    for (WeakReference<CUICollectionRoot> reference : new ArrayList<>(publishers.values())) { CUICollectionRoot publisher = reference.get(); if (publisher != null) publisher.originalChanged(original); }
  }
  static Admission resolveCurrentOption(String binding, int target, View editor, CurrentFieldGuard field) {
    CUICollectionRoot publisher = publisherFor(binding); Record record = publisher == null ? null : publisher.resolve(binding, target);
    View option = record == null ? null : record.original.get();
    if (option == null || editor == null || field == null || !field.check() || !editor.isFocused() || !publisher.visible(editor) || editor.getWindowToken() != option.getWindowToken() || UIManagerHelper.getSurfaceId(editor) != UIManagerHelper.getSurfaceId(option)) return null;
    WeakReference<View> weakEditor = new WeakReference<>(editor), weakOption = new WeakReference<>(option);
    WeakReference<CUICollectionRoot> weakPublisher = new WeakReference<>(publisher);
    return new Admission(option, record.lease, () -> {
      View currentEditor = weakEditor.get(), currentOption = weakOption.get(); CUICollectionRoot currentPublisher = weakPublisher.get();
      if (currentEditor == null || currentOption == null || currentPublisher == null || !field.check() || !currentEditor.isFocused() || !currentPublisher.visible(currentEditor) || currentEditor.getWindowToken() != currentOption.getWindowToken() || UIManagerHelper.getSurfaceId(currentEditor) != UIManagerHelper.getSurfaceId(currentOption)) return false;
      Record current = currentPublisher.resolve(binding, target); return current != null && current.original.get() == currentOption;
    });
  }
  private void admitRequests() {
    try {
      JSONArray pending = new JSONArray(requests);
      for (int i = 0; i < pending.length(); i++) {
        JSONObject request = pending.optJSONObject(i); if (!string(request, "id") || !string(request, "binding")) continue;
        Object rawSequence = request.opt("sequence"); if (!(rawSequence instanceof Number)) continue;
        double value = ((Number)rawSequence).doubleValue();
        if (!Double.isFinite(value) || value <= lastRequestSequence || value > 9007199254740991d || value != Math.floor(value)) continue;
        lastRequestSequence = (long)value;
        boolean accepted = resolve(request.getString("binding"), tag(request, "target")) != null;
        emit("topNativeCollectionAction", new JSONObject().put("id", request.getString("id")).put("publisher", publisher).put("binding", request.getString("binding")).put("accepted", accepted));
      }
    } catch (JSONException invalid) { /* Invalid private requests fail closed. */ }
  }
  @Override public void willMountItems(UIManager candidate) { if (manager == candidate) mounting = true; }
  @Override public void didMountItems(UIManager candidate) { if (manager == candidate) { mounting = false; committed = true; reconcile(); admitRequests(); } }
  @Override public void willDispatchViewUpdates(UIManager manager) {}
  @Override public void didDispatchMountItems(UIManager candidate) {
    if (manager == candidate && active() && model != null && awaitingAcknowledgement && SystemClock.uptimeMillis() >= nextAvailabilityCheck) {
      nextAvailabilityCheck = SystemClock.uptimeMillis() + 100;
      reconcile();
    }
  }
  @Override public void didScheduleMountItems(UIManager manager) {}
  private static final class ReceiptEvent extends Event<ReceiptEvent> {
    private final WritableMap data; private final String name;
    ReceiptEvent(int surface, int tag, String name, WritableMap data) { super(surface, tag); this.name = name; this.data = data; }
    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
