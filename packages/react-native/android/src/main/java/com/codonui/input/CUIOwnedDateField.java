package com.codonui.input;

import android.view.View;
import android.view.ViewGroup;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.ArrayList;
import java.util.HashSet;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUIOwnedDateField {
  private static boolean integer(Object value, boolean tag) {
    if (!(value instanceof Number)) return false;
    double number = ((Number)value).doubleValue();
    return Double.isFinite(number) && number > 0 && Math.floor(number) == number && number <= (tag ? Integer.MAX_VALUE : 9007199254740991.0);
  }
  private static void collect(View view, ArrayList<CUIDateSegment> result) {
    if (view instanceof CUIDateSegment) result.add((CUIDateSegment)view);
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) collect(group.getChildAt(index), result);
    }
  }
  private static boolean descendant(View view, View root) {
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == root) return true;
    return false;
  }
  static CUIDateSegment resolve(UIManager manager, View metadata, String encoded, int primaryTarget, int surface) {
    try {
      if (manager == null || !metadata.isAttachedToWindow() || encoded.isEmpty() || surface <= 0) return null;
      JSONObject value = new JSONObject(encoded);
      if (!"date-field".equals(value.getString("kind")) || !integer(value.get("rootTarget"), true)) return null;
      View root = manager.resolveView(value.getInt("rootTarget"));
      if (!(root instanceof ReactViewGroup) || root instanceof CUIDateSegment || root == metadata || !descendant(metadata, root)) return null;
      JSONArray expected = value.getJSONArray("segments");
      ArrayList<CUIDateSegment> originals = new ArrayList<>(); collect(root, originals);
      if (originals.isEmpty() || originals.size() != expected.length() || originals.get(0).getId() != primaryTarget) return null;
      HashSet<String> ids = new HashSet<>(); HashSet<Integer> targets = new HashSet<>();
      String owner = null, window = CUIInputWindow.identity(metadata);
      for (int index = 0; index < expected.length(); index++) {
        JSONObject row = expected.getJSONObject(index); CUIDateSegment original = originals.get(index);
        if (row.length() != 8) return null;
        for (String key : new String[]{"ownerId", "segmentId", "bindingRevision", "nativeInstance", "windowId"})
          if (!(row.get(key) instanceof String) || row.getString(key).isEmpty()) return null;
        if (!integer(row.get("target"), true) || !integer(row.get("surfaceId"), true) || !integer(row.get("epoch"), false) ||
            row.getInt("surfaceId") != surface || !row.getString("windowId").equals(window) ||
            (owner != null && !owner.equals(row.getString("ownerId"))) || !ids.add(row.getString("segmentId")) ||
            !targets.add(row.getInt("target")) || !CUIFormActionAdmission.same(original.formSegmentIdentity(), row)) return null;
        owner = row.getString("ownerId");
      }
      return originals.get(0);
    } catch (Exception retired) { return null; }
  }
}
