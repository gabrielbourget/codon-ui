package com.codonui.input;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.view.DragAndDropPermissions;
import android.view.DragEvent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.modules.blob.BlobModule;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

// Only original ACTION_DROP ClipData enters this store. JS can read opaque
// handles; no path, URI opener, Intent launch or broad permission is exported.
final class CUIDragDataStore {
  static final String STRING_MAP_TYPE = "application/x-codon-drag-string-map";
  static final String STRING_MAP_EXTRA = "com.codonui.drag.REPRESENTATIONS";
  private static final Map<String, WeakReference<CUIDragDataStore>> stores = new HashMap<>();
  final String moduleId = UUID.randomUUID().toString();
  interface Reply<T> { void complete(T value, Throwable error); }
  private static final class Backing {
    final File directory;
    int references;
    Backing(File directory) { this.directory = directory; }
  }
  private static final class Node {
    final File file;
    final String name, type;
    final Long modified;
    final List<Node> children;
    Node(File file, String name, String type, Long modified, List<Node> children) {
      this.file = file; this.name = name; this.type = type; this.modified = modified; this.children = children;
    }
  }
  private static final class Entry {
    final String kind;
    final Backing backing;
    final Node node;
    final LinkedHashMap<String, String> text;
    String blobId;
    boolean adopted;
    Entry(String kind, Backing backing, Node node, LinkedHashMap<String, String> text) {
      this.kind = kind; this.backing = backing; this.node = node; this.text = text;
    }
  }
  private static final class Directory {
    final String parent;
    final Backing backing;
    final List<Node> children;
    int offset;
    Directory(String parent, Backing backing, List<Node> children) {
      this.parent = parent; this.backing = backing; this.children = children;
    }
  }
  private static final class Transfer {
    final CancellationSignal cancellation = new CancellationSignal();
    final List<Reply<JSONArray>> waiters = new ArrayList<>();
    JSONArray items;
    Throwable error;
    boolean claimed, finished;
  }
  private static final class Incoming {
    final Uri uri;
    final String text, html, intent, representations;
    Incoming(ClipData.Item item, boolean privateMap) {
      uri = item.getUri(); text = item.getText() == null ? null : item.getText().toString(); html = item.getHtmlText();
      Intent original = item.getIntent();
      intent = original == null ? null : original.toUri(Intent.URI_INTENT_SCHEME);
      representations = !privateMap || original == null ? null : original.getStringExtra(STRING_MAP_EXTRA);
    }
  }
  private final Object lock = new Object();
  private final ReactApplicationContext context;
  private final File root;
  private final ExecutorService worker = Executors.newFixedThreadPool(2);
  private final ExecutorService cleanup = Executors.newSingleThreadExecutor();
  private final Map<String, Entry> entries = new HashMap<>();
  private final Map<String, Directory> directories = new HashMap<>();
  private final Map<String, Transfer> transfers = new HashMap<>();
  private boolean live = true;
  private int jobs;
  private boolean cleanupRetired;

