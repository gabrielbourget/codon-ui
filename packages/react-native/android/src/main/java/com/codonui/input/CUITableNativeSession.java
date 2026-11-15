package com.codonui.input;

import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

final class CUITableNativeSession implements CUINativeTableFeature {
  private final ReactApplicationContext context;
  private final AtomicBoolean valid;
  private final Object lock;
  private long tableHandle;
  private FabricUIManager tableManager;
  private CUITableStickyPresentation tableDriver;
  private RuntimeException tableFailure;
  CUITableNativeSession(ReactApplicationContext context, AtomicBoolean valid, Object lock) {
    this.context = context; this.valid = valid; this.lock = lock;
  }
  private static native long nativeCreateTable(FabricUIManager manager, Object module);
  private static native String nativeTableRequest(long handle, String request);
  private static native String nativeTableTargets(long handle);
  private static native void nativeTableSynchronize(long handle);
  private static native void nativeTableFrame(long handle, String lease, double[] geometry);
  private static native void nativeTableRetire(long handle, String lease);
  private static native void nativeCloseTable(long handle);

  @Override public String request(String encoded) {
    synchronized (lock) {
      try {
        JSONObject request = new JSONObject(encoded);
        if (!valid.get() || !context.hasActiveReactInstance()) {
          if ("release".equals(request.getString("action"))) return new JSONObject().put("lease", request.getString("lease")).put("released", true).toString();
          throw new IllegalStateException("Table sticky: module retired");
        }
        if (tableFailure != null && !"release".equals(request.getString("action"))) throw tableFailure;
        if (tableHandle == 0) {
          Object value = request.get("target");
          if (!(value instanceof Number)) throw new IllegalArgumentException("Table sticky: target required");
          double target = ((Number)value).doubleValue();
          if (!Double.isFinite(target) || target <= 0 || target > Integer.MAX_VALUE || target != Math.rint(target)) throw new IllegalArgumentException("Table sticky: invalid target");
          UIManager manager = UIManagerHelper.getUIManagerForReactTag(context, (int)target);
          if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("Table sticky: Fabric unavailable");
          tableManager = (FabricUIManager)manager;
          tableHandle = nativeCreateTable(tableManager, this);
        }
        String result = nativeTableRequest(tableHandle, encoded);
        onTableStickyMount();
        return result;
      } catch (Exception failure) {
        android.util.Log.e("CUITableSticky", "Sticky presentation failed", failure);
        throw new IllegalStateException("E_CUI_TABLE_STICKY", failure);
      }
    }
  }
  @DoNotStrip private void onTableStickyMount() {
    UiThreadUtil.runOnUiThread(() -> {
      synchronized (lock) {
        if (!valid.get() || tableHandle == 0) return;
        if (tableDriver == null) tableDriver = new CUITableStickyPresentation(this, context, tableManager);
        tableDriver.synchronize();
      }
    });
  }
  String tableStickyTargets() { synchronized (lock) { return tableHandle == 0 ? "[]" : nativeTableTargets(tableHandle); } }
  void tableStickySynchronize() { synchronized (lock) { if (tableHandle != 0) nativeTableSynchronize(tableHandle); } }
  void tableStickyFrame(String lease, double[] geometry) { synchronized (lock) { if (tableHandle != 0 && valid.get()) nativeTableFrame(tableHandle, lease, geometry); } }
  void tableStickyRetire(String lease) { synchronized (lock) { if (tableHandle != 0) nativeTableRetire(tableHandle, lease); } }
  void tableStickyFailure(Exception failure) { synchronized (lock) { if (tableFailure == null) tableFailure = new IllegalStateException("Table sticky: native frame failed", failure); } }

  @Override public void invalidate() {
    synchronized (lock) {
      if (tableDriver != null) { tableDriver.invalidate(); tableDriver = null; }
      if (tableHandle != 0) { nativeCloseTable(tableHandle); tableHandle = 0; }
      tableManager = null;
    }
  }
}
