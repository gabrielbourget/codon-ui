package com.codonui.input;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import android.view.View;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder;
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings;
import org.json.JSONArray;
import org.json.JSONObject;

@ReactModule(name = CUIDragAndDropModule.NAME)
public final class CUIDragAndDropModule extends NativeCUIDragAndDropSpec implements TurboModuleWithJSIBindings {
  static { System.loadLibrary("codon_motion"); }
  public static final String NAME = "CUIDragAndDrop";
  private final CUIDragDataStore data;
  private final BindingsInstallerHolder actions;
  private static native BindingsInstallerHolder nativeActionBindings(String moduleId);
  private static native boolean nativeAcceptsAction(String moduleId, String request);
  private static native boolean nativeSettleAction(String moduleId, String request);
  private static native void nativeRetireActions(String moduleId);

  public CUIDragAndDropModule(ReactApplicationContext context) {
    super(context); data = new CUIDragDataStore(context); actions = nativeActionBindings(data.moduleId);
  }
  @Override public BindingsInstallerHolder getBindingsInstaller() { return actions; }
  @Override public boolean acceptsAction(String request) { return nativeAcceptsAction(data.moduleId, request); }
  @Override public boolean settleAction(String request) { return nativeSettleAction(data.moduleId, request); }
  @Override public String getName() { return NAME; }
  @Override public String getLease() { return data.moduleId; }
  private <T> CUIDragDataStore.Reply<T> record(Promise promise) {
    return (value, error) -> {
      if (error != null) promise.reject("E_CUI_DRAG_DATA", error);
      else if (value instanceof JSONObject || value instanceof JSONArray || value instanceof String) promise.resolve(value.toString());
      else promise.reject("E_CUI_DRAG_DATA", "Native drag data: invalid native response");
    };
  }
  @Override public void readGeometry(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        JSONObject request=new JSONObject(encoded);
        if (!request.getString("moduleId").equals(data.moduleId) || CUIDragDataStore.forModule(data.moduleId)!=data) throw new IllegalStateException("native-drag-geometry-module-retired");
        UIManager manager=UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(),request.getInt("scopeTarget"));
        View view=manager==null?null:manager.resolveView(request.getInt("scopeTarget"));
        if (!(view instanceof CUIKeyboardScope)) throw new IllegalStateException("native-drag-geometry-scope-retired");
        promise.resolve(((CUIKeyboardScope)view).dragInteractions.geometry(request).toString());
      } catch (Exception error) { promise.reject("E_CUI_DRAG_GEOMETRY",error); }
    });
  }
  @Override public void readItems(String request, Promise promise) {
    try { data.readItems(new JSONObject(request), record(promise)); }
    catch (Exception error) { promise.reject("E_CUI_DRAG_DATA", error); }
  }
  @Override public boolean adoptItems(String request) {
    try { return data.adoptItems(new JSONObject(request)); } catch (Exception error) { return false; }
  }
  @Override public void readText(String request, Promise promise) {
    try { data.readText(new JSONObject(request), record(promise)); }
    catch (Exception error) { promise.reject("E_CUI_DRAG_DATA", error); }
  }
  @Override public void readFile(String request, Promise promise) {
    try { data.readFile(new JSONObject(request), record(promise)); }
    catch (Exception error) { promise.reject("E_CUI_DRAG_DATA", error); }
  }
  @Override public boolean adoptFile(String request) {
    try { return data.adoptFile(new JSONObject(request)); } catch (Exception error) { return false; }
  }
  @Override public void readDirectory(String request, Promise promise) {
    try { data.readDirectory(new JSONObject(request), record(promise)); }
    catch (Exception error) { promise.reject("E_CUI_DRAG_DATA", error); }
  }
  @Override public void closeDirectory(String request) {
    try { data.closeDirectory(new JSONObject(request)); }
    catch (Exception error) { throw new IllegalStateException("Native drag data: directory cleanup failed", error); }
  }
  @Override public void releaseData(String request) {
    try { data.releaseData(new JSONObject(request)); }
    catch (Exception error) { throw new IllegalStateException("Native drag data: original resource cleanup failed", error); }
  }
  @Override public void invalidate() { nativeRetireActions(data.moduleId); data.invalidate(); super.invalidate(); }
}
