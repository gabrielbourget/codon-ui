package com.codonui.input;

import android.graphics.Rect;
import android.graphics.Canvas;
import android.os.SystemClock;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewParent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.R;
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.PointerEvents;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

public final class CUIFocusView extends ReactViewGroup implements View.OnClickListener {
  PointerEvents authoredPointerEvents() { return super.getPointerEvents(); }
  @Override public PointerEvents getPointerEvents() {
    return CUIMenuPointerPolicies.suppresses(this) ? PointerEvents.NONE : super.getPointerEvents();
  }
  private final SparseArray<KeyEvent> held = new SparseArray<>();
  private final Set<Integer> consumed = new HashSet<>();
  private Set<String> capturedKeys = new HashSet<>();
  private String ownerId = "";
  String nativeCollectionBinding = "";
  final CUICollectionAccessibility collectionAccessibility = new CUICollectionAccessibility(this);
  private String origin = "unknown";
  private boolean keyboardFocusable = true;
  private boolean nativeTabStop = true;
  private boolean nativePressable = false;
  private boolean nativeNavigation = false;
  private String nativeNavigationLabel = "Navigation";
  private double activationId;
  private List<String> nativeLabelledBy = new ArrayList<>();
  private List<String> nativeDescribedBy = new ArrayList<>();
  private List<String> nativeDetailsBy = new ArrayList<>();
  private int nativeDescriptionTag;
  private final CUIFloatingScrollAnchor scrollAnchor;
  private final CUIMotionColorSampler motionColors;
  private final CUIMotionGeometryObserver motionGeometry;
  private final CUIMotionDrawing motionDrawing;
  private String motionGeometryBinding = "", motionGeometryRevision = "";
  private boolean nativeMotionColorObservation;
  private Boolean nativeMotionVisible = true;
  private int authoredVisibility = View.VISIBLE;
  private String motionProjectionRevision = "";
  private int contentInsetLeft, contentInsetTop, contentInsetRight, contentInsetBottom;
  private int nativeScrollAnchorTag;
  private String nativeScrollAnchorKey = "";
  private String nativeScrollAnchorRevision = "";
  private CUIFormActionLease formAction;
  private CUIFocusWithinObserver focusWithin;

  public CUIFocusView(ThemedReactContext context) {
    super(context);
    motionDrawing = new CUIMotionDrawing(this);
    scrollAnchor = new CUIFloatingScrollAnchor(this);
    motionColors = new CUIMotionColorSampler(this, data -> emit("topNativeMotionColors", data));
    java.lang.ref.WeakReference<CUIFocusView> geometryRoot = new java.lang.ref.WeakReference<>(this);
    motionGeometry = new CUIMotionGeometryObserver(this, data -> { CUIFocusView view = geometryRoot.get(); if (view != null) view.emit("topNativeMotionGeometry", data); });
    setFocusable(true);
    setFocusableInTouchMode(true);
  }

  void setMotionContentInsets(int left, int top, int right, int bottom) {
    contentInsetLeft = left; contentInsetTop = top; contentInsetRight = right; contentInsetBottom = bottom;
  }
  org.json.JSONArray motionContentBox() throws org.json.JSONException {
    double density = getResources().getDisplayMetrics().density;
    return new org.json.JSONArray().put(contentInsetLeft / density).put(contentInsetTop / density)
        .put(Math.max(0, getWidth() - contentInsetLeft - contentInsetRight) / density)
        .put(Math.max(0, getHeight() - contentInsetTop - contentInsetBottom) / density);
  }

