package com.codonui.input;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@ReactModule(name = CUIFormDocumentModule.NAME)
public final class CUIFormDocumentModule extends NativeCUIFormDocumentSpec {
  static { System.loadLibrary("codon_motion"); }
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private long session = nativeCreateFormSession(UUID.randomUUID().toString());
  CUIFormDocumentModule(ReactApplicationContext context) { super(context); }
  private static native String nativeFormDocument(FabricUIManager manager, int surface, int target, long session);
  private static native long nativeCreateFormSession(String identity);
  private static native void nativeRetireFormSession(long session);

  private static int positiveInteger(JSONObject request, String key) throws Exception {
    Object raw = request.get(key);
    if (!(raw instanceof Number)) throw new IllegalArgumentException("form-target-invalid");
    double value = ((Number)raw).doubleValue();
    if (!Double.isFinite(value) || value <= 0 || value > Integer.MAX_VALUE || value != Math.rint(value))
      throw new IllegalArgumentException("form-target-invalid");
    return (int)value;
  }

  private synchronized String readSnapshot(FabricUIManager manager, int surface, int target) {
    if (!valid.get() || session == 0) throw new IllegalStateException("form-module-retired");
    return nativeFormDocument(manager, surface, target, session);
  }

  @Override public void getSnapshot(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        JSONObject request = new JSONObject(encoded);
        int target = positiveInteger(request, "target"), surface = request.has("surfaceId") ? positiveInteger(request, "surfaceId") : 0;
        Object nonce = request.get("requestId");
        if (!(nonce instanceof String) || ((String)nonce).isEmpty()) throw new IllegalArgumentException("form-request-id-invalid");
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("form-Fabric-unavailable");
        JSONObject response = new JSONObject(readSnapshot((FabricUIManager)manager, surface, target));
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        response.put("requestId", nonce);
        promise.resolve(response.toString());
      } catch (Exception failure) { promise.reject("E_CUI_FORM_DOCUMENT", failure); }
    });
  }

  @Override public synchronized void invalidate() {
    valid.set(false);
    if (session != 0) { nativeRetireFormSession(session); session = 0; }
    super.invalidate();
  }
}
