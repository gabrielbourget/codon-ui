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
  private static void collect(View view, String owner, ArrayList<CUIDateSegment> result) {
    if (view instanceof CUIDateSegment && owner.equals(((CUIDateSegment)view).ownerId)) result.add((CUIDateSegment)view);
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) collect(group.getChildAt(index), owner, result);
    }
  }
  static boolean descendant(View view, View root) {
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == root) return true;
    return false;
  }
  static CUIDateSegment resolve(UIManager manager, View metadata, String encoded, int primaryTarget, int surface) {
    ArrayList<CUIDateSegment> result = resolveAll(manager, metadata, encoded, primaryTarget, surface);
    return result == null ? null : result.get(0);
  }
  static ArrayList<CUIDateSegment> resolveAll(UIManager manager, View metadata, String encoded, int primaryTarget, int surface) {
    try {
      if (manager == null || !metadata.isAttachedToWindow() || encoded.isEmpty() || surface <= 0) return null;
      JSONObject value = new JSONObject(encoded);
      if (!"date-field".equals(value.getString("kind")) || !integer(value.get("rootTarget"), true)) return null;
      View root = manager.resolveView(value.getInt("rootTarget"));
      if (!(root instanceof ReactViewGroup) || root instanceof CUIDateSegment || root == metadata || !descendant(metadata, root)) return null;
      JSONArray expected = value.getJSONArray("segments");
      if (expected.length() == 0 || expected.getJSONObject(0).getString("ownerId").isEmpty()) return null;
      ArrayList<CUIDateSegment> originals = new ArrayList<>(); collect(root, expected.getJSONObject(0).getString("ownerId"), originals);
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
      if (value.has("groups")) {
        JSONArray groups = value.getJSONArray("groups");
        if (groups.length() != 1 && groups.length() != 2) return null;
        HashSet<Integer> groupTargets = new HashSet<>(); int offset = 0;
        for (int index = 0; index < groups.length(); index++) {
          JSONObject group = groups.getJSONObject(index);
          String slot = groups.length() == 1 ? "value" : index == 0 ? "start" : "end";
          if (group.length() != 3 || !slot.equals(group.getString("slot")) || !integer(group.get("target"), true) ||
              !groupTargets.add(group.getInt("target")) || targets.contains(group.getInt("target"))) return null;
          View groupRoot = manager.resolveView(group.getInt("target"));
          if (!(groupRoot instanceof ReactViewGroup) || groupRoot == root || !descendant(groupRoot, root) ||
              !groupRoot.isAttachedToWindow() || !CUIInputWindow.identity(groupRoot).equals(window)) return null;
          JSONArray segmentIds = group.getJSONArray("segmentIds");
          ArrayList<CUIDateSegment> members = new ArrayList<>(); collect(groupRoot, owner, members);
          if (members.isEmpty() || members.size() != segmentIds.length() || offset + members.size() > originals.size()) return null;
          for (int member = 0; member < members.size(); member++) {
            if (members.get(member) != originals.get(offset + member) || !(segmentIds.get(member) instanceof String) ||
                !segmentIds.getString(member).equals(expected.getJSONObject(offset + member).getString("segmentId"))) return null;
          }
          offset += members.size();
        }
        if (offset != originals.size()) return null;
      }
      return originals;
    } catch (Exception retired) { return null; }
  }
}