  private static java.util.Map<String, Object> jsonMap(org.json.JSONObject value) {
    java.util.Map<String, Object> result = new java.util.HashMap<>();
    java.util.Iterator<String> keys = value.keys();
    while (keys.hasNext()) { String key = keys.next(); result.put(key, value.opt(key)); }
    return result;
  }
  private org.json.JSONObject formActionEnvironment() throws org.json.JSONException {
    int surface = UIManagerHelper.getSurfaceId(this);
    boolean active = isAttachedToWindow() && hasWindowFocus() && isShown() && getWindowVisibility() == View.VISIBLE && surface > 0;
    String scopeOwner = ""; double scopeEpoch = 0;
    for (View view = this; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null) {
      active &= view.getAlpha() > 0;
      if (scopeOwner.isEmpty() && view instanceof CUIKeyboardScope) {
        CUIKeyboardScope scope = (CUIKeyboardScope)view;
        scopeOwner = scope.formActionOwnerId(); scopeEpoch = scope.formActionEpoch();
      }
    }
    return new org.json.JSONObject().put("viewOwnerId", ownerId).put("target", getId()).put("surfaceId", surface)
      .put("windowId", isAttachedToWindow() ? CUIInputWindow.identity(this) : "")
      .put("scopeOwnerId", scopeOwner).put("scopeEpoch", scopeEpoch).put("attached", isAttachedToWindow())
      .put("active", active).put("enabled", nativePressable && isEnabled());
  }
  void setNativeFormActionBinding(String value) {
    if (value == null || value.isEmpty()) { retireFormAction(); return; }
    if (formAction == null) {
      java.lang.ref.WeakReference<CUIFocusView> actionRoot = new java.lang.ref.WeakReference<>(this);
      formAction = new CUIFormActionLease(this, () -> {
        CUIFocusView view = actionRoot.get();
        if (view == null) throw new IllegalStateException("form-action-target-retired");
        return view.formActionEnvironment();
      }, data -> {
        CUIFocusView view = actionRoot.get();
        if (view != null) view.emit("topNativeFormActionStatus", com.facebook.react.bridge.Arguments.makeNativeMap(jsonMap(data)));
      });
    }
    formAction.configure(value);
  }
  void synchronizeFormAction() { if (formAction != null) formAction.snapshot(); }
  void retireFormAction() { if (formAction != null) formAction.invalidate(); formAction = null; }
  org.json.JSONObject formActionSnapshot() { return formAction == null ? null : formAction.snapshot(); }
  void setNativeFocusWithinBinding(String binding) {
    if (binding == null || binding.isEmpty()) { retireFocusWithin(); return; }
    if (focusWithin == null) {
      java.lang.ref.WeakReference<CUIFocusView> weak = new java.lang.ref.WeakReference<>(this);
      focusWithin = new CUIFocusWithinObserver(this, () -> {
        CUIFocusView view = weak.get();
        if (view == null) throw new IllegalStateException("focus-within-owner-retired");
        return view.formActionEnvironment();
      }, data -> { CUIFocusView view = weak.get(); if (view != null) view.emit("topNativeFocusWithin", data); });
    }
    focusWithin.configure(binding);
  }
  void synchronizeFocusWithin() { if (focusWithin != null) focusWithin.synchronize(); }
  void retireFocusWithin() { if (focusWithin != null) focusWithin.invalidate(); focusWithin = null; }

  void setNativeTabStop(boolean value) { nativeTabStop = value; }
  @Override public void addFocusables(ArrayList<View> views, int direction, int mode) {
    super.addFocusables(views, direction, mode);
    if (!nativeTabStop && (direction == View.FOCUS_FORWARD || direction == View.FOCUS_BACKWARD)) views.remove(this);
  }

