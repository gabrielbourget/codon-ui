package com.codonui.input;

import android.app.Activity;
import android.app.Application;
import android.content.BroadcastReceiver;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.text.Editable;
import android.text.Spannable;
import android.text.TextPaint;
import android.util.Log;
import android.view.View;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.mapbuffer.WritableMapBuffer;
import com.facebook.react.uimanager.StateWrapper;
import com.facebook.react.views.text.TextLayoutManager;
import com.facebook.react.views.text.internal.span.ReactTextPaintHolderSpan;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// Non-shipping SDK observer. No editor setter, listener replacement or measurement backend.
public final class CardEditorInspectionProvider extends ContentProvider {
  private static WeakReference<Activity> activity = new WeakReference<>(null);
  private static final Map<String, Held[]> held = new LinkedHashMap<>();
  private static final Map<String, NativeFontSnapshotAndroidAssertions.Cache> fonts = new LinkedHashMap<>();
  private static int sequence;

  private static void require(boolean value, String reason) {
    if (!value) throw new AssertionError(reason);
  }
  private static void record(JSONObject data) throws Exception {
    data.put("producer", FontSnapshotIdentity.PRODUCER).put("pid", Process.myPid());
    String text = data.toString();
    int message = ++sequence, parts = (text.length() + 767) / 768;
    for (int part = 0; part < parts; part++) Log.i("CUI_CARD_EDITOR_SDK", "CUI_CARD_EDITOR_SDK_CHUNK " +
      new JSONObject().put("message", message).put("part", part).put("parts", parts)
        .put("content", text.substring(part * 768, Math.min(text.length(), (part + 1) * 768))));
  }

