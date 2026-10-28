package com.codonui.input;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Non-exported read-only OS drag carrier. Android admits other apps only through
 * the URI read grant on the original ClipData. No caller path or URI is opened. */
public final class CUIDragDataProvider extends ContentProvider {
  private static final String AUTHORITY_SUFFIX = ".codon-drag-data";
  private static final ExecutorService streams = Executors.newFixedThreadPool(2);

  static final class Exported {
    final ClipData clip;
    final String moduleId;
    final List<Uri> uris;
    Exported(ClipData clip, String moduleId, List<Uri> uris) {
      this.clip = clip; this.moduleId = moduleId; this.uris = Collections.unmodifiableList(new ArrayList<>(uris));
    }
    // Only a lift which never started can abandon its unpublished payloads.
    void abandon(Context context) {
      RuntimeException failure = null;
      for (Uri uri : uris) if (CUIDragMimePayloads.release(moduleId, uri.getLastPathSegment())) {
        try { context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
        catch (RuntimeException error) { if (failure == null) failure = error; }
      }
      if (failure != null) throw failure;
    }
  }

  private static Uri uri(Context context, String token) {
    return new Uri.Builder().scheme("content").authority(context.getPackageName() + AUTHORITY_SUFFIX)
      .appendPath(token).build();
  }

  static Exported export(Context context, String moduleId, JSONArray maps) throws Exception {
    List<Uri> uris = new ArrayList<>(); List<ClipData.Item> items = new ArrayList<>();
    Set<String> types = new LinkedHashSet<>(); types.add(CUIDragDataStore.STRING_MAP_TYPE);
    try {
      for (int index = 0; index < maps.length(); index++) {
        JSONArray rows = maps.getJSONArray(index); LinkedHashMap<String, String> values = new LinkedHashMap<>();
        for (int rowIndex = 0; rowIndex < rows.length(); rowIndex++) {
          JSONObject row = rows.getJSONObject(rowIndex);
          if (row.length() != 2 || !(row.get("type") instanceof String) || !(row.get("data") instanceof String) ||
              values.put(row.getString("type"), row.getString("data")) != null)
            throw new IllegalArgumentException("Native drag export: invalid original MIME snapshot");
        }
        CUIDragMimePayloads.Snapshot snapshot = CUIDragMimePayloads.retain(moduleId, values);
        Uri uri = uri(context, snapshot.token); uris.add(uri); types.addAll(values.keySet());
        String authoredIntent = values.get(ClipDescription.MIMETYPE_TEXT_INTENT);
        Intent carrier = authoredIntent == null ? new Intent() : Intent.parseUri(authoredIntent, Intent.URI_INTENT_SCHEME);
        // The complete authored representation stays byte-exact in the URI and string-map carrier.
        carrier.putExtra(CUIDragDataStore.STRING_MAP_EXTRA, rows.toString());
        String html = values.get(ClipDescription.MIMETYPE_TEXT_HTML), plain = values.get(ClipDescription.MIMETYPE_TEXT_PLAIN);
        // Android requires a text field alongside HTML; an absent authored plain MIME stays absent.
        items.add(new ClipData.Item(plain == null && html != null ? "" : plain, html, carrier, uri));
      }
      if (items.isEmpty()) throw new IllegalArgumentException("Native drag export: original items required");
      ClipData clip = new ClipData(new ClipDescription("", types.toArray(new String[0])), items.get(0));
      for (int index = 1; index < items.size(); index++) clip.addItem(items.get(index));
      return new Exported(clip, moduleId, uris);
    } catch (Exception failure) {
      for (Uri uri : uris) CUIDragMimePayloads.release(moduleId, uri.getLastPathSegment());
      throw failure;
    }
  }

  static void releaseModule(Context context, String moduleId) {
    RuntimeException failure = null;
    for (String token : CUIDragMimePayloads.releaseModule(moduleId)) {
      try { context.revokeUriPermission(uri(context, token), Intent.FLAG_GRANT_READ_URI_PERMISSION); }
      catch (RuntimeException error) { if (failure == null) failure = error; }
    }
    if (failure != null) throw failure;
  }

  @Override public boolean onCreate() { return true; }

  private CUIDragMimePayloads.Snapshot snapshot(Uri uri) {
    Context context = getContext();
    if (context == null || !"content".equals(uri.getScheme()) ||
        !(context.getPackageName() + AUTHORITY_SUFFIX).equals(uri.getAuthority()) ||
        uri.getPathSegments().size() != 1 || uri.getQuery() != null || uri.getFragment() != null)
      throw new IllegalArgumentException("Native drag export: invalid payload URI");
    return CUIDragMimePayloads.open(uri.getLastPathSegment());
  }

