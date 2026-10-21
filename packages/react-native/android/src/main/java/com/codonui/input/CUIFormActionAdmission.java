package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.views.view.ReactViewGroup;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUIFormActionAdmission {
  private static boolean same(JSONObject left, JSONObject right) throws Exception {
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
  static JSONObject admit(UIManager manager, JSONObject document, JSONObject request) throws Exception {
    JSONObject lease = request.getJSONObject("lease"), form = request.getJSONObject("form");
    if (!request.getString("documentId").equals(document.getString("documentId")) ||
        !request.getString("revision").equals(document.getString("revision"))) throw new IllegalStateException("form-action-document-retired");
    boolean found = false;
    JSONArray forms = document.getJSONArray("forms");
    for (int index = 0; index < forms.length(); index++) if (same(form, forms.getJSONObject(index))) found = true;
    if (!found || lease.getInt("target") != document.getInt("target") || lease.getInt("surfaceId") != document.getInt("surfaceId"))
      throw new IllegalStateException("form-action-association-retired");
    View target = manager.resolveView(lease.getInt("target"));
    View metadata = manager.resolveView(form.getInt("metadataTarget"));
    View original = manager.resolveView(form.getInt("target"));
    if (!(target instanceof CUIFocusView) || !(metadata instanceof CUIFormMetadataView) || !(original instanceof ReactViewGroup))
      throw new IllegalStateException("form-action-original-target-retired");
    CUIFormMetadataView binding = (CUIFormMetadataView)metadata;
    if (binding.isFieldBinding() || !binding.isMetadataOnly() || binding.originalTarget != original.getId() ||
        !binding.ownerId.equals(form.getString("ownerId")) || !binding.descriptorId.equals(form.getString("descriptorId")) ||
        !binding.descriptorRevision.equals(form.getString("descriptorRevision"))) throw new IllegalStateException("form-action-original-target-retired");
    JSONObject current = ((CUIFocusView)target).formActionSnapshot();
    if (!same(lease, current) || !current.getBoolean("attached") || !current.getBoolean("active") || !current.getBoolean("enabled"))
      throw new IllegalStateException("form-action-native-lease-retired");
    return new JSONObject().put("accepted", true).put("lease", current).put("documentId", document.getString("documentId"))
      .put("revision", document.getString("revision")).put("formDescriptorId", form.getString("descriptorId"))
      .put("formDescriptorRevision", form.getString("descriptorRevision"));
  }
}