  private static final class Paint {
    final TextPaint original;
    final android.graphics.Typeface face;
    final float size, scale, skew, spacing, density;
    final int flags, baseline;
    final String features;
    final int[] drawable;
    final int[] drawableValues;
    Paint(TextPaint paint) {
      original = paint; face = paint.getTypeface(); size = paint.getTextSize();
      scale = paint.getTextScaleX(); skew = paint.getTextSkewX(); spacing = paint.getLetterSpacing();
      flags = paint.getFlags(); density = paint.density; baseline = paint.baselineShift;
      features = paint.getFontFeatureSettings(); drawable = paint.drawableState;
      drawableValues = drawable == null ? null : drawable.clone();
    }
    void unchanged(TextPaint current) {
      require(current == original && current.getTypeface() == face && current.getTextSize() == size &&
        current.getTextScaleX() == scale && current.getTextSkewX() == skew && current.getLetterSpacing() == spacing &&
        current.getFlags() == flags && current.density == density && current.baselineShift == baseline &&
        java.util.Objects.equals(current.getFontFeatureSettings(), features) && current.drawableState == drawable &&
        Arrays.equals(current.drawableState, drawableValues), "original editor/cache paint changed");
    }
  }
  private static final class Held {
    final ReactEditText editor;
    final Editable editable;
    final StateWrapper state;
    final Spannable cached;
    final Object token;
    final Object[] spans;
    final int[] starts, ends, flags;
    final String text, cacheText;
    final int selectionStart, selectionEnd;
    final Paint paint, cachedPaint;
    Held(ReactEditText editor) {
      this.editor = editor; editable = editor.getText(); state = editor.getStateWrapper();
      require(state != null && state.getStateDataMapBuffer() != null &&
        state.getStateDataMapBuffer().getCount() == 0, "actual cached Android editor state required");
      require(editor.isAttachedToWindow() && editor.getWindowToken() != null, "actual attached editor window required");
      cached = cached(editor);
      token = editor.getWindowToken(); text = editable.toString(); cacheText = cached.toString();
      selectionStart = editor.getSelectionStart(); selectionEnd = editor.getSelectionEnd();
      spans = cached.getSpans(0, cached.length(), Object.class);
      starts = new int[spans.length]; ends = new int[spans.length]; flags = new int[spans.length];
      for (int index = 0; index < spans.length; index++) {
        starts[index] = cached.getSpanStart(spans[index]); ends[index] = cached.getSpanEnd(spans[index]); flags[index] = cached.getSpanFlags(spans[index]);
      }
      ReactTextPaintHolderSpan[] holders = cached.getSpans(0, 0, ReactTextPaintHolderSpan.class);
      require(holders.length == 1, "actual cached editor paint required");
      paint = new Paint(editor.getPaint()); cachedPaint = new Paint(holders[0].getTextPaint());
    }
    private static Spannable cached(ReactEditText editor) {
      return TextLayoutManager.INSTANCE.getOrCreateSpannableForText(editor.getContext().getAssets(),
        new WritableMapBuffer().put(TextLayoutManager.AS_KEY_CACHE_ID, editor.getId()), null);
    }
    JSONObject observation() throws Exception {
      JSONArray sourceSpans = new JSONArray();
      JSONArray parents = new JSONArray();
      android.view.ViewParent parent = editor.getParent();
      while (parent instanceof View) {
        require(parents.length() < 256, "native editor ancestry limit");
        View ancestor = (View)parent;
        parents.put(new JSONObject().put("tag", ancestor.getId()).put("nativeRef", System.identityHashCode(ancestor)));
        parent = ancestor.getParent();
      }
      for (int index = 0; index < spans.length; index++) sourceSpans.put(new JSONObject()
        .put("identity", System.identityHashCode(spans[index])).put("class", spans[index].getClass().getName())
        .put("start", starts[index]).put("end", ends[index]).put("flags", flags[index]));
      int[] location = new int[2]; editor.getLocationOnScreen(location);
      return new JSONObject().put("tag", editor.getId()).put("nativeRef", System.identityHashCode(editor))
        .put("editableRef", System.identityHashCode(editable)).put("cachedRef", System.identityHashCode(cached))
        .put("stateRef", System.identityHashCode(state)).put("cachedStateMapCount", state.getStateDataMapBuffer().getCount())
        .put("text", editor.getText().toString()).put("cacheText", cached.toString())
        .put("selection", new JSONArray().put(editor.getSelectionStart()).put(editor.getSelectionEnd()))
        .put("window", System.identityHashCode(editor.getWindowToken())).put("focused", editor.hasFocus())
        .put("layout", new JSONArray().put(location[0]).put(location[1]).put(editor.getWidth()).put(editor.getHeight()))
        .put("paintRef", System.identityHashCode(editor.getPaint())).put("typefaceRef", System.identityHashCode(editor.getPaint().getTypeface()))
        .put("fontSize", editor.getPaint().getTextSize()).put("features", editor.getPaint().getFontFeatureSettings())
        .put("spans", sourceSpans).put("parents", parents);
    }
    void unchanged() {
      require(editor.isAttachedToWindow() && editor.getWindowToken() == token && editor.getStateWrapper() == state &&
        state.getStateDataMapBuffer().getCount() == 0, "editor/window/state authority changed");
      require(editor.getText() == editable && editor.getText().toString().equals(text) &&
        editor.getSelectionStart() == selectionStart && editor.getSelectionEnd() == selectionEnd, "editor text/selection/ref changed");
      require(cached(editor) == cached && cached.toString().equals(cacheText), "original cached text replaced");
      Object[] current = cached.getSpans(0, cached.length(), Object.class);
      require(current.length == spans.length, "cached span count changed");
      for (int index = 0; index < current.length; index++) require(current[index] == spans[index] &&
        cached.getSpanStart(current[index]) == starts[index] && cached.getSpanEnd(current[index]) == ends[index] &&
        cached.getSpanFlags(current[index]) == flags[index], "cached span identity/order/boundaries changed");
      paint.unchanged(editor.getPaint());
      cachedPaint.unchanged(cached.getSpans(0, 0, ReactTextPaintHolderSpan.class)[0].getTextPaint());
    }
  }

