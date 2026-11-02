package com.codonui.input;

import android.content.Context;
import android.graphics.Rect;
import android.view.MotionEvent;
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
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUIFormMetadataView extends ReactViewGroup implements UIManagerListener, LifecycleEventListener {
  String ownerId = "", descriptorId = "", descriptorRevision = "";
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
  String ownedControlBinding = "";
  private JSONObject mountSnapshot;
  private String lastMount = "unmounted";
  private boolean observing, resumed, lastActive;
  private SemanticContribution semanticContribution;
  private Runnable semanticRefresh;
  private String semanticOwner, semanticModule;
  private boolean refreshingSemantics;
  private WeakReference<View> semanticAXTarget = new WeakReference<>(null);
  private String semanticAXIdentity = "";
  private WeakReference<View> semanticAXReturnEditor = new WeakReference<>(null);
  private String semanticAXReturnOwner = "", semanticAXReturnDescriptor = "";

  void clearSemanticAccessibilityRequest() { semanticAXTarget.clear(); semanticAXIdentity = ""; }
  void resetSemanticAccessibilityFocus() {
    clearSemanticAccessibilityRequest();
    semanticAXReturnEditor.clear(); semanticAXReturnOwner = ""; semanticAXReturnDescriptor = "";
  }
  void requestSemanticAccessibilityFocus(View target, String identity, View editor, boolean returning) {
    if (target == null || editor == null || editor != original.get() || !editor.isFocused() || !editor.hasWindowFocus() ||
        !CUIInputWindow.identity(target).equals(CUIInputWindow.identity(editor)) ||
        (returning && (target != editor || semanticAXReturnEditor.get() != editor ||
          !semanticAXReturnOwner.equals(ownerId) || !semanticAXReturnDescriptor.equals(descriptorId))) ||
        (semanticAXTarget.get() == target && semanticAXIdentity.equals(identity))) return;
    if (target.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)) {
      semanticAXTarget = new WeakReference<>(target); semanticAXIdentity = identity;
      // SDK acceptance is request history, not observed TalkBack focus.
      semanticAXReturnEditor = new WeakReference<>(returning ? null : editor);
      semanticAXReturnOwner = returning ? "" : ownerId;
      semanticAXReturnDescriptor = returning ? "" : descriptorId;
    } else resetSemanticAccessibilityFocus();
  }

  void setSemanticBinding(String value) {
    if (semanticBinding.equals(value)) return;
    setSemanticContribution(null); semanticBinding = value;
    if (value.isEmpty()) resetSemanticAccessibilityFocus();
  }
  void setSemanticContribution(SemanticContribution value) {
    if (semanticContribution == value) return;
    if (semanticContribution != null) semanticContribution.retire();
    semanticContribution = value;
  }
  void setSemanticRefresh(Runnable refresh, String owner, String module) {
    if (!module.equals(semanticModule)) resetSemanticAccessibilityFocus();
    semanticModule = module;
    setSemanticContribution(null); semanticOwner = owner; semanticRefresh = refresh; refreshSemantics();
  }
  void clearSemanticRefresh(String owner, boolean retiring) {
    if (semanticOwner == null || !semanticOwner.equals(owner)) return;
    setSemanticContribution(null); semanticRefresh = null; semanticOwner = null;
    // Ordinary same-editor data revisions replace the watch before the next bind.
    if (retiring) resetSemanticAccessibilityFocus();
  }
  void refreshSemantics() {
    if (semanticRefresh == null || refreshingSemantics) return;
    refreshingSemantics = true;
    try { semanticRefresh.run(); }
    catch (RuntimeException retired) { setSemanticContribution(null); resetSemanticAccessibilityFocus(); }
    finally { refreshingSemantics = false; }
  }
  CUIFormMetadataView(Context context, boolean fieldBinding) { super(context); this.fieldBinding = fieldBinding; enforceMetadata(); }
  boolean isFieldBinding() { return fieldBinding; }

  void enforceMetadata() {
    setAlpha(0); setFocusable(false); setFocusableInTouchMode(false); setClickable(false); setLongClickable(false);
    setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    setRemoveClippedSubviews(false);
  }
  boolean isMetadataOnly() {
    return getAlpha() == 0 && getWidth() == 0 && getHeight() == 0 && !isFocusable() && !isClickable()
      && getImportantForAccessibility() == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS;
  }
  @Override public boolean requestFocus(int direction, Rect previous) { return false; }
  @Override public boolean dispatchTouchEvent(MotionEvent event) { return false; }
  @Override public void addChildrenForAccessibility(ArrayList<View> children) {}

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
    publish(true, lastMount);
  }
  @Override protected void onDetachedFromWindow() {
    setSemanticContribution(null);
    resetSemanticAccessibilityFocus();
    publish(false, "detached"); disconnect(); epoch++; signature = ""; super.onDetachedFromWindow();
  }
  void retire() {
    setSemanticContribution(null); resetSemanticAccessibilityFocus(); semanticRefresh = null; semanticOwner = null;
    publish(false, "retired"); disconnect(); epoch++; signature = ""; identity = ""; original.clear();
    ownerId = ""; descriptorId = ""; descriptorRevision = ""; originalTarget = 0;
    mountSnapshot = null; lastMount = "retired"; lastActive = false;
    semanticBinding = ""; ownedEditorBinding = ""; ownedControlBinding = "";
    resetSemanticAccessibilityFocus();
  }

  JSONObject formMountSnapshot() throws Exception {
    publish(isAttachedToWindow(), lastMount);
    return mountSnapshot == null ? null : new JSONObject(mountSnapshot.toString());
  }
  View originalForAttachedMountSnapshot(JSONObject expected) throws Exception {
    JSONObject current = formMountSnapshot();
    return CUIFormActionAdmission.same(expected, current) && current.getBoolean("complete") && current.getBoolean("attached") ? original.get() : null;
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

  private static boolean strictDescendant(View child, View root) {
    for (View parent = child.getParent() instanceof View ? (View)child.getParent() : null; parent != null;
        parent = parent.getParent() instanceof View ? (View)parent.getParent() : null) if (parent == root) return true;
    return false;
  }
  private boolean isOwnedRangeThumb(View target, int currentSurface) {
    try {
      if (!(target instanceof CUIFocusView) || !ownedEditorBinding.isEmpty() || !semanticBinding.isEmpty() || currentSurface <= 0) return false;
      JSONObject value = new JSONObject(ownedControlBinding);
      if (value.length() != 2 || !"range-thumb".equals(value.get("kind"))) return false;
      Object tag = value.get("rootTarget");
      if (!(tag instanceof Number)) return false;
      double number = ((Number)tag).doubleValue();
      if (!Double.isFinite(number) || number <= 0 || number > Integer.MAX_VALUE || Math.floor(number) != number) return false;
      View root = manager.resolveView((int)number);
      Object role = target.getTag(com.facebook.react.R.id.role);
      if (role == null) role = target.getTag(com.facebook.react.R.id.accessibility_role);
      boolean adjustable = role != null && ("adjustable".equalsIgnoreCase(role.toString()) || "slider".equalsIgnoreCase(role.toString()));
      return root instanceof ReactViewGroup && !(root instanceof CUIFormMetadataView) && !(root instanceof CUIDateSegment) &&
        root != target && root.isAttachedToWindow() && CUIInputWindow.identity(this).equals(CUIInputWindow.identity(root)) &&
        strictDescendant(target, root) && strictDescendant(this, target) && adjustable;
    } catch (Exception retired) { return false; }
  }
  private void publish(boolean attached, String mountRevision) {
    if (ownerId == null || ownerId.isEmpty() || descriptorId.isEmpty() || descriptorRevision.isEmpty()) { mountSnapshot = null; resetSemanticAccessibilityFocus(); return; }
    attached &= isAttachedToWindow();
    String currentWindow = attached ? CUIInputWindow.identity(this) : window;
    View target = null;
    if (attached && originalTarget > 0 && manager != null) {
      try { target = manager.resolveView(originalTarget); } catch (RuntimeException unavailable) { target = null; }
    }
    int currentSurface = UIManagerHelper.getSurfaceId(this);
    String currentIdentity = new JSONArray().put(ownerId).put(descriptorId).put(descriptorRevision).put(originalTarget).put(ownedEditorBinding).put(ownedControlBinding).toString();
    if (!window.equals(currentWindow) || original.get() != target || surface != currentSurface ||
        (semanticAXReturnEditor.get() != null && (!semanticAXReturnOwner.equals(ownerId) || !semanticAXReturnDescriptor.equals(descriptorId))))
      resetSemanticAccessibilityFocus();
    if (!window.equals(currentWindow) || original.get() != target || !identity.equals(currentIdentity) || surface != currentSurface) {
      epoch++; window = currentWindow; original = new WeakReference<>(target); identity = currentIdentity; surface = currentSurface;
    }
    boolean ownedDate = fieldBinding && !ownedEditorBinding.isEmpty();
    boolean ownedControl = fieldBinding && !ownedControlBinding.isEmpty();
    boolean correctType = ownedControl ? isOwnedRangeThumb(target, currentSurface) : ownedDate ? target != null && CUIOwnedDateField.resolve(manager, this, ownedEditorBinding, originalTarget, currentSurface) == target :
      fieldBinding ? target instanceof ReactEditText : target instanceof ReactViewGroup && !(target instanceof CUIFormMetadataView);
    boolean metadataOnly = isMetadataOnly();
    boolean complete = attached && surface > 0 && !window.isEmpty() && target != null && target.isAttachedToWindow()
      && window.equals(CUIInputWindow.identity(target)) && correctType && metadataOnly;
    boolean active = complete && resumed && getContext() instanceof ReactContext && ((ReactContext)getContext()).getLifecycleState() == LifecycleState.RESUMED
      && target.hasWindowFocus() && target.isShown() && target.getWindowVisibility() == View.VISIBLE;
    for (View view = target; view != null && active; view = view.getParent() instanceof View ? (View)view.getParent() : null) active &= view.getAlpha() > 0;
    if (!active) resetSemanticAccessibilityFocus();
    if (lastActive != active) { lastActive = active; epoch++; }
    String error = !attached ? "form-metadata-detached" : target == null ? "form-original-target-unavailable" :
      !correctType ? "form-original-type-mismatch" : !metadataOnly ? "form-metadata-not-inert" : !complete ? "form-metadata-incomplete" : "";
    String originalClass = target == null ? "" : target.getClass().getName();
    String nextSignature = new JSONArray().put(identity).put(semanticBinding).put(getId()).put(surface).put(window).put(epoch)
      .put(attached).put(active).put(complete).put(metadataOnly).put(originalClass).put(error).toString();
    if (signature.equals(nextSignature)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) { mountSnapshot = null; resetSemanticAccessibilityFocus(); return; }
    signature = nextSignature;
    lastMount = mountRevision;
    sequence++;
    try {
      mountSnapshot = new JSONObject().put("ownerId", ownerId).put("descriptorId", descriptorId).put("descriptorRevision", descriptorRevision)
        .put("target", getId()).put("originalTarget", originalTarget).put("surfaceId", surface).put("windowId", window)
        .put("epoch", epoch).put("sequence", sequence).put("mountRevision", mountRevision).put("attached", attached).put("active", active)
        .put("complete", complete).put("metadataOnly", metadataOnly).put("originalClass", originalClass).put("error", error);
    } catch (org.json.JSONException invalid) { mountSnapshot = null; resetSemanticAccessibilityFocus(); return; }
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId); data.putString("descriptorId", descriptorId); data.putString("descriptorRevision", descriptorRevision);
    data.putInt("target", getId()); data.putInt("originalTarget", originalTarget); data.putInt("surfaceId", surface);
    data.putString("windowId", window); data.putDouble("epoch", epoch); data.putDouble("sequence", sequence);
    data.putString("mountRevision", mountRevision); data.putBoolean("attached", attached); data.putBoolean("complete", complete);
    data.putBoolean("metadataOnly", metadataOnly); data.putString("originalClass", originalClass); data.putString("error", error);
    data.putBoolean("active", active);
    dispatcher.dispatchEvent(new CommitEvent(surface, getId(), data));
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
