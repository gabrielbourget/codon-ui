package com.codonui.input;

import android.view.View;
import android.os.SystemClock;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@ReactModule(name = CUIMotionSnapshotModule.NAME)
public final class CUIMotionSnapshotModule extends NativeCUIMotionSnapshotSpec {
  static { System.loadLibrary("codon_motion"); }
  static native long clampKernel();
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private CUIBackdropRenderer backdrop;
  private static final String[] strings = {"ownerId", "bindingId", "windowId", "scopeOwnerId", "nativeViewRevision"};
  private static final String[] numbers = {"target", "epoch", "attachmentRevision"};

  CUIMotionSnapshotModule(ReactApplicationContext context) { super(context); }
  @Override public void backdropFrame(String request, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      if (!valid.get()) { promise.reject("E_CUI_BACKDROP", "Native backdrop: module retired"); return; }
      if (backdrop == null) backdrop = new CUIBackdropRenderer(getReactApplicationContext());
      backdrop.request(request, promise);
    });
  }
  private static native String nativeSnapshot(FabricUIManager manager, int target, String owner, String binding, String revision);
  private static native String nativeInitialValue(FabricUIManager manager, int target, String owner, String binding, String revision, String name);
  private static native String nativeEvaluatedLayout(FabricUIManager manager, int target, String owner, String binding, String revision, Object context, String request, long presentation);
  private static native String nativePopFrame(FabricUIManager manager, String request);
  private static native String nativeViewport(FabricUIManager manager, String request);
  // Access is serialized with invalidate; the C++ owner retains the manager
  // and unregisters its hook before releasing that retained manager.
  private long popHandle;
  private long tableHandle;
  private FabricUIManager tableManager;
  private CUITableStickyPresentation tableDriver;
  private RuntimeException tableFailure;
  private static native long nativeCreateTable(FabricUIManager manager, CUIMotionSnapshotModule module);
  private static native String nativeTableRequest(long handle, String request);
  private static native String nativeTableTargets(long handle);
  private static native void nativeTableSynchronize(long handle);
  private static native void nativeTableFrame(long handle, String lease, double[] geometry);
  private static native void nativeTableRetire(long handle, String lease);
  private static native void nativeCloseTable(long handle);
  private static native long nativeCreatePop(FabricUIManager manager);
  private static native String nativePopRequest(long handle, String request);
  private static native void nativeClosePop(long handle);

  @Override public synchronized String tableStickyPresentation(String encoded) {
    try {
      JSONObject request = new JSONObject(encoded);
      if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) {
        if ("release".equals(request.getString("action"))) return new JSONObject().put("lease", request.getString("lease")).put("released", true).toString();
        throw new IllegalStateException("Table sticky: module retired");
      }
      if (tableFailure != null && !"release".equals(request.getString("action"))) throw tableFailure;
      if (tableHandle == 0) {
        Object value = request.get("target");
        if (!(value instanceof Number)) throw new IllegalArgumentException("Table sticky: target required");
        double target = ((Number)value).doubleValue();
        if (!Double.isFinite(target) || target <= 0 || target > Integer.MAX_VALUE || target != Math.rint(target)) throw new IllegalArgumentException("Table sticky: invalid target");
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), (int)target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("Table sticky: Fabric unavailable");
        tableManager = (FabricUIManager)manager;
        tableHandle = nativeCreateTable(tableManager, this);
      }
      String result = nativeTableRequest(tableHandle, encoded);
      onTableStickyMount();
      return result;
    } catch (Exception failure) { throw new IllegalStateException("E_CUI_TABLE_STICKY", failure); }
  }
  @DoNotStrip private void onTableStickyMount() {
    UiThreadUtil.runOnUiThread(() -> {
      synchronized (CUIMotionSnapshotModule.this) {
        if (!valid.get() || tableHandle == 0) return;
        if (tableDriver == null) tableDriver = new CUITableStickyPresentation(this, getReactApplicationContext(), tableManager);
        tableDriver.synchronize();
      }
    });
  }
  synchronized String tableStickyTargets() { return tableHandle == 0 ? "[]" : nativeTableTargets(tableHandle); }
  synchronized void tableStickySynchronize() { if (tableHandle != 0) nativeTableSynchronize(tableHandle); }
  synchronized void tableStickyFrame(String lease, double[] geometry) { if (tableHandle != 0 && valid.get()) nativeTableFrame(tableHandle, lease, geometry); }
  synchronized void tableStickyRetire(String lease) { if (tableHandle != 0) nativeTableRetire(tableHandle, lease); }
  synchronized void tableStickyFailure(Exception failure) { if (tableFailure == null) tableFailure = new IllegalStateException("Table sticky: native frame failed", failure); }

  @Override public synchronized String popPresentation(String encoded) {
    try {
      JSONObject request = new JSONObject(encoded);
      if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) {
        if ("release".equals(request.getString("action")) && popHandle == 0) return new JSONObject().put("lease", request.getString("lease")).put("released", true).toString();
        throw new IllegalStateException("motion-module-retired");
      }
      if (popHandle == 0) {
        Object value = request.get("target");
        if (!(value instanceof Number)) throw new IllegalArgumentException("motion-target-invalid");
        double target = ((Number)value).doubleValue();
        if (!Double.isFinite(target) || target <= 0 || target > Integer.MAX_VALUE || target != Math.rint(target)) throw new IllegalArgumentException("motion-target-invalid");
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), (int)target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("motion-Fabric-unavailable");
        popHandle = nativeCreatePop((FabricUIManager)manager);
      }
      return nativePopRequest(popHandle, encoded);
    } catch (Exception failure) { throw new IllegalStateException("E_CUI_POP_PRESENTATION", failure); }
  }

  @Override public String getPopFrame(String encoded) { return readImmutableFrame(encoded, false); }
  @Override public String getViewportSnapshot(String encoded) { return readImmutableFrame(encoded, true); }
  private String readImmutableFrame(String encoded, boolean viewport) {
    try {
      if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("motion-module-retired");
      JSONObject request = new JSONObject(encoded);
      Object rawTarget = request.get("target");
      if (!(rawTarget instanceof Number)) throw new IllegalArgumentException("motion-target-invalid");
      double value = ((Number)rawTarget).doubleValue();
      if (!Double.isFinite(value) || value <= 0 || value > Integer.MAX_VALUE || value != Math.rint(value)) throw new IllegalArgumentException("motion-target-invalid");
      UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), (int)value);
      if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("motion-Fabric-unavailable");
      String result = viewport ? nativeViewport((FabricUIManager)manager, encoded) : nativePopFrame((FabricUIManager)manager, encoded);
      if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("motion-module-retired");
      return result;
    } catch (Exception failure) { throw new IllegalStateException(viewport ? "E_CUI_VIEWPORT" : "E_CUI_POP_FRAME", failure); }
  }

  private static void validate(JSONObject request, JSONObject identity) throws Exception {
    for (String key : strings) {
      if (!(request.get(key) instanceof String) || !request.getString(key).equals(identity.getString(key))) throw new IllegalStateException("motion-owner-mismatch");
    }
    for (String key : numbers) {
      Object value = request.get(key);
      if (!(value instanceof Number) || !Double.isFinite(((Number)value).doubleValue()) || request.getDouble(key) != identity.getDouble(key)) throw new IllegalStateException("motion-owner-mismatch");
    }
  }

  @Override public void getSnapshot(String encoded, Promise promise) {
    readOwnedSnapshot(encoded, promise, 0);
  }

  @Override public void getInitialValue(String encoded, Promise promise) {
    readOwnedSnapshot(encoded, promise, 1);
  }

  @Override public void evaluateLayout(String encoded, Promise promise) {
    readOwnedSnapshot(encoded, promise, 2);
  }

  private synchronized String evaluateOwnedLayout(FabricUIManager manager, int target, JSONObject identity, View view, String encoded) throws Exception {
    if (!valid.get()) throw new IllegalStateException("motion-module-retired");
    return nativeEvaluatedLayout(manager, target, identity.getString("ownerId"), identity.getString("bindingId"), identity.getString("nativeViewRevision"), view.getContext(), encoded, popHandle);
  }

  private void readOwnedSnapshot(String encoded, Promise promise, int kind) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        boolean initialValue = kind == 1;
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("motion-module-retired");
        JSONObject request = new JSONObject(encoded);
        Object rawTarget = request.get("target");
        if (!(rawTarget instanceof Number)) throw new IllegalArgumentException("motion-target-invalid");
        double numericTarget = ((Number)rawTarget).doubleValue();
        if (!Double.isFinite(numericTarget) || numericTarget <= 0 || numericTarget > Integer.MAX_VALUE || numericTarget != Math.rint(numericTarget)) throw new IllegalArgumentException("motion-target-invalid");
        Object nonce = request.get("requestId");
        if (!(nonce instanceof String) || ((String)nonce).isEmpty()) throw new IllegalArgumentException("motion-request-invalid");
        int target = (int)numericTarget;
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("motion-Fabric-unavailable");
        View view = manager.resolveView(target);
        if (!(view instanceof CUIFocusView)) throw new IllegalStateException("motion-actual-view-unavailable");
        JSONObject identity = ((CUIFocusView)view).motionSnapshotIdentity();
        validate(request, identity);
        String name = initialValue ? request.getString("name") : null;
        if (initialValue && name.isEmpty()) throw new IllegalArgumentException("motion-value-name-invalid");
        JSONObject result = new JSONObject(kind == 2 ? evaluateOwnedLayout((FabricUIManager)manager, target,
          identity, view, encoded) : initialValue ? nativeInitialValue((FabricUIManager)manager, target,
          identity.getString("ownerId"), identity.getString("bindingId"), identity.getString("nativeViewRevision"), name) :
          nativeSnapshot((FabricUIManager)manager, target, identity.getString("ownerId"), identity.getString("bindingId"), identity.getString("nativeViewRevision")));
        if (!valid.get() || manager.resolveView(target) != view) throw new IllegalStateException("motion-owner-retired");
        validate(identity, ((CUIFocusView)view).motionSnapshotIdentity());
        for (String key : strings) result.put(key, identity.get(key));
        for (String key : numbers) result.put(key, identity.get(key));
        result.put("requestId", nonce);
        promise.resolve(result.toString());
      } catch (Exception failure) { promise.reject(kind == 2 ? "E_CUI_MOTION_LAYOUT" : kind == 1 ? "E_CUI_MOTION_INITIAL_VALUE" : "E_CUI_MOTION_SNAPSHOT", failure); }
    });
  }

  @Override public synchronized void invalidate() {
    valid.set(false);
    if (popHandle != 0) { nativeClosePop(popHandle); popHandle = 0; }
    UiThreadUtil.runOnUiThread(() -> {
      synchronized (CUIMotionSnapshotModule.this) {
        if (backdrop != null) { backdrop.invalidate(); backdrop = null; }
        if (tableDriver != null) { tableDriver.invalidate(); tableDriver = null; }
        if (tableHandle != 0) { nativeCloseTable(tableHandle); tableHandle = 0; }
        tableManager = null;
      }
    });
    super.invalidate();
  }

  @Override public void getTargetGeometry(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("motion-module-retired");
        JSONObject request = new JSONObject(encoded);
        Object rawOwner = request.get("target"), rawSample = request.get("sampleTarget"), nonce = request.get("requestId");
        if (!(rawOwner instanceof Number) || !(rawSample instanceof Number) || !(nonce instanceof String) || ((String)nonce).isEmpty()) throw new IllegalArgumentException("motion-request-invalid");
        double ownerNumber = ((Number)rawOwner).doubleValue(), sampleNumber = ((Number)rawSample).doubleValue();
        if (!Double.isFinite(ownerNumber) || ownerNumber <= 0 || ownerNumber > Integer.MAX_VALUE || ownerNumber != Math.rint(ownerNumber) || !Double.isFinite(sampleNumber) || sampleNumber <= 0 || sampleNumber > Integer.MAX_VALUE || sampleNumber != Math.rint(sampleNumber)) throw new IllegalArgumentException("motion-target-invalid");
        int ownerTag = (int)ownerNumber, sampleTag = (int)sampleNumber;
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), ownerTag);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("motion-Fabric-unavailable");
        View ownerView = manager.resolveView(ownerTag), sampleView = manager.resolveView(sampleTag);
        if (!(ownerView instanceof CUIFocusView) || sampleView == null || !sampleView.isAttachedToWindow() || sampleView.getWindowToken() != ownerView.getWindowToken() || sampleView.getRootView() != ownerView.getRootView()) throw new IllegalStateException("motion-actual-target-window-unavailable");
        JSONObject identity = ((CUIFocusView)ownerView).motionSnapshotIdentity();
        validate(request, identity);
        JSONObject ownerSnapshot = CUIMotionGeometryObserver.querySnapshot(ownerView), sampleSnapshot = CUIMotionGeometryObserver.querySnapshot(sampleView);
        String nativeOwnerIdentity = ownerSnapshot.getJSONArray("ancestors").getJSONObject(0).getString("identity");
        if (!(request.get("nativeOwnerIdentity") instanceof String) || !nativeOwnerIdentity.equals(request.getString("nativeOwnerIdentity"))) throw new IllegalStateException("motion-owner-retired");
        if (!valid.get() || manager.resolveView(ownerTag) != ownerView || manager.resolveView(sampleTag) != sampleView || !sampleView.isAttachedToWindow() || sampleView.getWindowToken() != ownerView.getWindowToken()) throw new IllegalStateException("motion-target-retired");
        validate(identity, ((CUIFocusView)ownerView).motionSnapshotIdentity());
        JSONObject result = new JSONObject().put("kind", "native-target-geometry").put("requestId", nonce).put("sampleTarget", sampleTag).put("nativeOwnerIdentity", nativeOwnerIdentity).put("ownerSnapshot", ownerSnapshot).put("targetSnapshot", sampleSnapshot).put("observedAt", SystemClock.uptimeMillis());
        for (String key : strings) result.put(key, identity.get(key));
        for (String key : numbers) result.put(key, identity.get(key));
        promise.resolve(result.toString());
      } catch (Exception failure) { promise.reject("E_CUI_MOTION_TARGET_GEOMETRY", failure); }
    });
  }
}
