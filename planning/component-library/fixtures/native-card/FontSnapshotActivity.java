package com.codonui.input;

import android.app.Activity;
import android.os.Bundle;
import android.os.Process;
import android.util.Log;
import android.widget.TextView;
import org.json.JSONObject;

// Added only to a frozen non-shipping native verification product by its live build helper.
public final class FontSnapshotActivity extends Activity {
  private static boolean started;
  private static int entries;
  private void record(JSONObject value) {
    Log.i("CUI_CARD_FONT", value.toString());
  }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    TextView result = new TextView(this);
    result.setText("Codon Card native font snapshot verification");
    setContentView(result);
    int entry = ++entries;
    if (started) {
      try { record(new JSONObject().put("kind", "scene-entry-suppressed").put("entry", entry)
        .put("producer", FontSnapshotIdentity.PRODUCER).put("pid", Process.myPid())); }
      catch (Exception failure) { throw new AssertionError(failure); }
      result.setText("Native font gate already started in this process");
      return;
    }
    started = true;
    result.post(() -> {
      try {
        if (isDestroyed() || isFinishing()) throw new IllegalStateException("Native font scene retired before its first attempt");
        record(new JSONObject().put("kind", "begin").put("producer", FontSnapshotIdentity.PRODUCER).put("pid", Process.myPid()));
        NativeFontSnapshotAndroidAssertions.run(this, this::record);
        result.setText("Card font snapshot native assertions passed");
        record(new JSONObject().put("kind", "terminal").put("outcome", "native-font-pass").put("producer", FontSnapshotIdentity.PRODUCER));
      } catch (Throwable failure) {
        Log.e("CUI_CARD_FONT", "Native font assertion failed", failure);
        try { record(new JSONObject().put("kind", "terminal").put("outcome", "failed").put("failure", failure.toString())); }
        catch (Exception ignored) { throw new AssertionError(ignored); }
        result.setText(failure.toString());
      }
    });
  }
}
