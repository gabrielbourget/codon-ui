package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UIManager;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUIFormActionAdmission {
  static boolean same(JSONObject left, JSONObject right) throws Exception {
    if (left == null || right == null || left.length() != right.length()) return false;
    java.util.Iterator<String> keys = left.keys();
    while (keys.hasNext()) {
      String key = keys.next();
      if (!right.has(key)) return false;
      Object first = left.get(key), second = right.get(key);
      if (first instanceof Number && second instanceof Number) {
        if (Double.compare(((Number)first).doubleValue(), ((Number)second).doubleValue()) != 0) return false;
      } else if (!first.equals(second)) return false;
    }
    return true;
  }
  private static CUIFormMetadataView original(UIManager manager, JSONObject descriptor, boolean field) throws Exception {
    View view = manager.resolveView(descriptor.getInt("metadataTarget"));
    View target = manager.resolveView(descriptor.getInt("target"));
    if (!(view instanceof CUIFormMetadataView) || target == null) throw new IllegalStateException("form-original-retired");
    CUIFormMetadataView metadata = (CUIFormMetadataView)view;
    if (metadata.isFieldBinding() != field || !metadata.isMetadataOnly() || metadata.originalTarget != target.getId() ||
        !metadata.ownerId.equals(descriptor.getString("ownerId")) || !metadata.descriptorId.equals(descriptor.getString("descriptorId")) ||
        !metadata.descriptorRevision.equals(descriptor.getString("descriptorRevision")) ||
        (field && (!metadata.ownedEditorBinding.equals(descriptor.optString("ownedEditorBinding", "")) ||
          !metadata.ownedControlBinding.equals(descriptor.optString("ownedControlBinding", ""))))) throw new IllegalStateException("form-original-retired");
    return metadata;
  }
  // Explicit model membership is checked in JS. Native admission checks exact mounted originals only.
  static void admitModel(UIManager manager, JSONObject request) throws Exception {
    CUIFormMetadataView form = original(manager, request.getJSONObject("form"), false);
    JSONObject formMount = request.getJSONObject("formMount");
    View root = form.originalForAttachedMountSnapshot(formMount);
    if (root == null || !root.hasWindowFocus()) throw new IllegalStateException("form-original-retired");
    JSONArray fields = request.getJSONArray("fields");
    java.util.HashSet<Integer> targets = new java.util.HashSet<>();
    for (int index = 0; index < fields.length(); index++) {
      JSONObject row = fields.getJSONObject(index), mount = row.getJSONObject("mount");
      CUIFormMetadataView field = original(manager, row.getJSONObject("field"), true);
      View target = field.originalForAttachedMountSnapshot(mount);
      if (target == null || !targets.add(target.getId()) || target.getWindowToken() != root.getWindowToken() ||
          !CUIInputWindow.identity(target).equals(CUIInputWindow.identity(root)) || mount.getInt("surfaceId") != formMount.getInt("surfaceId"))
        throw new IllegalStateException("form-field-original-retired");
    }
    if (request.has("actionLease")) {
      JSONObject lease = request.getJSONObject("actionLease");
      View target = manager.resolveView(lease.getInt("target"));
      JSONObject current = target instanceof CUIFocusView ? ((CUIFocusView)target).formActionSnapshot() : null;
      if (!same(lease, current) || !current.getBoolean("active") || !current.getBoolean("attached") || !current.getBoolean("enabled") ||
          target.getWindowToken() != root.getWindowToken() || !CUIInputWindow.identity(target).equals(CUIInputWindow.identity(root)) ||
          current.getInt("surfaceId") != formMount.getInt("surfaceId")) throw new IllegalStateException("form-action-native-lease-retired");
    }
  }
}