  @Override public void setVisibility(int visibility) {
    authoredVisibility = visibility;
    super.setVisibility(Boolean.FALSE.equals(nativeMotionVisible) && visibility == View.VISIBLE ? View.INVISIBLE : visibility);
  }
  void setNativeMotionVisible(boolean visible) {
    nativeMotionVisible = visible;
    super.setVisibility(!visible && authoredVisibility == View.VISIBLE ? View.INVISIBLE : authoredVisibility);
  }
  void setNativeMotionDrawingOwner(boolean enabled) { motionDrawing.setEnabled(enabled); }
  void setNativeMotionProjectionRadii(String radii) { motionDrawing.setRadii(radii); }
  void captureMotionBorderColor(int index, Integer color) { motionDrawing.setBorderColor(index, color); }
  void captureMotionShadows(com.facebook.react.bridge.ReadableArray shadows) { motionDrawing.setShadows(shadows); }
  void synchronizeMotionDrawing() { motionDrawing.synchronize(); }
  void retireMotionDrawing() { motionDrawing.retire(); }
  @Override public void draw(Canvas canvas) { motionDrawing.synchronize(); super.draw(canvas); }
  @Override public void dispatchDraw(Canvas canvas) {
    if (!motionDrawing.active()) { super.dispatchDraw(canvas); return; }
    int saved = canvas.save();
    try {
      if (!"visible".equals(getOverflow()) || getTag(R.id.filter) != null) motionDrawing.clipChildren(canvas);
      CUIMotionDrawingDispatch.dispatchChildren(this, canvas);
    } finally { canvas.restoreToCount(saved); }
  }
  void setNativeMotionProjectionRevision(String revision) { motionProjectionRevision = revision == null ? "" : revision; }
  String motionProjectionRevision() { return motionProjectionRevision; }

