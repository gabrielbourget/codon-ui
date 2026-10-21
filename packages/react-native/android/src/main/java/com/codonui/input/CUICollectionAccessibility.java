package com.codonui.input;

import android.os.Build;
import android.graphics.Rect;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private visible-owner collection metadata. Metadata-only collection hosts never use this binding. */
final class CUICollectionAccessibility {
  private final CUIFocusView host;
  private JSONObject fields = new JSONObject();

  CUICollectionAccessibility(CUIFocusView host) { this.host = host; }

  void configure(String value) {
    try { fields = new JSONObject(value == null ? "" : value); }
    catch (Exception invalid) { fields = new JSONObject(); }
  }

  private static int integer(JSONObject value, String key) {
    Object number = value.opt(key);
    if (!(number instanceof Number)) return -1;
    double exact = ((Number)number).doubleValue();
    return Double.isFinite(exact) && exact >= 0 && exact <= Integer.MAX_VALUE && exact == Math.floor(exact) ? (int)exact : -1;
  }

  private boolean isRoot() {
    String mode = fields.optString("selectionMode");
    return host.isAttachedToWindow() && !host.nativeCollectionBinding.isEmpty() && "root".equals(fields.optString("kind"))
      && integer(fields, "rowCount") >= 0 && integer(fields, "columnCount") >= 0
      && ("none".equals(mode) || "single".equals(mode) || "multiple".equals(mode));
  }

  private boolean hasCurrentBinding() {
    if (!host.isAttachedToWindow() || !host.isShown() || !host.getGlobalVisibleRect(new Rect())) return false;
    try {
      JSONObject binding = new JSONObject(host.nativeCollectionBinding);
      View root = host.getRootView().findViewById(integer(binding, "target"));
      return root instanceof CUICollectionRoot && ((CUICollectionRoot)root).acceptsPointerBinding(host.nativeCollectionBinding, host.getId());
    } catch (Exception invalid) { return false; }
  }

  private boolean isListRoot() {
    return "list-root".equals(fields.optString("kind")) && integer(fields, "count") >= 0 && hasCurrentBinding();
  }

  private CUIFocusView listParentCandidate() {
    if (!"list-item".equals(fields.optString("kind")) || !hasCurrentBinding()) return null;
    View candidate = host.getRootView().findViewById(integer(fields, "parentTarget"));
    if (!(candidate instanceof CUIFocusView) || candidate == host) return null;
    CUIFocusView parent = (CUIFocusView)candidate;
    if (!parent.collectionAccessibility.isListRoot() || !sharesCollection(parent)) return null;
    int ordinal = integer(fields, "ordinal");
    if (ordinal < 0 || ordinal >= integer(parent.collectionAccessibility.fields, "count")) return null;
    for (ViewParent current = host.getParent(); current != null; current = current.getParent()) {
      if (current == parent) return parent;
      if (current instanceof CUIFocusView) {
        CUICollectionAccessibility collection = ((CUIFocusView)current).collectionAccessibility;
        if (collection.isRoot() || collection.isListRoot()) return null;
      }
    }
    return null;
  }

  private List<CUIFocusView> listItems() {
    List<CUIFocusView> items = new ArrayList<>();
    List<View> pending = new ArrayList<>();
    if (!isListRoot()) return items;
    pending.add(host);
    for (int index = 0; index < pending.size(); index++) {
      View view = pending.get(index);
      if (view != host && view instanceof CUIFocusView) {
        CUIFocusView item = (CUIFocusView)view;
        if (item.collectionAccessibility.listParentCandidate() == host) items.add(item);
        if (item.collectionAccessibility.isRoot() || item.collectionAccessibility.isListRoot()) continue;
      }
      if (view instanceof ViewGroup) {
        ViewGroup group = (ViewGroup)view;
        for (int child = 0; child < group.getChildCount(); child++) pending.add(group.getChildAt(child));
      }
    }
    return items;
  }

  private CUIFocusView listParent() {
    CUIFocusView parent = listParentCandidate();
    if (parent == null) return null;
    int ordinal = integer(fields, "ordinal");
    for (CUIFocusView item : parent.collectionAccessibility.listItems())
      if (item != host && (integer(item.collectionAccessibility.fields, "ordinal") == ordinal || item.nativeCollectionBinding.equals(host.nativeCollectionBinding))) return null;
    return parent;
  }

  private boolean sharesCollection(CUIFocusView other) {
    if (!host.isAttachedToWindow() || !other.isAttachedToWindow() || host.getWindowToken() != other.getWindowToken()) return false;
    try {
      JSONObject own = new JSONObject(host.nativeCollectionBinding), parent = new JSONObject(other.nativeCollectionBinding);
      for (String key : new String[]{"ownerId", "rootId", "rootRevision", "target", "surfaceId", "windowId", "epoch", "sequence"})
        if (!own.has(key) || !own.get(key).equals(parent.opt(key))) return false;
      return true;
    } catch (Exception invalid) { return false; }
  }

  private CUIFocusView parent() {
    if (!"cell".equals(fields.optString("kind"))) return null;
    View candidate = host.getRootView().findViewById(integer(fields, "parentTarget"));
    if (!(candidate instanceof CUIFocusView) || candidate == host) return null;
    CUIFocusView parent = (CUIFocusView)candidate;
    if (!parent.collectionAccessibility.isRoot() || !sharesCollection(parent)) return null;
    boolean ancestor = false;
    for (ViewParent current = host.getParent(); current != null; current = current.getParent()) if (current == parent) { ancestor = true; break; }
    if (!ancestor) return null;
    int row = integer(fields, "rowIndex"), column = integer(fields, "columnIndex"), rows = integer(fields, "rowSpan"), columns = integer(fields, "columnSpan");
    if (row < 0 || column < 0 || rows < 1 || columns < 1
      || (long)row + rows > integer(parent.collectionAccessibility.fields, "rowCount")
      || (long)column + columns > integer(parent.collectionAccessibility.fields, "columnCount")) return null;
    return parent;
  }

