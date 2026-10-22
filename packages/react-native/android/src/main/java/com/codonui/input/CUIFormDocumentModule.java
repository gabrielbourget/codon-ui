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

  @Override public void getSnapshot(String encoded, Promise promise) { performRequest(encoded, promise, false); }
  @Override public void focusField(String encoded, Promise promise) { performRequest(encoded, promise, true); }
  private void performRequest(String encoded, Promise promise, boolean focus) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        JSONObject request = new JSONObject(encoded);
        int target = positiveInteger(request, "target"), surface = request.has("surfaceId") ? positiveInteger(request, "surfaceId") : 0;
        Object nonce = request.get("requestId");
        if (!(nonce instanceof String) || ((String)nonce).isEmpty()) throw new IllegalArgumentException("form-request-id-invalid");
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("form-Fabric-unavailable");
        String snapshot = readSnapshot((FabricUIManager)manager, surface, target);
        JSONObject response = new JSONObject(snapshot);
        if (focus) {
          String origin = request.getString("origin");
          if (!("native".equals(origin) && request.has("actionAdmission")) &&
              !("programmatic".equals(origin) && !request.has("actionAdmission"))) throw new IllegalArgumentException("form-focus-origin-invalid");
          if (request.has("inspect")) throw new IllegalArgumentException("form-focus-inspection-not-admitted");
        }
        if (request.has("actionAdmission")) {
          response.put("actionAdmission", CUIFormActionAdmission.admit(manager, response, request.getJSONObject("actionAdmission")));
          if (!snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target))) throw new IllegalStateException("form-document-retired-during-action-admission");
        }
        if (request.optBoolean("inspect", false)) {
          Integer control = request.has("controlTarget") ? positiveInteger(request, "controlTarget") : null;
          response.put("inspection", CUIFormDocumentInspection.inspect(manager, response, control));
          if (!snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target))) throw new IllegalStateException("form-document-retired-during-inspection");
        }
        if (focus) {
          response.put("focus", CUIFormFieldFocus.focus(manager, response, request,
            () -> {
              if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) return false;
              if (request.has("actionAdmission")) CUIFormActionAdmission.admit(manager, response, request.getJSONObject("actionAdmission"));
              return snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target));
            }));
        }
        if (!focus && (!valid.get() || !getReactApplicationContext().hasActiveReactInstance())) throw new IllegalStateException("form-module-retired");
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