  private static String matching(CUIDragMimePayloads.Snapshot snapshot, String filter) throws FileNotFoundException {
    for (String type : snapshot.types()) if (ClipDescription.compareMimeTypes(type, filter)) return type;
    throw new FileNotFoundException("Native drag export: requested original MIME unavailable");
  }

  @Override public String getType(Uri uri) {
    String[] types = snapshot(uri).types(); return types.length == 0 ? null : types[0];
  }
  @Override public String[] getStreamTypes(Uri uri, String filter) {
    List<String> matches = new ArrayList<>();
    for (String type : snapshot(uri).types()) if (ClipDescription.compareMimeTypes(type, filter)) matches.add(type);
    return matches.isEmpty() ? null : matches.toArray(new String[0]);
  }

  @Override public Cursor query(Uri uri, String[] projection, String selection, String[] arguments, String order) {
    CUIDragMimePayloads.Snapshot snapshot = snapshot(uri);
    String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
    MatrixCursor result = new MatrixCursor(columns, 1); Object[] row = new Object[columns.length];
    String[] types = snapshot.types();
    for (int index = 0; index < columns.length; index++) {
      if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) row[index] = "drag-item";
      else if (OpenableColumns.SIZE.equals(columns[index]) && types.length != 0) row[index] = snapshot.bytes(types[0]).length;
    }
    result.addRow(row); return result;
  }

  private AssetFileDescriptor open(Uri uri, String filter, CancellationSignal cancellation) throws FileNotFoundException {
    if (cancellation != null) cancellation.throwIfCanceled();
    final byte[] bytes;
    try { CUIDragMimePayloads.Snapshot snapshot = snapshot(uri); bytes = snapshot.bytes(matching(snapshot, filter)); }
    catch (IllegalArgumentException failure) { throw new FileNotFoundException(failure.getMessage()); }
    try {
      ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createReliablePipe();
      try {
        if (cancellation != null) {
          cancellation.setOnCancelListener(() -> {
            try { pipe[0].close(); } catch (IOException ignored) {}
            try { pipe[1].closeWithError("Native drag export: read cancelled"); } catch (IOException ignored) {}
          });
          cancellation.throwIfCanceled();
        }
        streams.execute(() -> {
          try (ParcelFileDescriptor.AutoCloseOutputStream output = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
            for (int offset = 0; offset < bytes.length;) {
              if (cancellation != null) cancellation.throwIfCanceled();
              int count = Math.min(65536, bytes.length - offset);
              output.write(bytes, offset, count); offset += count;
            }
          } catch (Exception failure) {
            try { pipe[1].closeWithError("Native drag export: original read cancelled or closed"); } catch (IOException ignored) {}
          } finally { if (cancellation != null) cancellation.setOnCancelListener(null); }
        });
      } catch (RuntimeException failure) {
        if (cancellation != null) cancellation.setOnCancelListener(null);
        pipe[0].close(); pipe[1].close(); throw failure;
      }
      return new AssetFileDescriptor(pipe[0], 0, bytes.length);
    } catch (IOException failure) { throw new FileNotFoundException("Native drag export: read pipe unavailable"); }
  }

  @Override public AssetFileDescriptor openTypedAssetFile(Uri uri, String filter, Bundle options) throws FileNotFoundException {
    return open(uri, filter, null);
  }
  @Override public AssetFileDescriptor openTypedAssetFile(Uri uri, String filter, Bundle options,
      CancellationSignal cancellation) throws FileNotFoundException { return open(uri, filter, cancellation); }
  @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    return openFile(uri, mode, null);
  }
  @Override public ParcelFileDescriptor openFile(Uri uri, String mode, CancellationSignal cancellation) throws FileNotFoundException {
    if (!"r".equals(mode)) throw new FileNotFoundException("Native drag export: read-only payload");
    return open(uri, "*/*", cancellation).getParcelFileDescriptor();
  }
  @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("Native drag export: read-only"); }
  @Override public int update(Uri uri, ContentValues values, String selection, String[] arguments) { throw new UnsupportedOperationException("Native drag export: read-only"); }
  @Override public int delete(Uri uri, String selection, String[] arguments) { throw new UnsupportedOperationException("Native drag export: read-only"); }
}