  private List<CUIFocusView> headers(String key, CUIFocusView parent) {
    List<CUIFocusView> result = new ArrayList<>();
    JSONArray targets = fields.optJSONArray(key);
    if (targets == null) return result;
    for (int index = 0; index < targets.length(); index++) {
      Object value = targets.opt(index);
      if (!(value instanceof Number)) continue;
      double target = ((Number)value).doubleValue();
      if (target <= 0 || target > Integer.MAX_VALUE || target != Math.floor(target)) continue;
      View candidate = host.getRootView().findViewById((int)target);
      if (candidate instanceof CUIFocusView && candidate != host) {
        CUIFocusView header = (CUIFocusView)candidate;
        if (header.collectionAccessibility.parent() == parent && header.collectionAccessibility.fields.optBoolean("heading") && !result.contains(header)) result.add(header);
      }
    }
    return result;
  }

  private static String title(List<CUIFocusView> headers) {
    StringBuilder value = new StringBuilder();
    for (CUIFocusView header : headers) {
      CharSequence label = header.accessibilityReferenceLabel();
      if (label != null && label.length() > 0) { if (value.length() > 0) value.append(", "); value.append(label); }
    }
    return value.toString();
  }

  void apply(AccessibilityNodeInfo info) {
    if (isListRoot()) {
      info.setCollectionInfo(AccessibilityNodeInfo.CollectionInfo.obtain(integer(fields, "count"), 1, false, AccessibilityNodeInfo.CollectionInfo.SELECTION_MODE_NONE));
      return;
    }
    CUIFocusView list = listParent();
    if (list != null) {
      info.setCollectionItemInfo(AccessibilityNodeInfo.CollectionItemInfo.obtain(integer(fields, "ordinal"), 1, 0, 1, false, info.isSelected()));
      info.setParent(list);
      return;
    }
    if (isRoot()) {
      int mode = "multiple".equals(fields.optString("selectionMode")) ? AccessibilityNodeInfo.CollectionInfo.SELECTION_MODE_MULTIPLE
        : "single".equals(fields.optString("selectionMode")) ? AccessibilityNodeInfo.CollectionInfo.SELECTION_MODE_SINGLE : AccessibilityNodeInfo.CollectionInfo.SELECTION_MODE_NONE;
      info.setCollectionInfo(AccessibilityNodeInfo.CollectionInfo.obtain(integer(fields, "rowCount"), integer(fields, "columnCount"), fields.optBoolean("hierarchical"), mode));
      return;
    }
    CUIFocusView parent = parent();
    if (parent == null) return;
    int row = integer(fields, "rowIndex"), column = integer(fields, "columnIndex"), rows = integer(fields, "rowSpan"), columns = integer(fields, "columnSpan");
    boolean heading = fields.optBoolean("heading"), selected = fields.optBoolean("selected");
    List<CUIFocusView> rowHeaders = headers("rowHeaderTargets", parent), columnHeaders = headers("columnHeaderTargets", parent);
    if (Build.VERSION.SDK_INT >= 33) info.setCollectionItemInfo(new AccessibilityNodeInfo.CollectionItemInfo.Builder()
      .setRowIndex(row).setColumnIndex(column).setRowSpan(rows).setColumnSpan(columns).setHeading(heading).setSelected(selected)
      .setRowTitle(title(rowHeaders)).setColumnTitle(title(columnHeaders)).build());
    else info.setCollectionItemInfo(AccessibilityNodeInfo.CollectionItemInfo.obtain(row, rows, column, columns, heading, selected));
    info.setParent(parent);
    info.setSelected(selected);
    if (Build.VERSION.SDK_INT >= 28) info.setHeading(heading);
    List<CUIFocusView> allHeaders = new ArrayList<>(rowHeaders);
    for (CUIFocusView header : columnHeaders) if (!allHeaders.contains(header)) allHeaders.add(header);
    if (Build.VERSION.SDK_INT >= 36) for (CUIFocusView header : allHeaders) info.addLabeledBy(header);
    else if (!allHeaders.isEmpty()) info.setLabeledBy(allHeaders.get(0));
  }

  String inspect(AccessibilityNodeInfo info) {
    JSONObject result = new JSONObject();
    try {
      AccessibilityNodeInfo.CollectionInfo root = info.getCollectionInfo();
      if (root != null) {
        result.put("kind", isListRoot() ? "list-root" : "root").put("rowCount", root.getRowCount()).put("columnCount", root.getColumnCount())
          .put("hierarchical", root.isHierarchical()).put("selectionMode", root.getSelectionMode());
      }
      AccessibilityNodeInfo.CollectionItemInfo cell = info.getCollectionItemInfo();
      if (cell != null) {
        CUIFocusView list = listParent();
        result.put("kind", list != null ? "list-item" : "cell").put("rowIndex", cell.getRowIndex()).put("columnIndex", cell.getColumnIndex())
          .put("rowSpan", cell.getRowSpan()).put("columnSpan", cell.getColumnSpan()).put("heading", cell.isHeading()).put("selected", cell.isSelected());
        CUIFocusView parent = list != null ? list : parent();
        result.put("parentTarget", parent == null ? 0 : parent.getId());
        if (Build.VERSION.SDK_INT >= 33) result.put("rowTitle", cell.getRowTitle()).put("columnTitle", cell.getColumnTitle());
      }
    } catch (Exception invalid) { return "{}"; }
    return result.toString();
  }
}
