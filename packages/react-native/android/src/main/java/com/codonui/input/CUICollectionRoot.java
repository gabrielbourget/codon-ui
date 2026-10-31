package com.codonui.input;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUICollectionRoot extends CUICollectionNode implements UIManagerListener {
  String rootRevision = "";
  String inspectionRequest = "";
  String actionRequests = "[]";
  private long lastActionSequence;
  private UIManager manager;
  private String boundWindow = "", lastSignature = "";
  private String inspectedRequest = "";
  private boolean lastComplete;
  private long epoch, sequence, mountBatch;

  CUICollectionRoot(Context context) { super(context); }

  private void connect() {
    if (manager != null || !isAttachedToWindow() || !(getContext() instanceof ReactContext)) return;
    manager = UIManagerHelper.getUIManagerForReactTag((ReactContext)getContext(), getId());
    if (manager != null) manager.addUIManagerEventListener(this);
  }

  private void disconnect() {
    if (manager != null) manager.removeUIManagerEventListener(this);
    manager = null;
  }

  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow(); epoch++; boundWindow = CUIInputWindow.identity(this); lastSignature = ""; connect();
  }

  @Override protected void onDetachedFromWindow() {
    publish(false, "detached"); disconnect(); epoch++; lastSignature = ""; super.onDetachedFromWindow();
  }

  void retire() {
    if (isAttachedToWindow()) publish(false, "retired");
    disconnect(); epoch++; ownerId = ""; rootId = ""; rootRevision = ""; lastSignature = "";
    inspectionRequest = ""; inspectedRequest = ""; lastComplete = false;
    actionRequests = "[]"; lastActionSequence = 0;
  }

  private boolean collect(CUICollectionNode parent, String parentId, JSONArray nodes, Set<String> ids) throws JSONException {
    int position = 0;
    boolean metadataOnly = parent.isMetadataOnly();
    for (int index = 0; index < parent.getChildCount(); index++) {
      View child = parent.getChildAt(index);
      if (!(child instanceof CUICollectionNode) || child instanceof CUICollectionRoot) throw new IllegalStateException("non-metadata-child");
      CUICollectionNode node = (CUICollectionNode)child;
      metadataOnly &= node.isMetadataOnly();
      if (!ownerId.equals(node.ownerId) || !rootId.equals(node.rootId)) throw new IllegalStateException("metadata-owner-mismatch");
      // Fabric retains display:none nodes as INVISIBLE on the locked Android renderer.
      if (node.getVisibility() != View.VISIBLE) continue;
      if (node.descriptorId.isEmpty() || node.descriptorRevision.isEmpty() || !ids.add(node.descriptorId)) throw new IllegalStateException("invalid-descriptor-identity");
      nodes.put(new JSONObject().put("descriptorId", node.descriptorId).put("descriptorRevision", node.descriptorRevision)
        .put("parentDescriptorId", parentId).put("target", node.getId()).put("index", position++).put("retainedIndex", index)
        .put("hasRetainedChildren", node.getChildCount() > 0));
      metadataOnly &= collect(node, node.descriptorId, nodes, ids);
    }
    return metadataOnly;
  }

  private void publish(boolean attached, String mountRevision) {
    if (ownerId.isEmpty() || rootId.isEmpty() || rootRevision.isEmpty()) return;
    attached &= isAttachedToWindow();
    String currentWindow = attached ? CUIInputWindow.identity(this) : boundWindow;
    if (attached && !currentWindow.equals(boundWindow)) { epoch++; boundWindow = currentWindow; lastSignature = ""; }
    JSONArray nodes = new JSONArray(); boolean metadataOnly = false, complete = attached; String error = "";
    try {
      if (attached && getVisibility() == View.VISIBLE) metadataOnly = collect(this, "", nodes, new HashSet<>());
      else if (attached) { complete = false; error = "metadata-root-hidden"; }
    } catch (JSONException | IllegalStateException exception) { complete = false; error = exception.getMessage(); }
    if (!attached) error = "metadata-root-detached";
    int surface = UIManagerHelper.getSurfaceId(this);
    if (surface < 0 || currentWindow.isEmpty()) { complete = false; error = "metadata-root-without-surface-or-window"; }
    lastComplete = complete;
    String hierarchy = nodes.toString();
    String signature;
    try {
      signature = new JSONArray().put(ownerId).put(rootId).put(rootRevision).put(getId()).put(surface).put(currentWindow)
        .put(epoch).put(attached).put(complete).put(metadataOnly).put(hierarchy).put(error).toString();
    } catch (RuntimeException exception) { return; }
    if (signature.equals(lastSignature)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) return;
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId); data.putString("rootId", rootId); data.putString("rootRevision", rootRevision);
    data.putInt("target", getId()); data.putInt("surfaceId", surface); data.putString("windowId", currentWindow);
    data.putDouble("epoch", epoch); data.putDouble("sequence", ++sequence); data.putString("mountRevision", mountRevision);
    data.putBoolean("attached", attached); data.putBoolean("complete", complete); data.putBoolean("metadataOnly", metadataOnly);
    data.putString("hierarchy", hierarchy); data.putString("error", error);
    lastSignature = signature;
    dispatcher.dispatchEvent(new CommitEvent(surface, getId(), "topNativeCollectionCommit", data));
  }

  @SuppressWarnings("deprecation")
  private JSONObject inspectView(CUICollectionNode node) throws JSONException {
    AccessibilityNodeInfo accessibility = node.createAccessibilityNodeInfo();
    JSONArray actions = new JSONArray();
    for (AccessibilityNodeInfo.AccessibilityAction action : accessibility.getActionList()) actions.put(action.getId());
    ArrayList<View> parentChildren = new ArrayList<>();
    if (node.getParent() instanceof ViewGroup) ((ViewGroup)node.getParent()).addChildrenForAccessibility(parentChildren);
    JSONArray accessibleSiblings = new JSONArray();
    for (View child : parentChildren) accessibleSiblings.put(child.getId());
    JSONObject result = new JSONObject().put("target", node.getId()).put("className", node.getClass().getName())
      .put("descriptorId", node.descriptorId).put("descriptorRevision", node.descriptorRevision)
      .put("alpha", node.getAlpha()).put("width", node.getWidth()).put("height", node.getHeight())
      .put("visibility", node.getVisibility()).put("focused", node.isFocused()).put("focusable", node.isFocusable())
      .put("clickable", node.isClickable()).put("focusCandidates", node.getFocusables(View.FOCUS_FORWARD).size())
      .put("touchCandidates", node.getTouchables().size()).put("importantForAccessibility", node.getImportantForAccessibility())
      .put("accessibleChildren", accessibility.getChildCount()).put("accessibilityFocusable", accessibility.isFocusable())
      .put("accessibilityClickable", accessibility.isClickable()).put("accessibilityVisible", accessibility.isVisibleToUser())
      .put("accessibilityActions", actions).put("parentAccessibleTargets", accessibleSiblings);
    accessibility.recycle();
    JSONArray children = new JSONArray();
    for (int index = 0; index < node.getChildCount(); index++) {
      View child = node.getChildAt(index);
      if (!(child instanceof CUICollectionNode)) throw new IllegalStateException("non-metadata-inspection-child");
      children.put(inspectView((CUICollectionNode)child));
    }
    return result.put("children", children);
  }

  private void inspectRequested() {
    if (inspectionRequest.isEmpty() || inspectionRequest.equals(inspectedRequest)) return;
    inspectedRequest = inspectionRequest;
    String requestId = "", error = ""; boolean accepted = false; JSONObject inspection = new JSONObject();
    int surface = UIManagerHelper.getSurfaceId(this);
    try {
      JSONObject request = new JSONObject(inspectionRequest);
      if (!(request.opt("requestId") instanceof String)) throw new IllegalStateException("metadata-inspection-invalid-request");
      requestId = request.getString("requestId");
      if (requestId.isEmpty() || ownerId.isEmpty() || rootId.isEmpty() || rootRevision.isEmpty()
        || !ownerId.equals(request.getString("ownerId")) || !rootId.equals(request.getString("rootId"))
        || !rootRevision.equals(request.getString("rootRevision")) || !matchesNumber(request, "target", getId())
        || !matchesNumber(request, "surfaceId", surface) || !boundWindow.equals(request.getString("windowId"))
        || !matchesNumber(request, "epoch", epoch) || !matchesNumber(request, "sequence", sequence)
        || !lastComplete || !isAttachedToWindow() || !boundWindow.equals(CUIInputWindow.identity(this))) {
        throw new IllegalStateException("metadata-inspection-stale");
      }
      inspection.put("tree", inspectView(this));
      View focusedBefore = getRootView().findFocus();
      boolean focusResult = requestFocus(View.FOCUS_FORWARD);
      View focusedAfter = getRootView().findFocus();
      inspection.put("focusRequestAccepted", focusResult).put("focusedBefore", focusedBefore == null ? -1 : focusedBefore.getId())
        .put("focusedAfter", focusedAfter == null ? -1 : focusedAfter.getId());
      accepted = true;
    } catch (JSONException | IllegalStateException exception) { error = exception.getMessage(); }
    WritableMap data = Arguments.createMap();
    data.putString("requestId", requestId); data.putString("ownerId", ownerId); data.putString("rootId", rootId);
    data.putString("rootRevision", rootRevision); data.putInt("target", getId()); data.putInt("surfaceId", surface);
    data.putString("windowId", boundWindow); data.putDouble("epoch", epoch); data.putDouble("sequence", sequence);
    data.putBoolean("accepted", accepted); data.putString("inspection", inspection.toString()); data.putString("error", error);
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new CommitEvent(surface, getId(), "topNativeCollectionInspection", data));
  }

  boolean acceptsPointerBinding(String serialized, int visibleTarget) {
    try { return acceptsAction(new JSONObject(serialized), serialized, visibleTarget); }
    catch (JSONException invalid) { return false; }
  }

  private boolean acceptsAction(JSONObject binding, String serialized, int visibleTarget) throws JSONException {
    int surface = UIManagerHelper.getSurfaceId(this);
    if (!lastComplete || !isAttachedToWindow() || !hasWindowFocus() || getVisibility() != View.VISIBLE
      || ownerId.isEmpty() || rootId.isEmpty() || rootRevision.isEmpty()
      || !ownerId.equals(binding.getString("ownerId")) || !rootId.equals(binding.getString("rootId"))
      || !rootRevision.equals(binding.getString("rootRevision")) || !matchesNumber(binding, "target", getId())
      || !matchesNumber(binding, "surfaceId", surface) || !boundWindow.equals(binding.getString("windowId"))
      || !boundWindow.equals(CUIInputWindow.identity(this)) || !matchesNumber(binding, "epoch", epoch)
      || !matchesNumber(binding, "sequence", sequence)) return false;
    View visible = getRootView().findViewById(visibleTarget);
    if (!(visible instanceof CUIFocusView) || !visible.isAttachedToWindow() || !visible.isShown()
      || !boundWindow.equals(CUIInputWindow.identity(visible)) || !serialized.equals(((CUIFocusView)visible).nativeCollectionBinding)) return false;
    JSONArray nodes = new JSONArray();
    if (!collect(this, "", nodes, new HashSet<>())) return false;
    String descriptor = binding.getString("descriptorId");
    if (descriptor.isEmpty()) return binding.getString("descriptorRevision").isEmpty() && matchesNumber(binding, "metadataTarget", getId());
    for (int index = 0; index < nodes.length(); index++) {
      JSONObject node = nodes.getJSONObject(index);
      if (descriptor.equals(node.getString("descriptorId")) && binding.getString("descriptorRevision").equals(node.getString("descriptorRevision"))
        && matchesNumber(binding, "metadataTarget", node.getInt("target"))) return true;
    }
    return false;
  }

  private void admitRequestedActions() {
    JSONArray requests;
    try { requests = new JSONArray(actionRequests); } catch (JSONException exception) { return; }
    for (int index = 0; index < requests.length(); index++) {
      try {
        JSONObject request = requests.getJSONObject(index);
        Object rawSequence = request.opt("actionSequence");
        if (!(rawSequence instanceof Number)) continue;
        double number = ((Number)rawSequence).doubleValue();
        if (!Double.isFinite(number) || number != Math.floor(number) || number <= lastActionSequence || number > 9007199254740991d) continue;
        long actionSequence = (long)number;
        String requestId = request.getString("requestId");
        if (!requestId.equals(rootRevision + ":action:" + actionSequence)) continue;
        lastActionSequence = actionSequence;
        int visibleTarget = request.getInt("visibleTarget");
        String binding = request.getString("binding");
        boolean accepted = false;
        try { accepted = visibleTarget > 0 && acceptsAction(new JSONObject(binding), binding, visibleTarget); }
        catch (JSONException | IllegalStateException exception) { accepted = false; }
        WritableMap data = Arguments.createMap();
        data.putString("requestId", requestId); data.putString("ownerId", ownerId); data.putString("rootId", rootId);
        data.putString("rootRevision", rootRevision); data.putInt("target", getId());
        data.putInt("surfaceId", UIManagerHelper.getSurfaceId(this)); data.putString("windowId", boundWindow);
        data.putDouble("epoch", epoch); data.putDouble("sequence", sequence); data.putInt("visibleTarget", visibleTarget);
        data.putBoolean("accepted", accepted);
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
        if (dispatcher != null) dispatcher.dispatchEvent(new CommitEvent(UIManagerHelper.getSurfaceId(this), getId(), "topNativeCollectionAction", data));
      } catch (JSONException exception) { /* Malformed private requests never admit an action. */ }
    }
  }

  private static boolean matchesNumber(JSONObject request, String key, long expected) {
    Object value = request.opt(key);
    return value instanceof Number && Double.isFinite(((Number)value).doubleValue()) && ((Number)value).doubleValue() == expected;
  }

  @Override public void didMountItems(UIManager manager) {
    if (this.manager == manager) { publish(true, "android-ui-mount-batch:" + ++mountBatch); inspectRequested(); admitRequestedActions(); }
  }
  @Override public void willDispatchViewUpdates(UIManager manager) {}
  @Override public void willMountItems(UIManager manager) {}
  @Override public void didDispatchMountItems(UIManager manager) {}
  @Override public void didScheduleMountItems(UIManager manager) {}

  private static final class CommitEvent extends Event<CommitEvent> {
    private final WritableMap data;
    private final String name;
    CommitEvent(int surface, int tag, String name, WritableMap data) { super(surface, tag); this.name = name; this.data = data; }
    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
