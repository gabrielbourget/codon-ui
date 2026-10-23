package com.codonui.input;

import android.content.Context;
import android.graphics.Rect;
import android.os.SystemClock;
import android.text.Editable;
import android.text.Selection;
import android.text.SpannableStringBuilder;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUIDateSegment extends ReactViewGroup {
  String ownerId = "", segmentId = "", bindingRevision = "", displayText = "", locale = "", keyboardMode = "numeric";
  boolean segmentDisabled, segmentReadOnly, segmentEditable, segmentPlaceholder;
  private final Editable document = new SpannableStringBuilder();
  private long epoch = 1, sequence;

  CUIDateSegment(Context context) { super(context); Selection.setSelection(document, 0); }
  private InputMethodManager inputMethod() { return (InputMethodManager)getContext().getSystemService(Context.INPUT_METHOD_SERVICE); }
  private boolean active() { return isAttachedToWindow() && hasWindowFocus() && isShown(); }
  private boolean canEdit() { return active() && hasFocus() && !segmentDisabled && !segmentReadOnly && segmentEditable; }
  void configureIdentity(String owner, String segment, String revision) {
    if (ownerId.equals(owner) && segmentId.equals(segment) && bindingRevision.equals(revision)) return;
    if (!ownerId.equals(owner) || !segmentId.equals(segment)) clearFocus();
    epoch++; clearDocument(); ownerId = owner; segmentId = segment; bindingRevision = revision;
  }
  void traitsChanged() {
    epoch++; clearDocument(); enforceTraits();
    InputMethodManager manager = inputMethod();
    if (manager != null && hasFocus()) manager.restartInput(this);
  }
  void enforceTraits() {
    boolean eligible = segmentEditable && (!segmentDisabled || hasFocus());
    setFocusable(eligible); setFocusableInTouchMode(eligible);
    if (!segmentEditable) clearFocus();
  }
  @Override public boolean requestFocus(int direction, Rect previous) {
    return !segmentDisabled && segmentEditable && super.requestFocus(direction, previous);
  }
  @Override public void addFocusables(ArrayList<View> views, int direction, int mode) {
    if (!segmentDisabled && segmentEditable) super.addFocusables(views, direction, mode);
  }
  boolean isSegmentComposing() { return BaseInputConnection.getComposingSpanStart(document) >= 0; }
  void mounted() { enforceTraits(); emit("status", "", 0, 0); }
  private void clearDocument() { document.clear(); BaseInputConnection.removeComposingSpans(document); Selection.setSelection(document, 0); }
  @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); epoch++; clearDocument(); emit("status", "", 0, 0); }
  @Override protected void onDetachedFromWindow() { clearFocus(); epoch++; clearDocument(); super.onDetachedFromWindow(); emit("status", "", 0, 0); }
  @Override protected void onVisibilityChanged(android.view.View changedView,int visibility) {
    super.onVisibilityChanged(changedView,visibility);
    if (document == null) return;
    epoch++; clearDocument(); if (!active()) clearFocus(); emit("status","",0,0);
  }
  @Override public void onWindowFocusChanged(boolean focused) {
    super.onWindowFocusChanged(focused); epoch++; clearDocument();
    if (!focused) clearFocus(); emit("status", "", 0, 0);
  }
  @Override protected void onFocusChanged(boolean focused, int direction, Rect previous) {
    super.onFocusChanged(focused, direction, previous);
    if (focused) clearDocument();
    emit(focused ? "focus" : "blur", "", 0, 0);
    if (!focused) { clearDocument(); if (segmentDisabled) enforceTraits(); }
  }
  JSONObject formSegmentIdentity() throws Exception {
    int surface = UIManagerHelper.getSurfaceId(this);
    if (!active() || surface <= 0 || getId() <= 0 || ownerId.isEmpty() || segmentId.isEmpty() || bindingRevision.isEmpty()) return null;
    return new JSONObject().put("ownerId", ownerId).put("segmentId", segmentId).put("bindingRevision", bindingRevision)
      .put("target", getId()).put("nativeInstance", "android-date-segment:"+Integer.toHexString(System.identityHashCode(this)))
      .put("surfaceId", surface).put("windowId", CUIInputWindow.identity(this)).put("epoch", epoch);
  }
  boolean requestFormSegmentFocus(JSONObject identity) throws Exception {
    if (!CUIFormActionAdmission.same(formSegmentIdentity(), identity) || segmentDisabled || !segmentEditable) return false;
    requestSegmentFocus(identity.getString("ownerId"), identity.getString("segmentId"), identity.getString("bindingRevision"),
      identity.getString("windowId"), identity.getDouble("epoch"));
    return hasFocus() && CUIFormActionAdmission.same(formSegmentIdentity(), identity);
  }
  private boolean matches(String owner, String segment, String revision, String window, double generation) {
    return ownerId.equals(owner) && segmentId.equals(segment) && bindingRevision.equals(revision) &&
      window.equals(CUIInputWindow.identity(this)) && generation == epoch && active();
  }
  void requestSegmentFocus(String owner, String segment, String revision, String window, double generation) {
    if (!matches(owner, segment, revision, window, generation) || segmentDisabled || !segmentEditable) return;
    requestFocus();
    InputMethodManager manager = inputMethod();
    if (manager != null && hasFocus() && !segmentReadOnly) manager.showSoftInput(this, InputMethodManager.SHOW_IMPLICIT);
  }
  void requestSegmentBlur(String owner, String segment, String revision, String window, double generation) {
    if (matches(owner, segment, revision, window, generation)) clearFocus();
  }
  @Override public boolean onTouchEvent(MotionEvent event) {
    if (segmentDisabled || !segmentEditable) return super.onTouchEvent(event);
    if (event.getActionMasked() == MotionEvent.ACTION_UP) {
      requestFocus(); InputMethodManager manager = inputMethod();
      if (manager != null && hasFocus() && !segmentReadOnly) manager.showSoftInput(this, InputMethodManager.SHOW_IMPLICIT);
      performClick();
    }
    return true;
  }
  @Override public boolean performClick() { super.performClick(); return true; }
  @Override public boolean onCheckIsTextEditor() { return segmentEditable && !segmentDisabled && !segmentReadOnly; }
  @Override public InputConnection onCreateInputConnection(EditorInfo info) {
    if (!canEdit()) return null;
    info.inputType = "numeric".equals(keyboardMode) ? InputType.TYPE_CLASS_NUMBER : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS;
    info.imeOptions = EditorInfo.IME_ACTION_DONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI;
    info.initialSelStart = Selection.getSelectionStart(document); info.initialSelEnd = Selection.getSelectionEnd(document);
    return new SegmentConnection(epoch);
  }
  private final class SegmentConnection extends BaseInputConnection {
    private final long generation;
    private final String inputSource;
    private final Editable retired = new SpannableStringBuilder();
    SegmentConnection(long generation) { this(generation,null); }
    SegmentConnection(long generation,String inputSource) { super(CUIDateSegment.this, true); this.generation = generation; this.inputSource=inputSource; }
    private boolean live() { return generation == epoch && canEdit(); }
    @Override public Editable getEditable() { return live() ? document : retired; }
    @Override public boolean commitText(CharSequence text, int position) {
      if (!live()) return false;
      int start = BaseInputConnection.getComposingSpanStart(document), end = BaseInputConnection.getComposingSpanEnd(document);
      if (start < 0 || end < 0) { start = Selection.getSelectionStart(document); end = Selection.getSelectionEnd(document); }
      boolean result = super.commitText(text, position); emit("insert", text.toString(), Math.min(start,end), Math.max(start,end), inputSource==null?raw("commitText",text.toString(),position):inputSource); return result;
    }
    @Override public boolean setComposingText(CharSequence text, int position) {
      if (!live()) return false;
      int start = BaseInputConnection.getComposingSpanStart(document), end = BaseInputConnection.getComposingSpanEnd(document);
      if (start < 0 || end < 0) { start = Selection.getSelectionStart(document); end = Selection.getSelectionEnd(document); }
      boolean result = super.setComposingText(text, position); emit("marked", text.toString(), Math.min(start,end), Math.max(start,end), raw("setComposingText",text.toString(),position)); return result;
    }
    @Override public boolean setComposingRegion(int start, int end) {
      if (!live()) return false;
      if (Math.min(start,end) < 0 || Math.max(start,end) > document.length()) return false;
      boolean result = super.setComposingRegion(start, end); emit("marked", document.subSequence(Math.min(start,end), Math.max(start,end)).toString(), Math.min(start,end), Math.max(start,end), raw("setComposingRegion",start,end)); return result;
    }
    @Override public boolean finishComposingText() {
      if (!live()) return false;
      int start = BaseInputConnection.getComposingSpanStart(document), end = BaseInputConnection.getComposingSpanEnd(document);
      String text = start >= 0 && end >= start ? document.subSequence(start, end).toString() : "";
      boolean result = super.finishComposingText();
      if (start >= 0 && end >= start) emit("unmark", text, start, end,raw("finishComposingText")); return result;
    }
    @Override public boolean deleteSurroundingText(int before, int after) {
      if (!live()) return false;
      int start = Selection.getSelectionStart(document), end = Selection.getSelectionEnd(document);
      boolean result = super.deleteSurroundingText(before, after); emit("delete", "", Math.max(0, Math.min(start,end)-before), Math.max(start,end)+after,raw("deleteSurroundingText",before,after)); return result;
    }
    @Override public boolean deleteSurroundingTextInCodePoints(int before, int after) {
      if (!live()) return false;
      int start = Selection.getSelectionStart(document), end = Selection.getSelectionEnd(document);
      boolean result = super.deleteSurroundingTextInCodePoints(before, after); emit("delete", "", Math.min(start,end), Math.max(start,end),raw("deleteSurroundingTextInCodePoints",before,after)); return result;
    }
    @Override public boolean setSelection(int start, int end) {
      if (!live()) return false;
      boolean result = super.setSelection(start,end); emit("selection", "", start,end,raw("setSelection",start,end)); return result;
    }
    @Override public boolean sendKeyEvent(KeyEvent event) { return live() && super.sendKeyEvent(event); }
  }
  @Override public boolean onKeyDown(int code, KeyEvent event) {
    if (!canEdit()) return super.onKeyDown(code,event);
    if (code == KeyEvent.KEYCODE_DEL || code == KeyEvent.KEYCODE_FORWARD_DEL) {
      int a = Selection.getSelectionStart(document), b = Selection.getSelectionEnd(document), start = Math.min(a,b), end = Math.max(a,b);
      if (start == end && code == KeyEvent.KEYCODE_DEL && start > 0) start = Character.offsetByCodePoints(document,start,-1);
      if (start == end && code == KeyEvent.KEYCODE_FORWARD_DEL && end < document.length()) end = Character.offsetByCodePoints(document,end,1);
      document.delete(start,end); Selection.setSelection(document,start); BaseInputConnection.removeComposingSpans(document); emit("delete", "", start,end,keyData(event)); return true;
    }
    int unicode = event.getUnicodeChar();
    if (unicode > 0 && !event.isCtrlPressed() && !event.isMetaPressed() && !event.isAltPressed()) {
      return new SegmentConnection(epoch,keyData(event)).commitText(new String(Character.toChars(unicode)),1);
    }
    return super.onKeyDown(code,event);
  }
  @Override public CharSequence getAccessibilityClassName() { return "android.widget.EditText"; }
  @Override public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info) {
    super.onInitializeAccessibilityNodeInfo(info); info.setText(displayText); info.setEditable(onCheckIsTextEditor()); info.setEnabled(!segmentDisabled);
  }
  void retire() { clearFocus(); epoch++; clearDocument(); ownerId = ""; segmentId = ""; bindingRevision = ""; keyboardMode = "numeric"; }
  private static String raw(String method,Object... args) {
    try { JSONObject data=new JSONObject(); data.put("method",method); JSONArray values=new JSONArray(); for(Object value:args)values.put(value); data.put("arguments",values); return data.toString(); }
    catch(org.json.JSONException invalid) { return "{}"; }
  }
  private static String keyData(KeyEvent event) {
    return raw("onKeyDown",event.getKeyCode(),event.getScanCode(),event.getMetaState(),event.getFlags(),event.getRepeatCount(),event.getDownTime(),event.getEventTime(),event.getCharacters(),event.getUnicodeChar());
  }
  private void emit(String kind,String text,int start,int end) { emit(kind,text,start,end,"{}"); }
  private void emit(String kind, String text, int start, int end,String nativeData) {
    if (!(getContext() instanceof ReactContext) || ownerId.isEmpty() || segmentId.isEmpty()) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(),getId());
    if (dispatcher == null) return;
    int surface = UIManagerHelper.getSurfaceId(this);
    WritableMap data = Arguments.createMap();
    data.putString("kind",kind); data.putString("ownerId",ownerId); data.putString("segmentId",segmentId); data.putString("bindingRevision",bindingRevision);
    data.putString("nativeInstance","android-date-segment:"+Integer.toHexString(System.identityHashCode(this))); data.putInt("target",getId()); data.putInt("surfaceId",surface); data.putString("windowId",CUIInputWindow.identity(this));
    data.putDouble("epoch",epoch); data.putDouble("sequence",++sequence); data.putDouble("timestamp",SystemClock.uptimeMillis());
    data.putString("nativeData",nativeData); data.putString("text",text); data.putString("document",document.toString()); data.putInt("replacementStart",start); data.putInt("replacementEnd",end);
    data.putInt("selectionStart",Selection.getSelectionStart(document)); data.putInt("selectionEnd",Selection.getSelectionEnd(document));
    data.putInt("composingStart",BaseInputConnection.getComposingSpanStart(document)); data.putInt("composingEnd",BaseInputConnection.getComposingSpanEnd(document));
    data.putBoolean("focused",hasFocus()); data.putBoolean("active",active());
    Runnable emit = () -> dispatcher.dispatchEvent(new SegmentEvent(surface,getId(),data));
    if (kind.equals("insert") || kind.equals("delete") || kind.equals("marked") || kind.equals("unmark"))
      CUIFieldInputBinding.emitOwnedInput(this, emit);
    else emit.run();
  }
  private static final class SegmentEvent extends Event<SegmentEvent> {
    private final WritableMap data;
    SegmentEvent(int surface, int target, WritableMap data) { super(surface,target); this.data=data; }
    @Override public String getEventName() { return "topNativeSegmentInput"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
