package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.views.textinput.ReactEditText;
import java.util.HashMap;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUIFormFieldFocus {
  interface Current { boolean check() throws Exception; }
  private static boolean contains(JSONArray descriptors, JSONObject expected) throws Exception {
    for (int index = 0; index < descriptors.length(); index++)
      if (CUIFormActionAdmission.same(descriptors.getJSONObject(index), expected)) return true;
    return false;
  }
  private static boolean belongs(JSONObject document, JSONObject field, JSONObject form) throws Exception {
    JSONArray forms = document.getJSONArray("forms");
    if (field.getBoolean("hasFormAssociation")) {
      String id = field.getString("formId"); int matches = 0;
      for (int index = 0; index < forms.length(); index++) if (id.equals(forms.getJSONObject(index).getString("formId"))) matches++;
      return !id.isEmpty() && matches == 1 && id.equals(form.getString("formId"));
    }
    HashMap<Integer, Integer> parents = new HashMap<>();
    JSONArray nodes = document.getJSONArray("nodes");
    for (int index = 0; index < nodes.length(); index++) {
      JSONObject node = nodes.getJSONObject(index); parents.put(node.getInt("target"), node.getInt("parent"));
    }
    int ancestor = field.getInt("metadataTarget");
    while (ancestor > 0) {
      for (int index = 0; index < forms.length(); index++) {
        JSONObject candidate = forms.getJSONObject(index);
        if (candidate.getInt("target") == ancestor) return CUIFormActionAdmission.same(candidate, form);
      }
      ancestor = parents.containsKey(ancestor) ? parents.get(ancestor) : 0;
    }
    return false;
  }
  static JSONObject focus(UIManager manager, JSONObject document, JSONObject request, Current isCurrent) throws Exception {
    JSONObject field = request.getJSONObject("field"), form = request.getJSONObject("form"), mount = request.getJSONObject("mount");
    if (!request.getString("documentId").equals(document.getString("documentId")) ||
        !request.getString("revision").equals(document.getString("revision")) ||
        !contains(document.getJSONArray("fields"), field) || !contains(document.getJSONArray("forms"), form) || !belongs(document, field, form))
      throw new IllegalStateException("form-focus-document-retired");
    View root = manager.resolveView(form.getInt("metadataTarget"));
    View binding = manager.resolveView(field.getInt("metadataTarget"));
    View target = manager.resolveView(field.getInt("target"));
    if (!(root instanceof CUIFormMetadataView) || !(binding instanceof CUIFormMetadataView))
      throw new IllegalStateException("form-focus-original-editor-retired");
    CUIFormMetadataView formRoot = (CUIFormMetadataView)root, metadata = (CUIFormMetadataView)binding;
    if (formRoot.isFieldBinding() || !formRoot.isMetadataOnly() || formRoot.originalTarget != form.getInt("target") ||
        !formRoot.ownerId.equals(form.getString("ownerId")) || !formRoot.descriptorId.equals(form.getString("descriptorId")) ||
        !formRoot.descriptorRevision.equals(form.getString("descriptorRevision")) || !metadata.isFieldBinding() ||
        metadata.originalForMountSnapshot(mount) != target || !target.isEnabled() || !isCurrent.check())
      throw new IllegalStateException("form-focus-original-editor-retired");
    String owned = field.optString("ownedEditorBinding", "");
    if (!owned.isEmpty()) {
      CUIDateSegment segment = CUIOwnedDateField.resolve(manager, metadata, owned, field.getInt("target"), document.getInt("surfaceId"));
      if (segment != target || !metadata.ownedEditorBinding.equals(owned)) throw new IllegalStateException("form-focus-owned-segments-retired");
      boolean requested = segment.requestFormSegmentFocus(segment.formSegmentIdentity());
      boolean current = requested && isCurrent.check() && metadata.originalForMountSnapshot(mount) == target &&
        CUIOwnedDateField.resolve(manager, metadata, owned, field.getInt("target"), document.getInt("surfaceId")) == target;
      return result(field, mount, current).put("requested", requested);
    }
    if (!(target instanceof ReactEditText) || !metadata.ownedEditorBinding.isEmpty()) throw new IllegalStateException("form-focus-original-editor-retired");
    boolean current = false;
    // Preserve RN's original keyboard/focus behavior and caller-owned props.
    try { ((ReactEditText)target).requestFocusFromJS(); }
    catch (RuntimeException retired) { return result(field, mount, false); }
    try { current = isCurrent.check() && metadata.originalForMountSnapshot(mount) == target; }
    catch (Exception retired) { current = false; }
    return result(field, mount, current);
  }
  private static JSONObject result(JSONObject field, JSONObject mount, boolean current) throws Exception {
    return new JSONObject().put("descriptorId", field.getString("descriptorId")).put("descriptorRevision", field.getString("descriptorRevision"))
      .put("target", field.getInt("target")).put("mount", mount).put("requested", true).put("current", current);
  }
}
