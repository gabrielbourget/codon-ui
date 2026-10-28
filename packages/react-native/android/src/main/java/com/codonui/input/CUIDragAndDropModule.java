package com.codonui.input;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.annotations.ReactModule;
import org.json.JSONArray;
import org.json.JSONObject;

@ReactModule(name = CUIDragAndDropModule.NAME)
public final class CUIDragAndDropModule extends NativeCUIDragAndDropSpec {
  public static final String NAME = "CUIDragAndDrop";
  private final CUIDragDataStore data;

  public CUIDragAndDropModule(ReactApplicationContext context) {
    super(context); data = new CUIDragDataStore(context);
  }
  @Override public String getName() { return NAME; }
  @Override public String getLease() { return data.moduleId; }
  private <T> CUIDragDataStore.Reply<T> record(Promise promise) {
    return (value, error) -> {
      if (error != null) promise.reject("E_CUI_DRAG_DATA", error);
      else if (value instanceof JSONObject || value instanceof JSONArray || value instanceof String) promise.resolve(value.toString());
      else promise.reject("E_CUI_DRAG_DATA", "Native drag data: invalid native response");
    };
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
  @Override public void invalidate() { data.invalidate(); super.invalidate(); }
}
