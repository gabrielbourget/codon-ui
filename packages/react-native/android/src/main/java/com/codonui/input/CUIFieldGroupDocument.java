package com.codonui.input;

import android.graphics.RectF;
import android.graphics.Matrix;
import android.view.View;
import android.view.ViewGroup;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.ArrayList;
import java.util.WeakHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

// Read-only prototype evidence. No binding, focus request or default owner is
// installed here; native focus completion must come from original callbacks.
final class CUIFieldGroupDocument {
  private static final WeakHashMap<View, String> identities = new WeakHashMap<>();
  private static long sequence;
  private static String instance(View view) {
    String identity = identities.get(view);
    if (identity == null) { identity = "field-group-view:" + ++sequence; identities.put(view, identity); }
    return identity;
  }
  private static View resolve(UIManager manager, int target) {
    try { return manager.resolveView(target); }
    catch (IllegalViewOperationException unavailable) { return null; }
  }
  static boolean matchesOriginal(UIManager manager, JSONObject expected, View original) throws Exception {
    return original != null && resolve(manager, expected.getInt("target")) == original &&
      instance(original).equals(expected.getString("nativeInstance")) && instance(original).equals(expected.getString("editorInstance"));
  }
  private static boolean descendant(View view, View ancestor) {
    if (ancestor == null) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == ancestor) return true;
    return false;
  }
  private static boolean visible(View view, View outer) {
    if (view == null || !view.isAttachedToWindow() || !view.isShown() || view.getRootView() != outer.getRootView()) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current.getAlpha() <= 0) return false;
    return true;
  }
  private static void transformToRoot(View target, View root, Matrix matrix) {
    if (target == root) return;
    if (!(target.getParent() instanceof View)) throw new IllegalStateException("field-group-original-geometry-ancestry-retired");
    View parent = (View)target.getParent(); transformToRoot(parent, root, matrix);
    matrix.preTranslate(-parent.getScrollX(), -parent.getScrollY());
    matrix.preTranslate(target.getLeft(), target.getTop());
    matrix.preConcat(target.getMatrix());
  }
  private static JSONArray nativeHierarchy(UIManager manager, JSONObject document, View outer) throws Exception {
    java.util.Map<Integer, View> views = new java.util.LinkedHashMap<>();
    java.util.Map<View, Integer> targets = new java.util.IdentityHashMap<>();
    JSONArray nodes = document.getJSONArray("nodes");
    for (int index = 0; index < nodes.length(); index++) {
      int target = nodes.getJSONObject(index).getInt("target"); View view = resolve(manager, target);
      if (view != null && view.isAttachedToWindow() && view.getRootView() == outer.getRootView()) {
        views.put(target, view); targets.put(view, target);
      }
    }
    JSONArray result = new JSONArray();
    for (java.util.Map.Entry<Integer, View> entry : views.entrySet()) {
      View view = entry.getValue(); int parentTarget = 0;
      for (android.view.ViewParent parent = view.getParent(); parent instanceof View; parent = parent.getParent())
        if (targets.containsKey(parent)) { parentTarget = targets.get(parent); break; }
      java.util.ArrayList<Integer> reversed = new java.util.ArrayList<>();
      for (View current = view; current != outer.getRootView();) {
        if (!(current.getParent() instanceof ViewGroup)) throw new IllegalStateException("field-group-native-hierarchy-retired");
        ViewGroup parent = (ViewGroup)current.getParent(); int position = parent.indexOfChild(current);
        if (position < 0) throw new IllegalStateException("field-group-native-hierarchy-retired");
        reversed.add(position); current = parent;
      }
      java.util.Collections.reverse(reversed);
      result.put(new JSONObject().put("target", entry.getKey()).put("parent", parentTarget).put("order", new JSONArray(reversed)));
    }
    return result;
  }
  static JSONObject read(UIManager manager, JSONObject document) throws Exception {
    UiThreadUtil.assertOnUiThread();
    JSONObject plan = document.getJSONObject("fieldGroup"), field = plan.getJSONObject("field"), mount = plan.getJSONObject("mount");
    View binding = resolve(manager, field.getInt("metadataTarget")), primary = resolve(manager, field.getInt("target"));
    View outer = resolve(manager, plan.getInt("outerTarget")), input = resolve(manager, plan.getInt("inputTarget"));
    if (!(binding instanceof CUIFormMetadataView) || !((CUIFormMetadataView)binding).isFieldBinding() ||
        !(outer instanceof ReactViewGroup) || !(input instanceof ReactViewGroup) || outer == input ||
        !descendant(input, outer) || !descendant(binding, outer) || !visible(outer, outer) || !visible(input, outer) ||
        !outer.hasWindowFocus() || !CUIInputWindow.identity(outer).equals(mount.getString("windowId")))
      throw new IllegalStateException("field-group-original-roots-retired");
    CUIFormMetadataView metadata = (CUIFormMetadataView)binding;
    String owned = field.getString("ownedEditorBinding");
    if (metadata.originalForMountSnapshot(mount) != primary || !metadata.ownedEditorBinding.equals(owned))
      throw new IllegalStateException("field-group-original-metadata-retired");
    ArrayList<CUIDateSegment> segments = CUIOwnedDateField.resolveAll(manager, metadata, owned, field.getInt("target"), document.getInt("surfaceId"));
    if (segments == null || segments.isEmpty()) throw new IllegalStateException("field-group-whole-segment-set-retired");
    for (CUIDateSegment segment : segments) if (!descendant(segment, input)) throw new IllegalStateException("field-group-original-input-retired");
    JSONArray hierarchy = nativeHierarchy(manager, document, outer);
    java.util.Map<Integer, JSONObject> eventNodes = new java.util.HashMap<>();
    java.util.HashSet<Integer> visibleTargets = new java.util.HashSet<>();
    JSONArray plannedNodes = plan.getJSONArray("nodes"), fields = document.getJSONArray("fields");
    for (int index = 0; index < plannedNodes.length(); index++) {
      JSONObject node = plannedNodes.getJSONObject(index);
      eventNodes.put(node.getInt("target"), node);
      if (node.getBoolean("visible")) visibleTargets.add(node.getInt("target"));
    }
    JSONArray sourceNodes = document.getJSONArray("nodes");
    for (int index = 0; index < sourceNodes.length(); index++) {
      int target = sourceNodes.getJSONObject(index).getInt("target"); View view = resolve(manager, target);
      if ((eventNodes.containsKey(target) || descendant(view, outer)) && visible(view, outer)) visibleTargets.add(target);
    }
    ArrayList<CUIFormMetadataView> nestedOwners = new ArrayList<>();
    ArrayList<JSONObject> nestedMounts = new ArrayList<>();
    ArrayList<ArrayList<CUIDateSegment>> nestedSets = new ArrayList<>();
    for (int index = 0; index < fields.length(); index++) {
      JSONObject candidate = fields.getJSONObject(index);
      if (candidate.getInt("metadataTarget") == metadata.getId() || !candidate.has("ownedEditorBinding")) continue;
      String nestedBinding = candidate.getString("ownedEditorBinding");
      if (!visibleTargets.contains(new JSONObject(nestedBinding).getInt("rootTarget"))) continue;
      View nestedView = resolve(manager, candidate.getInt("metadataTarget")), nestedPrimary = resolve(manager, candidate.getInt("target"));
      if (!(nestedView instanceof CUIFormMetadataView) || !((CUIFormMetadataView)nestedView).isFieldBinding())
        throw new IllegalStateException("field-group-nested-descriptor-retired");
      CUIFormMetadataView nested = (CUIFormMetadataView)nestedView;
      if (!nested.ownerId.equals(candidate.getString("ownerId")) || !nested.descriptorId.equals(candidate.getString("descriptorId")) ||
          !nested.descriptorRevision.equals(candidate.getString("descriptorRevision")) || !nested.ownedEditorBinding.equals(nestedBinding))
        throw new IllegalStateException("field-group-nested-descriptor-retired");
      JSONObject nestedMount = nested.formMountSnapshot();
      ArrayList<CUIDateSegment> nestedSegments = CUIOwnedDateField.resolveAll(manager, nested, nestedBinding, candidate.getInt("target"), document.getInt("surfaceId"));
      if (nested.originalForMountSnapshot(nestedMount) != nestedPrimary || nestedSegments == null || nestedSegments.isEmpty())
        throw new IllegalStateException("field-group-nested-whole-segment-set-retired");
      nestedOwners.add(nested); nestedMounts.add(nestedMount); nestedSets.add(nestedSegments);
    }
    JSONArray originals = new JSONArray(), instances = new JSONArray(), nodes = document.getJSONArray("nodes");
    java.util.Map<Integer, Integer> parents = new java.util.HashMap<>();
    for (int index = 0; index < nodes.length(); index++) {
      JSONObject node = nodes.getJSONObject(index); parents.put(node.getInt("target"), node.getInt("parent"));
    }
    instances.put(new JSONObject().put("target", outer.getId()).put("nativeTarget", outer.getId()).put("nativeInstance", instance(outer)).put("editorInstance", instance(outer)));
    ArrayList<View> currentOriginals = new ArrayList<>();
    int focused = 0, eventFocused = 0;
    for (int index = 0; index < nodes.length(); index++) {
      JSONObject node = nodes.getJSONObject(index), policy = node.optJSONObject("fieldFocus");
      if (node.getInt("target") == outer.getId()) continue;
      JSONObject eventNode = eventNodes.get(node.getInt("target"));
      boolean eventMember = eventNode != null && eventNode.getJSONArray("groups").length() > 0;
      View original = resolve(manager, node.getInt("target"));
      String name = node.getString("component");
      boolean core = "TextInput".equals(name) || "AndroidTextInput".equals(name);
      if (original == null) {
        int ancestor = node.getInt("parent"); View backed = null;
        java.util.Set<Integer> visited = new java.util.HashSet<>();
        while (ancestor > 0 && visited.add(ancestor)) {
          backed = ancestor == outer.getId() ? outer : resolve(manager, ancestor);
          if (backed != null) break;
          ancestor = parents.getOrDefault(ancestor, 0);
        }
        if (!eventMember && !descendant(backed, outer)) continue;
        if (core || (policy != null && policy.getBoolean("candidate"))) throw new IllegalStateException("field-group-original-unavailable");
        if (backed == null || backed.getRootView() != outer.getRootView())
          throw new IllegalStateException("field-group-hit-backing-unavailable");
        instances.put(new JSONObject().put("target", node.getInt("target")).put("nativeTarget", backed.getId())
          .put("nativeInstance", instance(backed)).put("editorInstance", instance(backed)));
        currentOriginals.add(backed);
        continue;
      }
      boolean physicalMember = descendant(original, outer);
      if (!eventMember && !physicalMember) continue;
      if (original.getRootView() != outer.getRootView() ||
          !CUIInputWindow.identity(original).equals(CUIInputWindow.identity(outer)))
        throw new IllegalStateException("field-group-original-window-or-containment-retired");
      if (core && !(original instanceof ReactEditText)) throw new IllegalStateException("field-group-original-editor-class-retired");
      String hostOwner = original instanceof CUIDateSegment ? ((CUIDateSegment)original).ownerId :
        original instanceof CUIFocusView ? ((CUIFocusView)original).fieldInputOwnerId() : null;
      if (policy != null && policy.has("ownerId") && !policy.getString("ownerId").equals(hostOwner))
        throw new IllegalStateException("field-group-original-host-owner-retired");
      instances.put(new JSONObject().put("target", original.getId()).put("nativeTarget", original.getId()).put("nativeInstance", instance(original)).put("editorInstance", instance(original)));
      currentOriginals.add(original);
      boolean eligible = physicalMember && visible(original, outer) && original.isEnabled() &&
        original.isFocusable() && (policy == null || policy.getBoolean("focusable"));
      if (!eligible && !original.isFocused()) continue;
      if (original.isFocused()) {
        if (focused != 0) throw new IllegalStateException("field-group-focused-original-ambiguous");
        focused = original.getId();
        if (eventMember) eventFocused = original.getId();
      }
      // Transform all four corners through the actual SDK hierarchy, retaining
      // scroll/ancestor transforms. Screen location alone loses native scale.
      View windowRoot = outer.getRootView(); Matrix matrix = new Matrix(); transformToRoot(original, windowRoot, matrix);
      RectF rectangle = new RectF(0, 0, original.getWidth(), original.getHeight()); matrix.mapRect(rectangle);
      int[] window = new int[2]; windowRoot.getLocationInWindow(window);
      rectangle.offset(window[0], window[1]);
      float density = original.getResources().getDisplayMetrics().density;
      if (!Float.isFinite(density) || density <= 0 || !Float.isFinite(rectangle.left) || !Float.isFinite(rectangle.top) ||
          !Float.isFinite(rectangle.width()) || !Float.isFinite(rectangle.height()) || rectangle.width() < 0 || rectangle.height() < 0)
        throw new IllegalStateException("field-group-original-geometry-invalid");
      boolean readOnly = policy != null ? policy.getBoolean("readOnly") : original instanceof ReactEditText && ((ReactEditText)original).getKeyListener() == null;
      JSONObject row = new JSONObject().put("target", original.getId()).put("nativeInstance", instance(original)).put("editorInstance", instance(original))
        .put("focused", original.isFocused()).put("eligible", eligible).put("tabStop", policy == null || policy.getBoolean("tabStop"))
        .put("readOnly", readOnly).put("placeholder", policy != null && policy.getBoolean("placeholder"))
        .put("groups", eventNode == null ? new JSONArray() : eventNode.getJSONArray("groups"))
        .put("rect", new JSONObject().put("x", rectangle.left / density).put("y", rectangle.top / density)
          .put("width", rectangle.width() / density).put("height", rectangle.height() / density));
      if (original instanceof CUIDateSegment) row.put("segment", ((CUIDateSegment)original).formSegmentIdentity());
      if (hostOwner != null) row.put("hostOwnerId", hostOwner);
      originals.put(row);
    }
    if (resolve(manager, plan.getInt("outerTarget")) != outer || resolve(manager, plan.getInt("inputTarget")) != input ||
        resolve(manager, field.getInt("metadataTarget")) != metadata || metadata.originalForMountSnapshot(mount) != primary ||
        !metadata.ownedEditorBinding.equals(owned) ||
        !segments.equals(CUIOwnedDateField.resolveAll(manager, metadata, owned, field.getInt("target"), document.getInt("surfaceId"))))
      throw new IllegalStateException("field-group-originals-retired-during-read");
    for (View original : currentOriginals)
      if (resolve(manager, original.getId()) != original || !original.isAttachedToWindow()) throw new IllegalStateException("field-group-original-retired-during-read");
    for (int index = 0; index < nestedOwners.size(); index++) {
      CUIFormMetadataView nested = nestedOwners.get(index); JSONObject nestedMount = nestedMounts.get(index);
      if (resolve(manager, nested.getId()) != nested || nested.originalForMountSnapshot(nestedMount) != nestedSets.get(index).get(0) ||
          !nestedSets.get(index).equals(CUIOwnedDateField.resolveAll(manager, nested, nested.ownedEditorBinding, nestedMount.getInt("originalTarget"), document.getInt("surfaceId"))))
        throw new IllegalStateException("field-group-nested-originals-retired-during-read");
    }
    if (!hierarchy.toString().equals(nativeHierarchy(manager, document, outer).toString()))
      throw new IllegalStateException("field-group-native-hierarchy-retired-during-read");
    return new JSONObject().put("documentId", document.getString("documentId")).put("revision", document.getString("revision"))
      .put("surfaceId", document.getInt("surfaceId")).put("windowId", mount.getString("windowId"))
      .put("outerTarget", outer.getId()).put("inputTarget", input.getId()).put("outerInstance", instance(outer)).put("inputInstance", instance(input))
      .put("field", field).put("mount", mount).put("focusedTarget", focused).put("eventFocusedTarget", eventFocused)
      .put("nativeHierarchy", hierarchy).put("originals", originals).put("instances", instances);
  }
}
