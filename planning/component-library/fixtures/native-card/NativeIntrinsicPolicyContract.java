package com.codonui.input;

import android.content.Context;
import android.text.NoCopySpan;
import android.text.SpanWatcher;
import android.text.Spannable;
import android.text.TextWatcher;
import android.text.Editable;
import android.text.style.ParagraphStyle;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.mapbuffer.ReadableMapBuffer;
import com.facebook.react.views.text.internal.span.CustomLineHeightSpan;
import com.facebook.react.views.text.internal.span.ReactFragmentIndexSpan;
import com.facebook.react.views.text.internal.span.ReactSpan;
import com.facebook.react.views.text.internal.span.ReactTagSpan;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

// Executes real production policy/peer descriptors on a host JVM; no Android layout is run.
public final class NativeIntrinsicPolicyContract {
  private static int assertions;
  private static void require(boolean condition, String message) {
    assertions++; if (!condition) throw new AssertionError(message);
  }
  private static Object invoke(Method method, Object... arguments) throws Exception {
    try { return method.invoke(null, arguments); }
    catch (InvocationTargetException failure) {
      if (failure.getCause() instanceof Exception) throw (Exception)failure.getCause();
      throw failure;
    }
  }
  private static void rejects(Method method, String message, Object... arguments) throws Exception {
    try { invoke(method, arguments); throw new AssertionError("accepted " + message); }
    catch (IllegalArgumentException | IllegalStateException failure) { require(failure.getMessage().contains(message), message); }
  }
  private static final class Watcher implements SpanWatcher, TextWatcher, NoCopySpan {
    int calls;
    public void onSpanAdded(Spannable text, Object span, int start, int end) { calls++; }
    public void onSpanRemoved(Spannable text, Object span, int start, int end) { calls++; }
    public void onSpanChanged(Spannable text, Object span, int a, int b, int c, int d) { calls++; }
    public void beforeTextChanged(CharSequence text, int start, int count, int after) { calls++; }
    public void onTextChanged(CharSequence text, int start, int before, int count) { calls++; }
    public void afterTextChanged(Editable text) { calls++; }
  }
  private static final class Marker implements NoCopySpan {}
  private static final class UnknownReactSpan implements ReactSpan {}
  private static final class ParagraphMarker implements ParagraphStyle, NoCopySpan {}

  public static void main(String[] arguments) throws Exception {
    require(arguments.length == 1 && CUIMotionIntrinsics.class.getProtectionDomain().getCodeSource().getLocation().getPath().equals(arguments[0]), "actual current AAR owner class loaded");
    Method span = CUIMotionIntrinsics.class.getDeclaredMethod("measurementSpan", Object.class);
    Method bounds = CUIMotionIntrinsics.class.getDeclaredMethod("bounds", float.class, float.class);
    span.setAccessible(true); bounds.setAccessible(true);
    Watcher watcher = new Watcher();
    require(invoke(span, watcher) == null, "watcher excluded from scratch copy");
    require(watcher.calls == 0, "watcher callbacks never invoked");
    require(invoke(span, new Marker()) == null, "non-measuring marker excluded");
    rejects(span, "unaudited cached span", new ParagraphMarker());
    rejects(span, "unaudited cached span", new UnknownReactSpan());
    rejects(span, "unaudited cached span", new Object());
    Object[] audited = {new ReactTagSpan(17), new ReactFragmentIndexSpan(3), new CustomLineHeightSpan(27.2f)};
    for (Object value : audited) require(invoke(span, value) == value, "immutable audited metadata retained");
    float[][] valid = {{0,0},{0,100},{0,Float.POSITIVE_INFINITY},{13,13},{1,Float.POSITIVE_INFINITY}};
    for (float[] value : valid) { invoke(bounds, value[0], value[1]); require(true, "valid bounds"); }
    float[][] invalid = {{Float.NaN,100},{-1,100},{0,Float.NaN},{Float.POSITIVE_INFINITY,Float.POSITIVE_INFINITY},{1,0},{0,Float.NEGATIVE_INFINITY}};
    for (float[] value : invalid) rejects(bounds, "invalid intrinsic constraints", value[0], value[1]);
    require(CUIMotionIntrinsics.class.getDeclaredMethod("create", Context.class).getReturnType() == CUIMotionIntrinsics.class, "typed JNI Context factory descriptor");
    require(CUIMotionIntrinsics.class.getDeclaredMethod("cachedEditor", ReadableMapBuffer.class, ReadableMapBuffer.class,
      float.class, float.class, float.class, float.class).getReturnType() == long.class, "cached editor JNI descriptor");
    require(CUIMotionIntrinsics.class.getDeclaredMethod("progress", ReadableMap.class,
      float.class, float.class, float.class, float.class).getReturnType() == long.class, "progress JNI descriptor");
    Class<?> pinned = Class.forName("com.codonui.input.CUIMotionIntrinsics$PinnedLayout");
    require(pinned.getDeclaredField("create").get(null) instanceof Method, "actual pinned private helper resolves");
    require(pinned.getDeclaredField("layout").get(null) instanceof Method, "actual pinned Layout getter resolves");
    System.out.println("PASS " + assertions + " production policy/actual peer-descriptor assertions; no Android layout, native paint, original cached text or installed proof");
  }
}
