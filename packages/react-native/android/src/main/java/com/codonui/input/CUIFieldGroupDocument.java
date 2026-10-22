package com.codonui.input;

import android.graphics.RectF;
import android.graphics.Matrix;
import android.view.View;
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
    java.util.HashSet<Integer> visibleTargets = new java.util.HashSet<>();
    JSONArray plannedNodes = plan.getJSONArray("nodes"), fields = document.getJSONArray("fields");
    for (int index = 0; index < plannedNodes.length(); index++) {
      JSONObject node = plannedNodes.getJSONObject(index);
      if (node.getBoolean("visible")) visibleTargets.add(node.getInt("target"));
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
    JSONArray originals = new JSONArray(), nodes = plan.getJSONArray("nodes");
    ArrayList<View> currentOriginals = new ArrayList<>();
    int focused = 0;
    for (int index = 0; index < nodes.length(); index++) {
      JSONObject node = nodes.getJSONObject(index), policy = node.optJSONObject("fieldFocus");
      if (!node.getBoolean("visible")) continue;
      View original = resolve(manager, node.getInt("target"));
      String name = node.getString("component");
      boolean core = "TextInput".equals(name) || "AndroidTextInput".equals(name);
      if (original == null) {
        if (core || (policy != null && policy.getBoolean("candidate"))) throw new IllegalStateException("field-group-original-unavailable");
        continue; // Flattened non-focusable layout nodes do not invent views.
      }
      if (!descendant(original, outer) || original.getRootView() != outer.getRootView() ||
          !CUIInputWindow.identity(original).equals(CUIInputWindow.identity(outer)))
        throw new IllegalStateException("field-group-original-window-or-containment-retired");
      if (core && !(original instanceof ReactEditText)) throw new IllegalStateException("field-group-original-editor-class-retired");
      String hostOwner = original instanceof CUIDateSegment ? ((CUIDateSegment)original).ownerId :
        original instanceof CUIFocusView ? ((CUIFocusView)original).fieldInputOwnerId() : null;
      if (policy != null && policy.has("ownerId") && !policy.getString("ownerId").equals(hostOwner))
        throw new IllegalStateException("field-group-original-host-owner-retired");
      boolean eligible = node.getBoolean("visible") && visible(original, outer) && original.isEnabled() &&
        original.isFocusable() && (policy == null || policy.getBoolean("focusable"));
      if (!eligible && !original.isFocused()) continue;
      if (original.isFocused()) {
        if (focused != 0) throw new IllegalStateException("field-group-focused-original-ambiguous");
        focused = original.getId();
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
        .put("readOnly", readOnly).put("placeholder", policy != null && policy.getBoolean("placeholder")).put("groups", node.getJSONArray("groups"))
        .put("rect", new JSONObject().put("x", rectangle.left / density).put("y", rectangle.top / density)
          .put("width", rectangle.width() / density).put("height", rectangle.height() / density));
      if (original instanceof CUIDateSegment) row.put("segment", ((CUIDateSegment)original).formSegmentIdentity());
      if (hostOwner != null) row.put("hostOwnerId", hostOwner);
      originals.put(row); currentOriginals.add(original);
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
    return new JSONObject().put("documentId", document.getString("documentId")).put("revision", document.getString("revision"))
      .put("surfaceId", document.getInt("surfaceId")).put("windowId", mount.getString("windowId"))
      .put("outerTarget", outer.getId()).put("inputTarget", input.getId()).put("outerInstance", instance(outer)).put("inputInstance", instance(input))
      .put("field", field).put("mount", mount).put("focusedTarget", focused).put("originals", originals);
  }
}
