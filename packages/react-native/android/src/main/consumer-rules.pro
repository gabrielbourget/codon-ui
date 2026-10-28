-keep class com.codonui.input.CUIClampText { *; }
-keep class com.codonui.input.CUIFormDocumentModule { *; }
-keep class com.codonui.input.CUIMotionSnapshotModule { *; }
-keep class com.codonui.input.CUIMotionIntrinsics { *; }
-keep class com.codonui.input.CUIMotionDrawingDispatch { *; }
-keepclassmembers class com.facebook.react.views.text.TextLayoutManager {
  private com.facebook.react.views.text.TextLayoutManager$CreateLayoutResult createLayout(android.text.Spannable, android.text.TextPaint, com.facebook.react.common.mapbuffer.MapBuffer, com.facebook.react.common.mapbuffer.MapBuffer, float, com.facebook.yoga.YogaMeasureMode, float, com.facebook.yoga.YogaMeasureMode);
}
-keep class com.facebook.react.views.text.TextLayoutManager$CreateLayoutResult {
  public android.text.Layout getLayout();
}
-keepclassmembers class com.facebook.react.fabric.FabricUIManager {
  com.facebook.react.fabric.FabricUIManagerBinding mBinding;
  private final com.facebook.react.uimanager.ViewManagerRegistry mViewManagerRegistry;
}
-keepclassmembers class com.facebook.react.common.assets.ReactFontManager {
  private final java.util.Map fontCache;
  private final java.util.Map customTypefaceCache;
}
-keep class com.facebook.react.common.assets.ReactFontManager$AssetFontFamily {
  private final android.util.SparseArray typefaceSparseArray;
}
-keepclassmembers class com.facebook.react.views.text.internal.span.CustomStyleSpan {
  private final android.content.res.AssetManager assetManager;
  private final int privateStyle;
  private final int privateWeight;
}