  CUIDragDataStore(ReactApplicationContext context) {
    this.context = context; root = new File(context.getCacheDir(), "codon-drag-" + moduleId);
    synchronized (stores) { stores.put(moduleId, new WeakReference<>(this)); }
  }
  static CUIDragDataStore forModule(String id) {
    CUIDragDataStore store;
    synchronized (stores) { WeakReference<CUIDragDataStore> ref = stores.get(id); store = ref == null ? null : ref.get(); }
    if (store == null) return null;
    synchronized (store.lock) { return store.live ? store : null; }
  }
  private IllegalStateException failure(String message) { return new IllegalStateException("Native drag data: " + message); }
  private String identity(JSONObject request) throws Exception {
    String handle = request.getString("handle");
    if (!live || !moduleId.equals(request.getString("moduleId")) || !handle.startsWith(moduleId + ":"))
      throw failure("foreign or retired native resource");
    return handle;
  }
  private String insert(Entry entry) {
    String handle = moduleId + ":" + UUID.randomUUID();
    if (entry.backing != null) entry.backing.references++;
    entries.put(handle, entry); return handle;
  }
  private JSONObject describe(String handle, Entry entry) throws Exception {
    JSONObject result = new JSONObject().put("handle", handle).put("kind", entry.kind);
    if (entry.kind.equals("text")) result.put("types", new JSONArray(entry.text.keySet()));
    else { result.put("name", entry.node.name); if (entry.kind.equals("file")) result.put("type", entry.node.type); }
    return result;
  }
  private static void delete(File file) {
    File[] children = file.listFiles();
    if (children != null) for (File child : children) delete(child);
    if (!file.delete() && file.exists()) throw new IllegalStateException("Native drag data: owned copy cleanup failed");
  }
  private void discard(File file) {
    // No original path reaches cleanup: only this module's generated copy roots.
    try { delete(file); } catch (RuntimeException error) { synchronized (lock) { cleanupErrors.add(error.toString()); } }
  }
  private final List<String> cleanupErrors = new ArrayList<>();
  private void unpin(Backing backing) {
    if (backing != null && --backing.references == 0) cleanup.execute(() -> discard(backing.directory));
  }
  private String remove(String handle) {
    Entry entry = entries.remove(handle);
    if (entry == null) return null;
    for (Map.Entry<String, Directory> item : new ArrayList<>(directories.entrySet())) {
      if (item.getValue().parent.equals(handle)) {
        directories.remove(item.getKey()); unpin(item.getValue().backing);
      }
    }
    unpin(entry.backing);
    return entry.adopted ? null : entry.blobId;
  }
  private Entry read(JSONObject request) throws Exception {
    synchronized (lock) {
      Entry entry = entries.get(identity(request));
      if (entry == null) throw failure("original resource was released");
      if (entry.backing != null) entry.backing.references++;
      return entry;
    }
  }
  private void current(JSONObject request, Entry entry) throws Exception {
    synchronized (lock) { if (entries.get(identity(request)) != entry) throw failure("original resource retired during read"); }
  }
  private void finish(Entry entry) {
    synchronized (lock) {
      unpin(entry.backing);
    }
  }
  private void finishCleanup() {
    if (!live && jobs == 0 && !cleanupRetired) {
      cleanupRetired = true;
      cleanup.execute(() -> discard(root));
      cleanup.shutdown();
    }
  }
  private <T> boolean submit(Reply<T> reply, Runnable task) {
    synchronized (lock) {
      if (live) {
        jobs++;
        worker.execute(() -> {
          try { task.run(); }
          finally { synchronized (lock) { jobs--; finishCleanup(); } }
        });
        return true;
      }
    }
    reply.complete(null, failure("module retired before original read"));
    return false;
  }
  private void releaseBlob(String id) {
    if (id == null) return;
    BlobModule blobs = context.getNativeModule(BlobModule.class);
    if (blobs != null) blobs.remove(id);
  }
  private File safeFile(Node node, Backing backing) throws Exception {
    String path = node.file.getCanonicalPath(), base = backing.directory.getCanonicalPath() + File.separator;
    if (!path.startsWith(base)) throw failure("file left its original owned copy");
    return node.file;
  }
  private byte[] bytes(Node node, Backing backing) throws Exception {
    File file = safeFile(node, backing);
    long size = file.length();
    if (size > Integer.MAX_VALUE) throw failure("file exceeds the original native Blob size authority");
    byte[] bytes = new byte[(int)size];
    try (FileInputStream input = new FileInputStream(file)) {
      int offset = 0;
      while (offset < bytes.length) {
        int count = input.read(bytes, offset, bytes.length - offset);
        if (count < 0) throw failure("owned file changed during read");
        offset += count;
      }
      if (input.read() != -1) throw failure("owned file changed during read");
    }
    return bytes;
  }
  private String text(byte[] bytes) {
    int offset = 0; String encoding = "UTF-8";
    if (bytes.length >= 3 && (bytes[0] & 255) == 239 && (bytes[1] & 255) == 187 && (bytes[2] & 255) == 191) offset = 3;
    else if (bytes.length >= 2 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 254) { offset = 2; encoding = "UTF-16LE"; }
    else if (bytes.length >= 2 && (bytes[0] & 255) == 254 && (bytes[1] & 255) == 255) { offset = 2; encoding = "UTF-16BE"; }
    return new String(bytes, offset, bytes.length - offset, Charset.forName(encoding));
  }
  private static final class Info {
    String name = "", type = "";
    Long modified;
  }
  private Info info(Uri uri, CancellationSignal signal) throws Exception {
    if (!"content".equals(uri.getScheme())) throw failure("original drop did not grant a content resource");
    ContentResolver resolver = context.getContentResolver(); Info result = new Info();
    String mime = resolver.getType(uri); result.type = mime == null ? "" : mime;
    boolean document = DocumentsContract.isDocumentUri(context, uri);
    String[] projection = document ? new String[]{OpenableColumns.DISPLAY_NAME, DocumentsContract.Document.COLUMN_LAST_MODIFIED}
      : new String[]{OpenableColumns.DISPLAY_NAME};
    try (Cursor cursor = resolver.query(uri, projection, null, null, null, signal)) {
      if (cursor != null && cursor.moveToFirst()) {
        int name = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (name >= 0 && !cursor.isNull(name)) result.name = cursor.getString(name);
        int modified = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
        if (modified >= 0 && !cursor.isNull(modified)) result.modified = cursor.getLong(modified);
      }
    }
    return result;
  }
  private Node copy(Uri uri, File destination, CancellationSignal signal, HashSet<String> ancestors) throws Exception {
    signal.throwIfCanceled();
    Info info = info(uri, signal);
    if (DocumentsContract.Document.MIME_TYPE_DIR.equals(info.type)) {
      if (!DocumentsContract.isDocumentUri(context, uri)) throw failure("original directory provider is unavailable");
      String identity = uri.toString(); if (!ancestors.add(identity)) throw failure("original directory provider contains a cycle");
      if (!destination.mkdirs() && !destination.isDirectory()) throw failure("owned directory cannot be created");
      ArrayList<Node> children = new ArrayList<>(); String id = DocumentsContract.getDocumentId(uri);
      boolean tree = DocumentsContract.isTreeUri(uri);
      Uri childList = tree ? DocumentsContract.buildChildDocumentsUriUsingTree(uri, id)
        : DocumentsContract.buildChildDocumentsUri(uri.getAuthority(), id);
      try (Cursor cursor = context.getContentResolver().query(childList,
          new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID}, null, null, null, signal)) {
        if (cursor == null) throw failure("original directory enumeration unavailable");
        while (cursor.moveToNext()) {
          signal.throwIfCanceled(); String childId = cursor.getString(0);
          Uri child = tree ? DocumentsContract.buildDocumentUriUsingTree(uri, childId)
            : DocumentsContract.buildDocumentUri(uri.getAuthority(), childId);
          children.add(copy(child, new File(destination, UUID.randomUUID().toString()), signal, ancestors));
        }
      } finally { ancestors.remove(identity); }
      return new Node(destination, info.name, info.type, info.modified, children);
    }
    try (android.content.res.AssetFileDescriptor source = context.getContentResolver().openAssetFileDescriptor(uri, "r", signal)) {
      if (source == null) throw failure("original file data unavailable");
      try (InputStream input = source.createInputStream(); FileOutputStream output = new FileOutputStream(destination)) {
        byte[] buffer = new byte[65536]; int count;
        while ((count = input.read(buffer)) != -1) { signal.throwIfCanceled(); output.write(buffer, 0, count); }
      }
    }
    return new Node(destination, info.name, info.type, info.modified, null);
  }

  CUIDragDataProvider.Exported exportTextMaps(JSONArray maps) throws Exception {
    UiThreadUtil.assertOnUiThread();
    synchronized (lock) {
      if (!live) throw failure("module retired before original export");
      return CUIDragDataProvider.export(context, moduleId, maps);
    }
  }

  String beginImport(Activity activity, DragEvent original) throws Exception {
    UiThreadUtil.assertOnUiThread();
    if (original.getAction() != DragEvent.ACTION_DROP || original.getClipData() == null)
      throw failure("an original native drop is required");
    ClipData clip = original.getClipData(); ClipDescription description = clip.getDescription();
    List<String> types = new ArrayList<>(); for (int index = 0; index < description.getMimeTypeCount(); index++) types.add(description.getMimeType(index));
    boolean privateMap = description.hasMimeType(STRING_MAP_TYPE), uri = false;
    List<Incoming> incoming = new ArrayList<>();
    for (int index = 0; index < clip.getItemCount(); index++) { Incoming item = new Incoming(clip.getItemAt(index), privateMap); incoming.add(item); uri |= item.uri != null; }
    DragAndDropPermissions permission = uri && activity != null ? activity.requestDragAndDropPermissions(original) : null;
    if (uri && permission == null) throw failure("original OS URI grant is unavailable");
    Transfer transfer = new Transfer(); String handle = moduleId + ":transfer:" + UUID.randomUUID();
    boolean admitted;
    synchronized (lock) {
      admitted = live;
      if (admitted) transfers.put(handle, transfer);
    }
    if (!admitted) { if (permission != null) permission.release(); throw failure("module retired before original drop"); }
    boolean submitted = submit((JSONArray value, Throwable error) -> {
      if (permission != null) permission.release();
      synchronized (lock) { transfers.remove(handle); }
    }, () -> {
      JSONArray results = new JSONArray(); Throwable error = null;
      try {
        for (Incoming item : incoming) {
          transfer.cancellation.throwIfCanceled();
          Entry entry;
          if (item.representations != null) {
            LinkedHashMap<String, String> values = new LinkedHashMap<>(); JSONArray rows = new JSONArray(item.representations);
            for (int index = 0; index < rows.length(); index++) {
              JSONObject row = rows.getJSONObject(index);
              Object key = row.get("type"), data = row.get("data");
              if (row.length() != 2 || !(key instanceof String) || !(data instanceof String) || values.containsKey(key)) throw failure("invalid original string representation");
              values.put((String)key, (String)data);
            }
            entry = new Entry("text", null, null, values);
          } else if (item.uri != null) {
            File directory = new File(root, UUID.randomUUID().toString()); Backing backing = new Backing(directory);
            try {
              if (!directory.mkdirs()) throw failure("owned copy cannot be created");
              Node node = copy(item.uri, new File(directory, "data"), transfer.cancellation, new HashSet<>());
              entry = new Entry(node.children == null ? "file" : "directory", backing, node, null);
            } catch (Throwable failure) { discard(directory); throw failure; }
          } else {
            LinkedHashMap<String, String> values = new LinkedHashMap<>();
            for (String type : types) {
              if (type.equals(STRING_MAP_TYPE)) throw failure("missing original string-map representation");
              String data = type.equals("text/html") ? item.html : type.equals("text/vnd.android.intent") ? item.intent
                : type.equals("text/plain") ? item.text : null;
              if (!type.equals("text/html") && !type.equals("text/vnd.android.intent") && !type.equals("text/plain"))
                throw failure("original text representation is unavailable");
              // ClipDescription describes the entire clip. Other original items
              // may supply its HTML/Intent types; this item owns only its fields.
              if (data != null) values.put(type, data);
            }
            if (values.isEmpty()) throw failure("missing original text representation");
            entry = new Entry("text", null, null, values);
          }
          boolean retained;
          synchronized (lock) {
            retained = live && transfers.get(handle) == transfer;
            if (retained) { String key = insert(entry); results.put(describe(key, entry)); }
          }
          if (!retained) {
            if (entry.backing != null) discard(entry.backing.directory);
            throw failure("transfer retired during original import");
          }
        }
      } catch (Throwable failure) { error = failure; }
      finally {
        if (permission != null) try { permission.release(); } catch (Throwable cleanupError) { if (error == null) error = cleanupError; }
      }
      List<Reply<JSONArray>> waiters; List<String> blobs = new ArrayList<>();
      synchronized (lock) {
        if (error != null || transfers.get(handle) != transfer || !live) {
          for (int index = 0; index < results.length(); index++) { String key = results.optJSONObject(index).optString("handle"); String blob = remove(key); if (blob != null) blobs.add(blob); }
          if (error == null) error = failure("module retired during original import");
        }
        transfer.items = error == null ? results : null; transfer.error = error; transfer.finished = true;
        waiters = new ArrayList<>(transfer.waiters); transfer.waiters.clear();
      }
      for (String blob : blobs) releaseBlob(blob);
      for (Reply<JSONArray> waiter : waiters) waiter.complete(transfer.items, transfer.error);
    });
    if (!submitted) throw failure("module retired before original transfer import");
    return handle;
  }
  String beginImportTextMaps(JSONArray maps) throws Exception {
    UiThreadUtil.assertOnUiThread();
    synchronized (lock) {
      if (!live) throw failure("module retired before original local drop");
      JSONArray results=new JSONArray(); List<String> created=new ArrayList<>();
      try {
        for (int i=0;i<maps.length();i++) {
          LinkedHashMap<String,String> values=new LinkedHashMap<>(); JSONArray rows=maps.getJSONArray(i);
          for (int j=0;j<rows.length();j++) {
            JSONObject row=rows.getJSONObject(j); Object type=row.get("type"), data=row.get("data");
            if (row.length()!=2 || !(type instanceof String) || !(data instanceof String) || values.containsKey(type)) throw failure("invalid original local representation");
            values.put((String)type,(String)data);
          }
          Entry entry=new Entry("text",null,null,values); String handle=insert(entry); created.add(handle); results.put(describe(handle,entry));
        }
        String handle=moduleId+":transfer:"+UUID.randomUUID(); Transfer transfer=new Transfer(); transfer.items=results; transfer.finished=true; transfers.put(handle,transfer); return handle;
      } catch (Exception error) { for (String handle:created) remove(handle); throw error; }
    }
  }
  void readItems(JSONObject request, Reply<JSONArray> reply) {
    try {
      Transfer transfer;
      synchronized (lock) {
        transfer = transfers.get(identity(request));
        if (transfer == null || transfer.claimed) throw failure("original transfer retired or already claimed");
        transfer.claimed = true;
        if (!transfer.finished) { transfer.waiters.add(reply); return; }
      }
      reply.complete(transfer.items, transfer.error);
    } catch (Throwable error) { reply.complete(null, error); }
  }
  boolean adoptItems(JSONObject request) {
    synchronized (lock) {
      try {
        String handle = identity(request); Transfer transfer = transfers.get(handle);
        if (transfer == null || !transfer.claimed || !transfer.finished || transfer.error != null) return false;
        transfers.remove(handle); return true;
      } catch (Exception error) { return false; }
    }
  }
  void readText(JSONObject request, Reply<String> reply) {
    submit(reply, () -> {
      Entry entry = null;
      try {
        entry = read(request); String value;
        if (entry.kind.equals("text")) {
          Object type = request.get("type"); if (!(type instanceof String) || !entry.text.containsKey(type)) throw failure("original text type unavailable");
          value = entry.text.get(type);
        } else {
          if (!entry.kind.equals("file")) throw failure("resource is not a file");
          value = text(bytes(entry.node, entry.backing));
        }
        current(request, entry); reply.complete(value, null);
      } catch (Throwable error) { reply.complete(null, error); }
      finally { if (entry != null) finish(entry); }
    });
  }
  void readFile(JSONObject request, Reply<JSONObject> reply) {
    submit(reply, () -> {
      Entry entry = null; String unowned = null;
      try {
        entry = read(request); if (!entry.kind.equals("file")) throw failure("resource is not a file");
        byte[] data = bytes(entry.node, entry.backing); current(request, entry);
        BlobModule blobs = context.getNativeModule(BlobModule.class); if (blobs == null) throw failure("original SDK Blob module unavailable");
        unowned = blobs.store(data); JSONObject result;
        synchronized (lock) {
          current(request, entry); Entry body = new Entry("body", entry.backing, entry.node, null); body.blobId = unowned;
          String key = insert(body); result = new JSONObject().put("handle", key).put("blobId", unowned).put("offset", 0).put("size", data.length)
            .put("name", entry.node.name).put("type", entry.node.type).put("uri", Uri.fromFile(entry.node.file).toString());
          if (entry.node.modified != null) result.put("lastModified", entry.node.modified);
        }
        unowned = null; reply.complete(result, null);
      } catch (Throwable error) { releaseBlob(unowned); reply.complete(null, error); }
      finally { if (entry != null) finish(entry); }
    });
  }
  boolean adoptFile(JSONObject request) {
    synchronized (lock) {
      try {
        Entry entry = entries.get(identity(request));
        if (entry == null || !entry.kind.equals("body") || entry.adopted) return false;
        entry.adopted = true; return true;
      } catch (Exception error) { return false; }
    }
  }
  void readDirectory(JSONObject request, Reply<JSONObject> reply) {
    submit(reply, () -> {
      Entry entry = null;
      try {
        entry = read(request); if (!entry.kind.equals("directory")) throw failure("resource is not a directory");
        JSONObject result;
        synchronized (lock) {
          current(request, entry);
          String parent = identity(request), cursor = request.isNull("cursor") ? null : request.getString("cursor");
          Directory directory;
          if (cursor == null) {
            cursor = moduleId + ":cursor:" + UUID.randomUUID(); directory = new Directory(parent, entry.backing, entry.node.children);
            directories.put(cursor, directory); entry.backing.references++;
          } else directory = directories.get(cursor);
          if (directory == null || !directory.parent.equals(parent)) throw failure("original directory cursor retired");
          JSONArray children = new JSONArray(); int end = Math.min(directory.children.size(), directory.offset + 64);
          while (directory.offset < end) {
            Node node = directory.children.get(directory.offset++); Entry child = new Entry(node.children == null ? "file" : "directory", directory.backing, node, null);
            String key = insert(child); children.put(describe(key, child));
          }
          boolean ended = end == directory.children.size();
          if (ended) { directories.remove(cursor); unpin(directory.backing); }
          result = new JSONObject().put("items", children).put("cursor", ended ? JSONObject.NULL : cursor);
        }
        reply.complete(result, null);
      } catch (Throwable error) { reply.complete(null, error); }
      finally { if (entry != null) finish(entry); }
    });
  }
  void closeDirectory(JSONObject request) throws Exception {
    synchronized (lock) {
      String parent = identity(request), cursor = request.getString("cursor"); Directory directory = directories.get(cursor);
      if (directory != null && directory.parent.equals(parent)) { directories.remove(cursor); unpin(directory.backing); }
    }
  }
  void releaseData(JSONObject request) throws Exception {
    Transfer transfer; List<String> blobs = new ArrayList<>();
    synchronized (lock) {
      String handle = identity(request); transfer = transfers.remove(handle); String blob = remove(handle);
      if (blob != null) blobs.add(blob);
      if (transfer != null && transfer.items != null) for (int index = 0; index < transfer.items.length(); index++) {
        String body = remove(transfer.items.getJSONObject(index).getString("handle")); if (body != null) blobs.add(body);
      }
    }
    for (String blob : blobs) releaseBlob(blob);
    if (transfer != null) {
      transfer.cancellation.cancel(); List<Reply<JSONArray>> waiters;
      synchronized (lock) { waiters = new ArrayList<>(transfer.waiters); transfer.waiters.clear(); }
      for (Reply<JSONArray> waiter : waiters) waiter.complete(null, failure("original transfer released"));
    }
  }
  void invalidate() {
    List<Transfer> pending; List<String> blobs = new ArrayList<>();
    synchronized (lock) {
      if (!live) return; live = false; pending = new ArrayList<>(transfers.values()); transfers.clear();
      for (String handle : new ArrayList<>(entries.keySet())) { String blob = remove(handle); if (blob != null) blobs.add(blob); }
      worker.shutdown();
      finishCleanup();
    }
    try { CUIDragDataProvider.releaseModule(context, moduleId); }
    catch (RuntimeException error) { synchronized (lock) { cleanupErrors.add(error.toString()); } }
    synchronized (stores) { stores.remove(moduleId); }
    for (Transfer transfer : pending) {
      transfer.cancellation.cancel(); List<Reply<JSONArray>> waiters;
      synchronized (lock) { waiters = new ArrayList<>(transfer.waiters); transfer.waiters.clear(); }
      for (Reply<JSONArray> waiter : waiters) waiter.complete(null, failure("module retired during original transfer"));
    }
    for (String blob : blobs) releaseBlob(blob);
  }
}
