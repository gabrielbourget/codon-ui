package com.codonui.input;

import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.ThemedReactContext;
import org.json.JSONObject;

@DoNotStrip
final class CUIDragActionDispatch {
  interface Current { boolean check(); }
  private final CUIKeyboardScope scope;
  private final JSONObject identity;
  private final Current original;
  private CUIDragActionDispatch(CUIKeyboardScope scope, JSONObject identity, Current original) {
    this.scope = scope; this.identity = identity; this.original = original;
  }
  private static native String nativeDispatch(FabricUIManager manager, CUIDragActionDispatch owner, String identity, String payload, boolean pointer);
  static String run(CUIKeyboardScope scope, JSONObject identity, JSONObject payload, boolean pointer, Current current) throws Exception {
    UiThreadUtil.assertOnUiThread();
    CUIDragActionDispatch owner = new CUIDragActionDispatch(scope, new JSONObject(identity.toString()), current);
    if (!owner.current()) throw new IllegalStateException("native-drag-original-view-required");
    UIManager manager = UIManagerHelper.getUIManagerForReactTag((ThemedReactContext)scope.getContext(), scope.getId());
    if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("native-drag-original-Fabric-required");
    return nativeDispatch((FabricUIManager)manager, owner, identity.toString(), payload.toString(), pointer);
  }
  @DoNotStrip boolean current() {
    UiThreadUtil.assertOnUiThread();
    try {
      return original != null && original.check() && scope.dragCaptureReady() && identity.getInt("scopeTarget") == scope.getId() &&
        identity.getInt("surfaceId") == UIManagerHelper.getSurfaceId(scope) && identity.getString("ownerId").equals(scope.formActionOwnerId()) &&
        identity.getDouble("epoch") == scope.formActionEpoch() && identity.getString("windowId").equals(CUIInputWindow.identity(scope));
    } catch (Exception error) { return false; }
  }
  @DoNotStrip String mountWitness() { UiThreadUtil.assertOnUiThread(); return scope.dragMountWitness(); }
}
