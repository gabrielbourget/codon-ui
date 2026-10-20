package com.codonui.input;

import android.view.View;
import android.os.SystemClock;
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
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private static final String[] strings = {"ownerId", "bindingId", "windowId", "scopeOwnerId", "nativeViewRevision"};
  private static final String[] numbers = {"target", "epoch", "attachmentRevision"};

  CUIMotionSnapshotModule(ReactApplicationContext context) { super(context); }
  private static native String nativeSnapshot(FabricUIManager manager, int target, String owner, String binding, String revision);

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
    UiThreadUtil.runOnUiThread(() -> {
      try {
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
        JSONObject result = new JSONObject(nativeSnapshot((FabricUIManager)manager, target,
          identity.getString("ownerId"), identity.getString("bindingId"), identity.getString("nativeViewRevision")));
        if (!valid.get() || manager.resolveView(target) != view) throw new IllegalStateException("motion-owner-retired");
        validate(identity, ((CUIFocusView)view).motionSnapshotIdentity());
        for (String key : strings) result.put(key, identity.get(key));
        for (String key : numbers) result.put(key, identity.get(key));
        result.put("requestId", nonce);
        promise.resolve(result.toString());
      } catch (Exception failure) { promise.reject("E_CUI_MOTION_SNAPSHOT", failure); }
    });
  }

  @Override public void invalidate() { valid.set(false); super.invalidate(); }

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