  void setNativeMotionGeometryBinding(String value) { motionGeometryBinding = value == null ? "" : value; }
  void setNativeMotionGeometryRevision(String value) { motionGeometryRevision = value == null ? "" : value; }
  void synchronizeMotionGeometry() { motionGeometry.configure(ownerId, motionGeometryBinding, motionGeometryRevision); }
  void invalidateMotionGeometry() { motionGeometry.invalidate(); }
  void queryMotionGeometry(String owner, String binding, String request) { synchronizeMotionGeometry(); motionGeometry.query(owner, binding, request); }
  org.json.JSONObject motionSnapshotIdentity() throws org.json.JSONException { return motionGeometry.snapshotIdentity(); }
  void setNativeMotionColorObservation(boolean enabled) { nativeMotionColorObservation = enabled; }
  void synchronizeMotionColors() { motionColors.updateOwner(ownerId, nativeMotionColorObservation); motionColors.synchronize(); }
  void invalidateMotionColors() { motionColors.invalidate(); }
  void sampleMotionColors(String owner, String requestId, String request) { synchronizeMotionColors(); motionColors.sample(owner, requestId, request); }
  @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); if (motionColors != null) motionColors.attached(); if (motionGeometry != null) motionGeometry.attached(); if (formAction != null) formAction.attachmentChanged(true); synchronizeFocusWithin(); }
  @Override protected void drawableStateChanged() { super.drawableStateChanged(); if (motionColors != null) motionColors.synchronize(); }
  @Override protected void onConfigurationChanged(android.content.res.Configuration configuration) { super.onConfigurationChanged(configuration); if (motionColors != null) motionColors.synchronize(); }

  void setNativeLabelledBy(List<String> ids) { nativeLabelledBy = ids; }
  void setNativeDescribedBy(List<String> ids) { nativeDescribedBy = ids; }
  void setNativeDetailsBy(List<String> ids) { nativeDetailsBy = ids; }
  void setNativeDescriptionTag(int tag) { nativeDescriptionTag = tag; }
  void setNativeScrollAnchorTag(int tag) { nativeScrollAnchorTag = tag; }
  void setNativeScrollAnchorKey(String key) { nativeScrollAnchorKey = key; }
  void setNativeScrollAnchorRevision(String revision) { nativeScrollAnchorRevision = revision; }
  void prepareScrollAnchor() { scrollAnchor.prepare(nativeScrollAnchorTag, nativeScrollAnchorKey, nativeScrollAnchorRevision); }
  void requestContainerFocus(String owner) {
    if (!ownerId.equals(owner)) return;
    for (View view = getRootView().findFocus(); view != null;) {
      if (view == this) return;
      ViewParent parent = view.getParent(); view = parent instanceof View ? (View) parent : null;
    }
    requestKeyboardFocus(owner);
  }
  void setNativeNavigation(boolean enabled) { nativeNavigation = enabled; }
  void setNativeNavigationLabel(String label) { nativeNavigationLabel = label == null ? "Navigation" : label; }

  CharSequence accessibilityReferenceLabel() {
    if (nativeLabelledBy == null || nativeLabelledBy.isEmpty()) return super.getContentDescription();
    CUIAccessibilityReferences.Text label = CUIAccessibilityReferences.resolve(this, nativeLabelledBy, 0, false);
    CharSequence original = super.getContentDescription();
    if (!label.available || original == null) return label.available ? label.value : original;
    String content = original.toString();
    String callerLabel = (String) getTag(R.id.accessibility_label);
    // The SDK appends native state/value text to its primary label; replace only the label portion.
    if (callerLabel != null) {
      if (content.equals(callerLabel)) return label.value;
      if (content.startsWith(callerLabel + ", ")) return label.value + content.substring(callerLabel.length());
    }
    return label.value + ", " + content;
  }
  @Override public AccessibilityNodeInfo createAccessibilityNodeInfo() {
    AccessibilityNodeInfo info = super.createAccessibilityNodeInfo();
    if (info == null) return null;
    AccessibilityNodeInfoCompat node = AccessibilityNodeInfoCompat.wrap(info);
    CUIAccessibilityReferences.Text label = CUIAccessibilityReferences.resolve(this, nativeLabelledBy, 0, false);
    CUIAccessibilityReferences.Text description = CUIAccessibilityReferences.resolve(this, nativeDescribedBy, nativeDescriptionTag, true);
    CUIAccessibilityReferences.Text details = CUIAccessibilityReferences.resolve(this, nativeDetailsBy, 0, true);
    if (label.available) node.setContentDescription(accessibilityReferenceLabel());
    if (description.available) {
      // RN uses tooltip text for accessibilityHint; retain it in the native hint field before binding the description.
      if (node.getHintText() == null && node.getTooltipText() != null) node.setHintText(node.getTooltipText());
      node.setTooltipText(description.value);
    }
    if (details.available) CUIAccessibilityReferences.setDetails(node, details.value);
    if (nativeNavigation) {
      node.setRoleDescription(nativeNavigationLabel);
      node.setContainerTitle(node.getContentDescription());
    }
    collectionAccessibility.apply(info);
    return info;
  }
  void inspectAccessibility(String owner) {
    if (!ownerId.equals(owner) || !isAttachedToWindow() || !hasWindowFocus()) return;
    AccessibilityNodeInfo info = createAccessibilityNodeInfo();
    if (info == null) return;
    AccessibilityNodeInfoCompat node = AccessibilityNodeInfoCompat.wrap(info);
    CUIAccessibilityReferences.Text description = CUIAccessibilityReferences.resolve(this, nativeDescribedBy, nativeDescriptionTag, true);
    CUIAccessibilityReferences.Text details = CUIAccessibilityReferences.resolve(this, nativeDetailsBy, 0, true);
    WritableMap data = baseData();
    data.putString("windowId", CUIInputWindow.identity(this));
    data.putString("platform", "android");
    data.putBoolean("selected", node.isSelected());
    data.putInt("containerType", -1);
    CharSequence containerTitle = node.getContainerTitle();
    CharSequence roleDescription = node.getRoleDescription();
    data.putString("containerTitle", containerTitle == null ? "" : containerTitle.toString());
    data.putString("roleDescription", roleDescription == null ? "" : roleDescription.toString());
    data.putString("label", node.getContentDescription() == null ? "" : node.getContentDescription().toString());
    CharSequence hint = node.getHintText();
    if (hint == null && !description.available) hint = node.getTooltipText();
    data.putString("hint", hint == null ? "" : hint.toString());
    data.putString("value", node.getText() == null ? "" : node.getText().toString());
    data.putString("description", node.getTooltipText() == null ? "" : node.getTooltipText().toString());
    CharSequence nativeDetails = CUIAccessibilityReferences.details(node);
    data.putString("details", nativeDetails == null ? "" : nativeDetails.toString());
    data.putBoolean("descriptionAvailable", description.available);
    data.putBoolean("detailsAvailable", details.available);
    data.putString("collection", collectionAccessibility.inspect(info));
    data.putDouble("observedAt", SystemClock.uptimeMillis());
    emit("topNativeAccessibilitySnapshot", data);
  }

  void setOwnerId(String next) {
    if (next == null) next = "";
    if (!ownerId.equals(next)) cancelHeldKeys();
    ownerId = next;
  }

  void setKeyboardFocusable(boolean enabled) {
    keyboardFocusable = enabled;
    if (!enabled) {
      cancelHeldKeys();
      clearFocus();
    }
    synchronizeKeyboardFocusability();
  }

  void setNativePressable(boolean enabled) {
    if (nativePressable && !enabled) {
      setOnClickListener(null);
      setClickable(false);
    }
    nativePressable = enabled;
  }
  boolean isNativePressable() { return nativePressable; }

  void synchronizeNativeClick() {
    setOnClickListener(this);
    setClickable(true);
  }

  @Override public boolean performAccessibilityAction(int action, android.os.Bundle arguments) {
    if (action == android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK) CUIMenuPointerPolicies.recordVirtual(this);
    boolean handled = super.performAccessibilityAction(action, arguments);
    if (handled && nativePressable && action == android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
      CUIWindowPointers.activate(this);
    return handled;
  }

  @Override public void onClick(View view) {
    if (!nativePressable || !isAttachedToWindow() || !isShown() || !hasWindowFocus()) return;
    WritableMap data = baseData();
    data.putString("kind", "activation");
    data.putString("source", "android-click");
    data.putDouble("observedAt", SystemClock.uptimeMillis());
    data.putDouble("activationId", ++activationId);
    data.putString("scopeOwnerId", "");
    data.putString("windowId", CUIInputWindow.identity(this));
    data.putDouble("epoch", 0);
    for (ViewParent parent = getParent(); parent != null; parent = parent.getParent()) {
      if (parent instanceof CUIKeyboardScope) {
        ((CUIKeyboardScope) parent).writeActivationSession(data);
        break;
      }
    }
    emit("topNativeActivation", data);
  }

  void synchronizeKeyboardFocusability() {
    setFocusable(keyboardFocusable);
    setFocusableInTouchMode(keyboardFocusable);
  }

  void setCapturedKeys(Set<String> next) {
    if (!capturedKeys.equals(next)) cancelHeldKeys();
    capturedKeys = next;
  }

  void requestKeyboardFocus(String owner) {
    if (!ownerId.equals(owner) || !keyboardFocusable || !isAttachedToWindow() || !isShown() || !hasWindowFocus()) return;
    origin = "programmatic";
    requestFocus();
  }

  void requestKeyboardBlur(String owner) {
    if (ownerId.equals(owner)) clearFocus();
  }

  private WritableMap baseData() {
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId);
    data.putInt("target", getId());
    return data;
  }

  private void emit(String name, WritableMap data) {
    ThemedReactContext context = (ThemedReactContext) getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new InputEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data));
  }

  private void emitKey(KeyEvent event, boolean down, boolean cancelled, boolean handled) {
    WritableMap data = baseData();
    data.putString("kind", "keyboard");
    data.putString("key", CUIInputWindow.keyName(event));
    data.putInt("nativeCode", event.getKeyCode());
    int unicode = event.getUnicodeChar();
    String characters = event.getCharacters();
    if (characters == null) characters = unicode != 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
    data.putString("characters", characters);
    data.putString("phase", down ? "down" : "up");
    data.putBoolean("repeat", down && event.getRepeatCount() > 0);
    data.putBoolean("cancelled", cancelled);
    data.putBoolean("shiftKey", event.isShiftPressed());
    data.putBoolean("altKey", event.isAltPressed());
    data.putBoolean("ctrlKey", event.isCtrlPressed());
    data.putBoolean("metaKey", event.isMetaPressed());
    data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState()));
    data.putBoolean("nativeDefaultHandled", handled);
    data.putDouble("timestamp", cancelled ? SystemClock.uptimeMillis() : event.getEventTime());
    emit("topNativeKey", data);
  }

  boolean capturesObservedKey(KeyEvent event) {
    return keyboardFocusable && isFocused() && (held.get(event.getKeyCode()) != null ? consumed.contains(event.getKeyCode()) : capturedKeys.contains(CUIInputWindow.keyToken(event)));
  }
  String fieldInputOwnerId() { return ownerId; }

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (CUIFieldInputBinding.inDefault(event)) return super.dispatchKeyEvent(event);
    if (!keyboardFocusable || !isFocused() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) {
      return super.dispatchKeyEvent(event);
    }
    int code = event.getKeyCode();
    boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
    boolean handled = consumed.contains(code);
    if (down) {
      if (held.get(code) == null) handled = capturedKeys.contains(CUIInputWindow.keyToken(event));
      held.put(code, new KeyEvent(event));
      if (handled) consumed.add(code);
    }
    origin = "keyboard";
    CUIInputWindow.record(this, "keyboard");
    emitKey(event, down, event.isCanceled(), handled);
    if (!down) {
      held.remove(code);
      consumed.remove(code);
    }
    return handled || super.dispatchKeyEvent(event);
  }

  void cancelHeldKeys() {
    for (int index = 0; index < held.size(); index++) {
      int code = held.keyAt(index);
      emitKey(held.valueAt(index), false, true, consumed.contains(code));
    }
    held.clear();
    consumed.clear();
  }

  @Override
  protected void onFocusChanged(boolean focused, int direction, Rect previous) {
    super.onFocusChanged(focused, direction, previous);
    if (!focused) cancelHeldKeys();
    WritableMap data = baseData();
    data.putBoolean("isFocused", focused);
    data.putString("origin", origin.equals("programmatic") ? origin : CUIInputWindow.modality(this));
    boolean nativeNonTouchFocus = !isInTouchMode() && !CUIInputWindow.dispatchingPointer(this) && !origin.equals("programmatic");
    data.putBoolean("isFocusVisible", focused && hasWindowFocus() && (CUIInputWindow.modality(this).equals("keyboard") || nativeNonTouchFocus));
    data.putDouble("timestamp", SystemClock.uptimeMillis());
    emit("topNativeFocusChange", data);
    if (!ReactNativeFeatureFlags.enableImperativeFocus()) {
      WritableMap bubbled = Arguments.createMap(); bubbled.putInt("target", getId());
      emit(focused ? "topFocus" : "topBlur", bubbled);
    }
    if (!focused) origin = "unknown";
  }

  @Override
  public boolean dispatchTouchEvent(MotionEvent event) {
    CUIFieldInputBinding.PointerDecision decision = CUIFieldInputBinding.dispatchPointer(this, event);
    if (decision.prevented) return true;
    boolean handled = super.dispatchTouchEvent(event);
    return handled || decision.admitted;
  }

  @Override
  public boolean dispatchGenericMotionEvent(MotionEvent event) {
    CUIFieldInputBinding.PointerDecision decision = CUIFieldInputBinding.dispatchPointer(this, event);
    if (decision.prevented) return true;
    return super.dispatchGenericMotionEvent(event);
  }

  @Override
  public boolean onTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN) { origin = "pointer"; CUIInputWindow.record(this, "pointer"); }
    return super.onTouchEvent(event);
  }

  @Override
  protected void onDetachedFromWindow() {
    if (focusWithin != null) focusWithin.detached();
    if (formAction != null) formAction.attachmentChanged(false);
    motionGeometry.detached();
    motionColors.detached();
    scrollAnchor.invalidate();
    cancelHeldKeys();
    clearFocus();
    origin = "unknown";
    super.onDetachedFromWindow();
  }

  @Override
  public void onWindowFocusChanged(boolean focused) {
    if (formAction != null) formAction.snapshot();
    if (!focused) scrollAnchor.invalidate();
    if (!focused) cancelHeldKeys();
    super.onWindowFocusChanged(focused);
    if (focusWithin != null) focusWithin.sample();
    motionColors.synchronize();
  }

  private static final class InputEvent extends Event<InputEvent> {
    private final String name;
    private final WritableMap data;

    InputEvent(int surface, int tag, String name, WritableMap data) {
      super(surface, tag);
      this.name = name;
      this.data = data;
    }

    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
