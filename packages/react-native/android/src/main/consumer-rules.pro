-keep class com.codonui.input.CUIMotionSnapshotModule { *; }
-keep class com.codonui.input.CUIMotionIntrinsics { *; }
-keepclassmembers class com.facebook.react.views.text.TextLayoutManager {
  private com.facebook.react.views.text.TextLayoutManager$CreateLayoutResult createLayout(android.text.Spannable, android.text.TextPaint, com.facebook.react.common.mapbuffer.MapBuffer, com.facebook.react.common.mapbuffer.MapBuffer, float, com.facebook.yoga.YogaMeasureMode, float, com.facebook.yoga.YogaMeasureMode);
}
-keep class com.facebook.react.views.text.TextLayoutManager$CreateLayoutResult {
  public android.text.Layout getLayout();
}
-keepclassmembers class com.facebook.react.fabric.FabricUIManager {
  com.facebook.react.fabric.FabricUIManagerBinding mBinding;
}
