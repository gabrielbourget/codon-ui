package com.codonui.input;

import android.graphics.Color;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewParent;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ColorPropConverter;
import com.facebook.react.bridge.JavaOnlyArray;
import com.facebook.react.bridge.JavaOnlyMap;
import com.facebook.react.bridge.WritableMap;
import java.lang.ref.WeakReference;
import java.util.Arrays;
import java.util.Iterator;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class CUIMotionColorSampler {
  private final WeakReference<View> root;
  private final Consumer<WritableMap> emit;
  private String owner = "";
  private boolean enabled;
  private boolean detached;
  private long revision;
  private String signature;

  CUIMotionColorSampler(View root, Consumer<WritableMap> emit) { this.root = new WeakReference<>(root); this.emit = emit; }
  void updateOwner(String owner, boolean enabled) {
    if (!this.owner.equals(owner) || this.enabled != enabled) { revision++; signature = null; }
    this.owner = owner; this.enabled = enabled;
  }
  private WritableMap environment() {
    View view = root.get();
    boolean attached = view != null && !detached && view.isAttachedToWindow();
    WritableMap result = Arguments.createMap();
    result.putString("ownerId", owner); result.putInt("target", view == null ? View.NO_ID : view.getId());
    result.putString("windowId", attached ? CUIInputWindow.identity(view) : "");
    result.putString("scopeOwnerId", ""); result.putDouble("epoch", 0);
    if (attached) for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent()) {
      if (parent instanceof CUIKeyboardScope) { ((CUIKeyboardScope) parent).writeActivationSession(result); break; }
    }
    result.putDouble("environmentRevision", revision); result.putBoolean("attached", attached);
    result.putDouble("observedAt", SystemClock.uptimeMillis());
    return result;
  }
  private WritableMap refresh() {
    WritableMap result = environment();
    View view = root.get();
    String next = result.getString("windowId") + "|" + result.getString("scopeOwnerId") + "|" + result.getDouble("epoch")
        + "|" + (view == null ? "" : view.getResources().getConfiguration().toString() + "|" + view.getContext().getTheme().hashCode() + "|" + Arrays.toString(view.getDrawableState()));
    if (!next.equals(signature)) { signature = next; revision++; result.putDouble("environmentRevision", revision); }
    return result;
  }
  private void emitEnvironment(WritableMap environment, String requestId) {
    if (!enabled) return;
    WritableMap result = Arguments.createMap(); result.merge(environment);
    result.putString("kind", "environment"); result.putString("requestId", requestId);
    result.putString("colors", "[]"); result.putString("error", ""); emit.accept(result);
  }
  void synchronize() {
    if (!enabled) return;
    long before = revision; WritableMap environment = refresh();
    if (before != revision) emitEnvironment(environment, "");
  }
  private static Object decoded(Object value) throws JSONException {
    if (value == JSONObject.NULL) return null;
    if (value instanceof Number) return ((Number) value).doubleValue();
    if (value instanceof JSONObject) {
      JavaOnlyMap result = new JavaOnlyMap(); JSONObject input = (JSONObject) value;
      Iterator<String> keys = input.keys();
      while (keys.hasNext()) {
        String key = keys.next(); Object item = decoded(input.get(key));
        if (item == null) result.putNull(key);
        else if (item instanceof Number) result.putDouble(key, ((Number) item).doubleValue());
        else if (item instanceof String) result.putString(key, (String) item);
        else if (item instanceof Boolean) result.putBoolean(key, (Boolean) item);
        else if (item instanceof JavaOnlyMap) result.putMap(key, (JavaOnlyMap) item);
        else if (item instanceof JavaOnlyArray) result.putArray(key, (JavaOnlyArray) item);
      }
      return result;
    }
    if (value instanceof JSONArray) {
      JavaOnlyArray result = new JavaOnlyArray(); JSONArray input = (JSONArray) value;
      for (int index = 0; index < input.length(); index++) {
        Object item = decoded(input.get(index));
        if (item == null) result.pushNull();
        else if (item instanceof Number) result.pushDouble(((Number) item).doubleValue());
        else if (item instanceof String) result.pushString((String) item);
        else if (item instanceof Boolean) result.pushBoolean((Boolean) item);
        else if (item instanceof JavaOnlyMap) result.pushMap((JavaOnlyMap) item);
        else if (item instanceof JavaOnlyArray) result.pushArray((JavaOnlyArray) item);
      }
      return result;
    }
    return value;
  }
  void sample(String owner, String requestId, String request) {
    if (!enabled || !this.owner.equals(owner) || requestId == null || requestId.isEmpty()) return;
    WritableMap environment = refresh(); JSONArray colors = new JSONArray(); String error = "";
    try {
      JSONObject parsed = new JSONObject(request);
      if ("environment".equals(parsed.optString("kind"))) { emitEnvironment(environment, requestId); return; }
      JSONArray input = parsed.getJSONArray("colors");
      if (!environment.getBoolean("attached")) error = "native-color-view-detached";
      else if (!parsed.getString("windowId").equals(environment.getString("windowId")) || !parsed.getString("scopeOwnerId").equals(environment.getString("scopeOwnerId")) || parsed.getDouble("epoch") != environment.getDouble("epoch") || parsed.getDouble("environmentRevision") != environment.getDouble("environmentRevision")) error = "stale-native-color-environment";
      View view = root.get();
      if (error.isEmpty() && view != null) for (int index = 0; index < input.length(); index++) {
        try {
          Object encoded = decoded(input.get(index));
          if (Build.VERSION.SDK_INT >= 26) {
            Color color = ColorPropConverter.getColorInstance(encoded, view.getContext());
            if (color == null) throw new IllegalArgumentException("unresolved-native-color");
            if (!color.getColorSpace().isSrgb()) throw new IllegalArgumentException("unsupported-native-color-space");
            colors.put(new JSONArray(new double[]{color.red(), color.green(), color.blue(), color.alpha()}));
          } else {
            Integer color = ColorPropConverter.getColor(encoded, view.getContext());
            if (color == null) throw new IllegalArgumentException("unresolved-native-color");
            colors.put(new JSONArray(new double[]{Color.red(color) / 255.0, Color.green(color) / 255.0, Color.blue(color) / 255.0, Color.alpha(color) / 255.0}));
          }
        } catch (RuntimeException failure) { colors.put(JSONObject.NULL); error = "unsupported-native-color-space".equals(failure.getMessage()) ? failure.getMessage() : "unresolved-native-color"; }
      }
    } catch (JSONException | RuntimeException failure) { error = "invalid-color-request"; }
    if (!error.isEmpty()) emitEnvironment(environment, "");
    environment.putString("kind", "sample"); environment.putString("requestId", requestId);
    environment.putString("colors", colors.toString()); environment.putString("error", error); emit.accept(environment);
  }
  void attached() { detached = false; synchronize(); }
  void detached() { detached = true; synchronize(); }
  void invalidate() { enabled = false; revision++; signature = null; owner = ""; }
}
