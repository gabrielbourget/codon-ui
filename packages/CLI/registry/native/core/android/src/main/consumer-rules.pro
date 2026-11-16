-keep class com.codonui.input.CUIFormDocumentModule { *; }
-keep class com.codonui.input.CUIMotionSnapshotModule { *; }
-keep class com.codonui.input.CUIMotionDrawingDispatch { *; }
-keepclassmembers class com.facebook.react.fabric.FabricUIManager {
  com.facebook.react.fabric.FabricUIManagerBinding mBinding;
}