  public static final class Receiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
      String phase = intent.getStringExtra("phase"), mode = intent.getStringExtra("mode"), request = intent.getStringExtra("request");
      try {
        UiThreadUtil.assertOnUiThread();
        Activity current = activity.get();
        require(current != null && !current.isDestroyed() && !current.isFinishing(), "actual resumed activity required");
        int[] tags = intent.getIntArrayExtra("targets");
        require(phase != null && phase.matches("initial|narrow|restore") && tags != null && tags.length == 2, "exact current two-editor request required");
        require(request != null && request.matches("[a-z0-9-]+"), "exact native inspection request required");
        JSONArray observations = new JSONArray();
        if ("locate".equals(mode)) {
          for (int tag : tags) {
            View view = current.getWindow().getDecorView().findViewById(tag);
            require(view instanceof ReactEditText && view.isAttachedToWindow(), "actual visible editor target required");
            int[] location = new int[2]; view.getLocationOnScreen(location);
            observations.put(new JSONObject().put("tag", tag).put("nativeRef", System.identityHashCode(view))
              .put("screenPixels", new JSONArray().put(location[0]).put(location[1]).put(view.getWidth()).put(view.getHeight())));
          }
        } else if ("before".equals(mode)) {
          require(!held.containsKey(phase), "repeated native baseline");
          Held[] values = new Held[tags.length];
          for (int index = 0; index < tags.length; index++) {
            View view = current.getWindow().getDecorView().findViewById(tags[index]);
            require(view instanceof ReactEditText, "original ReactEditText target required");
            values[index] = new Held((ReactEditText)view); observations.put(values[index].observation());
          }
          held.put(phase, values); fonts.put(phase, new NativeFontSnapshotAndroidAssertions.Cache());
        } else if ("after".equals(mode)) {
          Held[] values = held.remove(phase);
          require(values != null && values.length == tags.length, "original native baseline required");
          for (int index = 0; index < tags.length; index++) {
            require(values[index].editor.getId() == tags[index] &&
              current.getWindow().getDecorView().findViewById(tags[index]) == values[index].editor, "original native ref replaced");
            values[index].unchanged(); observations.put(values[index].observation());
          }
          NativeFontSnapshotAndroidAssertions.Cache cache = fonts.remove(phase);
          require(cache != null, "original font registry baseline required"); cache.unchanged();
        } else throw new IllegalArgumentException("Unknown native editor inspection mode");
        JSONObject result = new JSONObject().put("kind", "native-editor-" + mode).put("phase", phase).put("request", request).put("editors", observations)
          .put("originalFontCachesUnchanged", "after".equals(mode));
        record(result);
        File marker = new File(context.getCacheDir(), "card-editor-" + mode + "-" + FontSnapshotIdentity.PRODUCER + "-" + phase + ".json");
        try (FileOutputStream output = new FileOutputStream(marker)) { output.write(result.toString().getBytes(StandardCharsets.UTF_8)); }
      } catch (Throwable failure) {
        Log.e("CUI_CARD_EDITOR_SDK", "Original native editor inspection failed", failure);
        try { record(new JSONObject().put("kind", "native-editor-failure").put("phase", phase).put("mode", mode).put("failure", failure.toString())); }
        catch (Exception encoding) { throw new AssertionError(encoding); }
      }
    }
  }

  @Override public boolean onCreate() {
    Application app = (Application)getContext().getApplicationContext();
    app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
      public void onActivityCreated(Activity value, Bundle state) {}
      public void onActivityStarted(Activity value) {}
      public void onActivityResumed(Activity value) { activity = new WeakReference<>(value); }
      public void onActivityPaused(Activity value) { if (activity.get() == value) activity.clear(); }
      public void onActivityStopped(Activity value) {}
      public void onActivitySaveInstanceState(Activity value, Bundle state) {}
      public void onActivityDestroyed(Activity value) { if (activity.get() == value) activity.clear(); }
    });
    return true;
  }
  @Override public Cursor query(Uri uri, String[] projection, String selection, String[] arguments, String sort) { throw new UnsupportedOperationException(); }
  @Override public String getType(Uri uri) { return null; }
  @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
  @Override public int delete(Uri uri, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
  @Override public int update(Uri uri, ContentValues values, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
}
