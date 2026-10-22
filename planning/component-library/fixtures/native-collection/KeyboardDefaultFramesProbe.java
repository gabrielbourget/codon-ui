package com.codonui.input;
public final class KeyboardDefaultFramesProbe {
  private static void check(boolean value) { if (!value) throw new AssertionError(); }
  public static void main(String[] args) {
    CUIEditorKeyboardDefaultFrames frames = new CUIEditorKeyboardDefaultFrames();
    CUIEditorKeyboardDefaultFrames.Identity id = new CUIEditorKeyboardDefaultFrames.Identity("owner", "field", "revision", 17, "window", 1);
    long outer = frames.begin(id, 1, "down"); check(outer != 0);
    CUIEditorKeyboardDefaultFrames.Identity foreign = new CUIEditorKeyboardDefaultFrames.Identity("owner", "field", "revision", 17, "foreign", 1);
    check(!frames.acknowledge(foreign, 1, "down", true, true));
    check(!frames.acknowledge(id, 1, "up", true, true));
    long inner = frames.begin(id, 2, "down"); check(inner != 0);
    check(!frames.acknowledge(id, 1, "down", true, true));
    check(frames.acknowledge(id, 2, "down", true, false));
    check(!frames.acknowledge(id, 2, "down", true, true));
    check(frames.end(outer, true) == CUIEditorKeyboardDefaultFrames.Disposition.RETIRED);
    check(frames.end(inner, true) == CUIEditorKeyboardDefaultFrames.Disposition.ALLOWED);
    check(frames.acknowledge(id, 1, "down", true, true));
    check(frames.end(outer, true) == CUIEditorKeyboardDefaultFrames.Disposition.PREVENTED);
    check(!frames.acknowledge(id, 1, "down", true, true));
    long missing = frames.begin(id, 3, "up");
    check(frames.end(missing, true) == CUIEditorKeyboardDefaultFrames.Disposition.UNACKNOWLEDGED);
    long cancel = frames.begin(id, 4, "cancel"); check(frames.acknowledge(id, 4, "cancel", true, true));
    check(frames.end(cancel, true) == CUIEditorKeyboardDefaultFrames.Disposition.ALLOWED);
    long replaced = frames.begin(id, 5, "down"); check(frames.acknowledge(id, 5, "down", true, true));
    check(frames.end(replaced, false) == CUIEditorKeyboardDefaultFrames.Disposition.RETIRED);
    long retired = frames.begin(id, 6, "down"); frames.retire();
    check(frames.end(retired, true) == CUIEditorKeyboardDefaultFrames.Disposition.RETIRED);
    CUIEditorKeyboardDefaultFrames.Identity invalid = new CUIEditorKeyboardDefaultFrames.Identity("owner", "field", "revision", 0, "window", 1);
    check(frames.begin(invalid, 7, "down") == 0);
    System.out.println("editor-key-frame-models: pass; SDK dispatch/default verdicts: none");
  }
}
