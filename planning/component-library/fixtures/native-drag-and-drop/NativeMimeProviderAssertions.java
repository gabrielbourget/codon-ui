package com.codonui.input;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.os.CancellationSignal;
import android.os.OperationCanceledException;
import android.widget.EditText;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

// Compile only until a separately authorized matching native harness supplies the
// merged provider and original held editor. Cross-app OS grant proof remains separate.
public final class NativeMimeProviderAssertions {
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static byte[] read(InputStream input) throws Exception {
    ByteArrayOutputStream result = new ByteArrayOutputStream(); byte[] buffer = new byte[1024]; int size;
    while ((size = input.read(buffer)) != -1) result.write(buffer, 0, size);
    return result.toByteArray();
  }
  public static void run(Context context, EditText original) throws Exception {
    String value = original.getText().toString(); int start = original.getSelectionStart(), end = original.getSelectionEnd();
    String module = "native-transport-fixture";
    JSONArray rows = new JSONArray().put(new JSONObject().put("type", "application/x-codon-unicode").put("data", "雪\uD83D\uDE80"))
      .put(new JSONObject().put("type", "text/plain").put("data", ""))
      .put(new JSONObject().put("type", "text/html").put("data", "<b>held</b>"));
    CUIDragDataProvider.Exported exported = CUIDragDataProvider.export(context, module, new JSONArray().put(rows));
    ContentResolver resolver = context.getContentResolver(); android.net.Uri uri = exported.uris.get(0);
    try {
      ClipData.Item item = exported.clip.getItemAt(0);
      check(item.getUri().equals(uri) && item.getText().toString().isEmpty(), "actual original URI/empty text carrier");
      check(item.getHtmlText().equals("<b>held</b>"), "actual original HTML field");
      check(item.getIntent().getStringExtra(CUIDragDataStore.STRING_MAP_EXTRA).equals(rows.toString()), "original per-item MIME order/value map");
      check(Arrays.equals(resolver.getStreamTypes(uri, "*/*"), new String[]{"application/x-codon-unicode", "text/plain", "text/html"}), "exact provider stream types/order");
      for (String type : resolver.getStreamTypes(uri, "*/*")) {
        try (AssetFileDescriptor descriptor = resolver.openTypedAssetFileDescriptor(uri, type, null);
            InputStream input = descriptor.createInputStream()) {
          String expected = type.equals("text/plain") ? "" : type.equals("text/html") ? "<b>held</b>" : "雪\uD83D\uDE80";
          check(Arrays.equals(read(input), expected.getBytes(StandardCharsets.UTF_8)), "exact MIME-specific UTF-8 bytes");
        }
      }
      CancellationSignal cancelled = new CancellationSignal(); cancelled.cancel();
      try { resolver.openTypedAssetFileDescriptor(uri, "text/plain", null, cancelled); throw new AssertionError("cancelled open accepted"); }
      catch (OperationCanceledException expected) {}
      try { resolver.openOutputStream(uri); throw new AssertionError("write accepted"); }
      catch (FileNotFoundException expected) {}
      try (AssetFileDescriptor descriptor = resolver.openTypedAssetFileDescriptor(uri, "text/html", null);
          InputStream input = descriptor.createInputStream()) {
        CUIDragDataProvider.releaseModule(context, module);
        check(new String(read(input), StandardCharsets.UTF_8).equals("<b>held</b>"), "already opened reader survives module retirement");
      }
      try { resolver.openTypedAssetFileDescriptor(uri, "text/html", null); throw new AssertionError("retired open accepted"); }
      catch (FileNotFoundException | IllegalArgumentException expected) {}
      check(original.getText().toString().equals(value) && original.getSelectionStart() == start && original.getSelectionEnd() == end,
        "original editor text/selection retained");
    } finally { CUIDragDataProvider.releaseModule(context, module); }
  }
}
