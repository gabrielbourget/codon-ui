package com.codonui.input;

import android.view.View;
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
}
