package com.codonui.input;

import android.content.Context;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.common.LifecycleState;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUIFormMetadataView extends CUICollectionNode implements UIManagerListener, LifecycleEventListener {
  interface SemanticContribution { void retire(); }
  int originalTarget;
  String semanticBinding = "";
  private final boolean fieldBinding;
  private UIManager manager;
  private WeakReference<View> original = new WeakReference<>(null);
  private String window = "", identity = "", signature = "";
  private int surface = -1;
  private long epoch, sequence, mountBatch;
  String ownedEditorBinding = "";
  String fieldGroupBinding = "";
  private Runnable fieldInputRefresh;
  private String fieldInputOwner;
  private JSONObject mountSnapshot;
  private String lastMount = "unmounted";
  private boolean observing, resumed, lastActive;
  private SemanticContribution semanticContribution;
  private Runnable semanticRefresh;
  private String semanticOwner;
  private boolean refreshingSemantics;
  private WeakReference<View> semanticAXTarget = new WeakReference<>(null);
  private String semanticAXIdentity = "";

  void resetSemanticAccessibilityFocus() { semanticAXTarget.clear(); semanticAXIdentity = ""; }
  void requestSemanticAccessibilityFocus(View target, String identity, boolean returning) {
    if (target == null || !target.hasWindowFocus() || (returning && semanticAXTarget.get() == null) ||
        (semanticAXTarget.get() == target && semanticAXIdentity.equals(identity))) return;
    semanticAXTarget = new WeakReference<>(target); semanticAXIdentity = identity;
    target.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null);
  }

  void setSemanticBinding(String value) {
    if (semanticBinding.equals(value)) return;
    setSemanticContribution(null); semanticBinding = value;
  }
  void setSemanticContribution(SemanticContribution value) {
    if (semanticContribution == value) return;
    if (semanticContribution != null) semanticContribution.retire();
    semanticContribution = value;
  }
  void setSemanticRefresh(Runnable refresh, String owner) {
    setSemanticContribution(null); semanticOwner = owner; semanticRefresh = refresh; refreshSemantics();
  }
  void clearSemanticRefresh(String owner) {
    if (semanticOwner == null || !semanticOwner.equals(owner)) return;
    setSemanticContribution(null); semanticRefresh = null; semanticOwner = null;
  }
  void refreshSemantics() {
    if (semanticRefresh == null || refreshingSemantics) return;
    refreshingSemantics = true;
    try { semanticRefresh.run(); }
    catch (RuntimeException retired) { setSemanticContribution(null); }
    finally { refreshingSemantics = false; }
  }
  void setFieldInputRefresh(Runnable refresh, String owner) { fieldInputRefresh = refresh; fieldInputOwner = owner; if (refresh != null) refresh.run(); }
  void clearFieldInputRefresh(String owner) { if (owner.equals(fieldInputOwner)) { fieldInputRefresh = null; fieldInputOwner = null; } }
  void emitFieldInputRecord(String record) {
    if (!fieldBinding || !(getContext() instanceof ReactContext)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) return;
    WritableMap data = Arguments.createMap(); data.putString("record", record);
    dispatcher.dispatchEvent(new FieldInputRecordEvent(UIManagerHelper.getSurfaceId(this), getId(), data));
  }
  private static final class FieldInputRecordEvent extends Event<FieldInputRecordEvent> {
    private final WritableMap data;
    FieldInputRecordEvent(int surface, int tag, WritableMap data) { super(surface, tag); this.data = data; }
    @Override public String getEventName() { return "topNativeFieldInputRecord"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }

  CUIFormMetadataView(Context context, boolean fieldBinding) { super(context); this.fieldBinding = fieldBinding; }
  boolean isFieldBinding() { return fieldBinding; }

  private void connect() {
    if (manager != null || !isAttachedToWindow() || !(getContext() instanceof ReactContext)) return;
    manager = UIManagerHelper.getUIManagerForReactTag((ReactContext)getContext(), getId());
    if (manager != null) manager.addUIManagerEventListener(this);
    ReactContext context = (ReactContext)getContext();
    if (!observing) {
      resumed = context.getLifecycleState() == LifecycleState.RESUMED;
      observing = true; context.addLifecycleEventListener(this);
    }
  }
  private void disconnect() {
    if (manager != null) manager.removeUIManagerEventListener(this);
    manager = null;
    if (observing && getContext() instanceof ReactContext) ((ReactContext)getContext()).removeLifecycleEventListener(this);
    observing = false;
  }
  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow(); epoch++; window = CUIInputWindow.identity(this); signature = ""; connect();
  }
  @Override protected void onDetachedFromWindow() {
    setSemanticContribution(null);
    resetSemanticAccessibilityFocus();
    publish(false, "detached"); disconnect(); epoch++; signature = ""; super.onDetachedFromWindow();
  }
  void retire() {
    fieldInputRefresh = null; fieldInputOwner = null;
    setSemanticContribution(null); semanticRefresh = null; semanticOwner = null;
    publish(false, "retired"); disconnect(); epoch++; signature = ""; identity = ""; original.clear();
    ownerId = ""; descriptorId = ""; descriptorRevision = ""; originalTarget = 0;
    mountSnapshot = null; lastMount = "retired"; lastActive = false;
    semanticBinding = ""; ownedEditorBinding = ""; fieldGroupBinding = "";
    resetSemanticAccessibilityFocus();
  }

  JSONObject formMountSnapshot() throws Exception {
    publish(isAttachedToWindow(), lastMount);
    return mountSnapshot == null ? null : new JSONObject(mountSnapshot.toString());
  }
  View originalForMountSnapshot(JSONObject expected) throws Exception {
    JSONObject current = formMountSnapshot();
    return CUIFormActionAdmission.same(expected, current) && current.getBoolean("complete") && current.getBoolean("active") ? original.get() : null;
  }
  @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); publish(isAttachedToWindow(), lastMount); refreshSemantics(); }
  @Override protected void onWindowVisibilityChanged(int visibility) { super.onWindowVisibilityChanged(visibility); publish(isAttachedToWindow(), lastMount); refreshSemantics(); }
  @Override public void onHostResume() { resumed = true; publish(isAttachedToWindow(), lastMount); refreshSemantics(); }
  @Override public void onHostPause() { resumed = false; publish(isAttachedToWindow(), lastMount); refreshSemantics(); }
  @Override public void onHostDestroy() { resumed = false; setSemanticContribution(null); publish(false, "retired"); disconnect(); }

  private void publish(boolean attached, String mountRevision) {
    if (ownerId == null || ownerId.isEmpty() || descriptorId.isEmpty() || descriptorRevision.isEmpty()) { mountSnapshot = null; return; }
    attached &= isAttachedToWindow();
    String currentWindow = attached ? CUIInputWindow.identity(this) : window;
    View target = null;
    if (attached && originalTarget > 0 && manager != null) {
      try { target = manager.resolveView(originalTarget); } catch (RuntimeException unavailable) { target = null; }
    }
    int currentSurface = UIManagerHelper.getSurfaceId(this);
    String currentIdentity = new JSONArray().put(ownerId).put(descriptorId).put(descriptorRevision).put(originalTarget).put(ownedEditorBinding).toString();
    if (!window.equals(currentWindow) || original.get() != target || !identity.equals(currentIdentity) || surface != currentSurface) {
      epoch++; window = currentWindow; original = new WeakReference<>(target); identity = currentIdentity; surface = currentSurface;
    }
    boolean ownedDate = fieldBinding && !ownedEditorBinding.isEmpty();
    boolean correctType = ownedDate ? target != null && CUIOwnedDateField.resolve(manager, this, ownedEditorBinding, originalTarget, currentSurface) == target :
      fieldBinding ? target instanceof ReactEditText : target instanceof ReactViewGroup && !(target instanceof CUICollectionNode);
    boolean metadataOnly = isMetadataOnly();
    boolean complete = attached && surface > 0 && !window.isEmpty() && target != null && target.isAttachedToWindow()
      && window.equals(CUIInputWindow.identity(target)) && correctType && metadataOnly;
    boolean active = complete && resumed && getContext() instanceof ReactContext && ((ReactContext)getContext()).getLifecycleState() == LifecycleState.RESUMED
      && target.hasWindowFocus() && target.isShown() && target.getWindowVisibility() == View.VISIBLE;
    for (View view = target; view != null && active; view = view.getParent() instanceof View ? (View)view.getParent() : null) active &= view.getAlpha() > 0;
    if (lastActive != active) { lastActive = active; epoch++; }
    String error = !attached ? "form-metadata-detached" : target == null ? "form-original-target-unavailable" :
      !correctType ? "form-original-type-mismatch" : !metadataOnly ? "form-metadata-not-inert" : !complete ? "form-metadata-incomplete" : "";
    String originalClass = target == null ? "" : target.getClass().getName();
    String nextSignature = new JSONArray().put(identity).put(semanticBinding).put(getId()).put(surface).put(window).put(epoch)
      .put(attached).put(active).put(complete).put(metadataOnly).put(originalClass).put(error).toString();
    if (signature.equals(nextSignature)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) { mountSnapshot = null; return; }
    signature = nextSignature;
    lastMount = mountRevision;
    sequence++;
    try {
      mountSnapshot = new JSONObject().put("ownerId", ownerId).put("descriptorId", descriptorId).put("descriptorRevision", descriptorRevision)
        .put("target", getId()).put("originalTarget", originalTarget).put("surfaceId", surface).put("windowId", window)
        .put("epoch", epoch).put("sequence", sequence).put("mountRevision", mountRevision).put("attached", attached).put("active", active)
        .put("complete", complete).put("metadataOnly", metadataOnly).put("originalClass", originalClass).put("error", error);
    } catch (org.json.JSONException invalid) { mountSnapshot = null; return; }
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId); data.putString("descriptorId", descriptorId); data.putString("descriptorRevision", descriptorRevision);
    data.putInt("target", getId()); data.putInt("originalTarget", originalTarget); data.putInt("surfaceId", surface);
    data.putString("windowId", window); data.putDouble("epoch", epoch); data.putDouble("sequence", sequence);
    data.putString("mountRevision", mountRevision); data.putBoolean("attached", attached); data.putBoolean("complete", complete);
    data.putBoolean("metadataOnly", metadataOnly); data.putString("originalClass", originalClass); data.putString("error", error);
    data.putBoolean("active", active);
    dispatcher.dispatchEvent(new CommitEvent(surface, getId(), data));
    if (fieldInputRefresh != null) fieldInputRefresh.run();
  }
  @Override public void didMountItems(UIManager manager) { if (this.manager == manager) { publish(true, "android-ui-mount-batch:" + ++mountBatch); refreshSemantics(); } }
  @Override public void willDispatchViewUpdates(UIManager manager) {}
  @Override public void willMountItems(UIManager manager) {}
  @Override public void didDispatchMountItems(UIManager manager) {}
  @Override public void didScheduleMountItems(UIManager manager) {}

  private static final class CommitEvent extends Event<CommitEvent> {
    private final WritableMap data;
    CommitEvent(int surface, int tag, WritableMap data) { super(surface, tag); this.data = data; }
    @Override public String getEventName() { return "topNativeFormCommit"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
