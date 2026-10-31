package com.codonui.input;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;

// Host JVM: execute the actual retained snapshot and completion policies only.
// No Android URI grant, pipe, original control, native drag or installed claim.
public final class MimePayloadsTest {
  private static int assertions;
  private static void check(boolean value) { assertions++; if (!value) throw new AssertionError(); }
  private static void rejects(Runnable action) {
    try { action.run(); } catch (IllegalArgumentException expected) { assertions++; return; }
    throw new AssertionError("retired/unknown MIME payload accepted");
  }
  public static void main(String[] arguments) {
    LinkedHashMap<String, String> values = new LinkedHashMap<>();
    values.put("application/x-custom-first", "\uD83D\uDE80 café\n\u0000");
    values.put("text/plain", ""); values.put("text/html", "<b>original</b>");
    CUIDragMimePayloads.Snapshot original = CUIDragMimePayloads.retain("module-a", values);
    check(Arrays.equals(original.types(), new String[]{"application/x-custom-first", "text/plain", "text/html"}));
    values.put("text/plain", "later caller mutation"); values.remove("text/html");
    check(original.bytes("text/plain").length == 0);
    check(new String(original.bytes("text/html"), StandardCharsets.UTF_8).equals("<b>original</b>"));
    check(Arrays.equals(original.bytes("application/x-custom-first"), "\uD83D\uDE80 café\n\u0000".getBytes(StandardCharsets.UTF_8)));
    byte[] bytes = original.bytes("text/html"); bytes[0] = 'x';
    check(original.bytes("text/html")[0] == '<');
    String[] names = original.types(); names[0] = "changed";
    check(original.types()[0].equals("application/x-custom-first"));
    rejects(() -> original.bytes("text/missing"));
    check(!CUIDragMimePayloads.release("module-b", original.token));
    check(CUIDragMimePayloads.open(original.token) == original);
    CUIDragMimePayloads.Snapshot second = CUIDragMimePayloads.retain("module-b", new LinkedHashMap<>());
    check(second.types().length == 0);
    check(!original.token.equals(second.token));
    check(CUIDragMimePayloads.releaseModule("module-a").equals(Arrays.asList(original.token)));
    rejects(() -> CUIDragMimePayloads.open(original.token));
    check(CUIDragMimePayloads.open(second.token) == second);
    // An already admitted reader retains original bytes through module retirement.
    check(original.bytes("text/plain").length == 0);
    check(CUIDragMimePayloads.releaseModule("module-a").isEmpty());
    check(CUIDragMimePayloads.release("module-b", second.token));
    check(!CUIDragMimePayloads.release("module-b", second.token));
    rejects(() -> CUIDragMimePayloads.open(second.token));
    rejects(() -> CUIDragMimePayloads.retain("", values));

    for (String selected : new String[]{"copy", "move", "link"}) {
      check(CUIDragOperations.completed(true, true, true, selected, true, false).equals(selected));
      check(CUIDragOperations.completed(false, true, true, selected, true, true).equals("cancel"));
      check(CUIDragOperations.completed(true, true, false, selected, true, true).equals("cancel"));
      check(CUIDragOperations.completed(true, true, true, selected, false, true).equals("cancel"));
      // A foreign boolean cannot supply the requested move/link; the carrier is copy only.
      check(CUIDragOperations.completed(true, false, false, selected, true, true).equals("copy"));
      check(CUIDragOperations.completed(true, false, true, selected, true, false).equals("cancel"));
    }
    check(CUIDragOperations.completed(true, true, true, "unknown", true, true).equals("cancel"));
    check(CUIDragOperations.completed(true, true, true, null, true, true).equals("cancel"));
    check(CUIDragOperations.completed(false, false, false, "copy", true, true).equals("cancel"));
    System.out.println("PASS " + assertions + " actual retained-MIME/completion host assertions; no Android framework or native drag execution");
  }
}
