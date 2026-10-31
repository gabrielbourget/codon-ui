package com.codonui.input;

import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.views.textinput.ReactEditText;
import org.json.JSONArray;
import java.util.WeakHashMap;
import org.json.JSONObject;

final class CUIFormDocumentInspection {
  private static final WeakHashMap<View, String> identities = new WeakHashMap<>();
  private static long sequence;
  private static String identity(View view) {
    String identity = identities.get(view);
    if (identity == null) { identity = "native-view:" + ++sequence; identities.put(view, identity); }
    return identity;
  }
  private static View resolve(UIManager manager, int target) {
    try { return manager.resolveView(target); }
    catch (IllegalViewOperationException unavailable) { return null; }
  }
  static JSONObject inspect(UIManager manager, JSONObject document, Integer controlTarget) throws Exception {
    JSONArray fields = new JSONArray(), descriptors = document.getJSONArray("fields");
    if (controlTarget != null) {
      boolean found = false;
      JSONArray nodes = document.getJSONArray("nodes");
      for (int index = 0; index < nodes.length(); index++) if (nodes.getJSONObject(index).getInt("target") == controlTarget) found = true;
      for (int index = 0; index < descriptors.length(); index++) if (descriptors.getJSONObject(index).getInt("target") == controlTarget) throw new IllegalStateException("form-control-must-be-unbound");
      if (!found || !(manager.resolveView(controlTarget) instanceof ReactEditText)) throw new IllegalStateException("form-control-editor-unavailable");
    }
    for (int index = 0; index < descriptors.length(); index++) {
      JSONObject field = descriptors.getJSONObject(index);
      View target = resolve(manager, field.getInt("target"));
      View metadata = resolve(manager, field.getInt("metadataTarget"));
      boolean resolved = target instanceof ReactEditText && metadata instanceof CUIFormMetadataView;
      boolean available = resolved &&
        target.isAttachedToWindow() && metadata.isAttachedToWindow() && CUIInputWindow.identity(target).equals(CUIInputWindow.identity(metadata));
      JSONObject result = new JSONObject().put("descriptorId", field.getString("descriptorId")).put("target", field.getInt("target"))
        .put("metadataTarget", field.getInt("metadataTarget")).put("available", available).put("resolved", resolved);
      if (resolved) {
        ReactEditText editor = (ReactEditText)target;
        CUIFormMetadataView binding = (CUIFormMetadataView)metadata;
        boolean current = binding.ownerId.equals(field.getString("ownerId")) && binding.descriptorId.equals(field.getString("descriptorId"))
          && binding.descriptorRevision.equals(field.getString("descriptorRevision")) && binding.originalTarget == target.getId();
        String text = editor.getText().toString(); int start = editor.getSelectionStart(), end = editor.getSelectionEnd(); boolean focused = editor.isFocused();
        AccessibilityNodeInfo info = editor.createAccessibilityNodeInfo();
        JSONArray actions = new JSONArray();
        for (AccessibilityNodeInfo.AccessibilityAction action : info.getActionList()) actions.put(action.getId());
        result.put("currentDescriptor", current).put("metadataOnly", binding.isMetadataOnly()).put("windowId", CUIInputWindow.identity(editor))
          .put("originalClass", editor.getClass().getName()).put("originalInstance", identity(editor)).put("editorInstance", identity(editor)).put("metadataInstance", identity(metadata)).put("state", new JSONObject().put("text", text).put("selection", new JSONArray().put(start).put(end)).put("focused", focused))
          .put("sdk", new JSONObject().put("className", String.valueOf(info.getClassName())).put("text", String.valueOf(info.getText()))
            .put("label", String.valueOf(info.getContentDescription())).put("editable", info.isEditable()).put("enabled", info.isEnabled()).put("focusable", info.isFocusable()).put("actions", actions))
          .put("stateUnchanged", text.equals(editor.getText().toString()) && start == editor.getSelectionStart() && end == editor.getSelectionEnd() && focused == editor.isFocused());
      }
      fields.put(result);
    }
    return new JSONObject().put("platform", "android").put("fields", fields).put("controlTarget", controlTarget == null ? JSONObject.NULL : controlTarget).put("controlInstance", controlTarget == null ? JSONObject.NULL : identity(manager.resolveView(controlTarget)));
  }
}
