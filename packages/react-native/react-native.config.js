export default {
  dependency: {
    platforms: {
      android: {
        sourceDir: "./android",
        packageImportPath: "import com.codonui.input.CodonInputPackage;",
        packageInstance: "new CodonInputPackage()",
        libraryName: "CodonNativeOverlay",
        cmakeListsPath: "src/main/jni/overlay/CMakeLists.txt",
        componentDescriptors: [
          "CUIOwnedTypographyFocusComponentDescriptor",
          "CUIKeyboardScopeComponentDescriptor",
          "CUICollectionRootComponentDescriptor",
          "CUICollectionNodeComponentDescriptor",
          "CUIFormRootComponentDescriptor",
          "CUIFieldBindingComponentDescriptor",
          "CUIDateSegmentComponentDescriptor",
          "CUIOwnedOverlayHostComponentDescriptor",
          "CUIOwnedOverlayViewportComponentDescriptor",
          "CUIOwnedOverlaySlotComponentDescriptor",
          "CUIOwnedClampHostComponentDescriptor",
        ],
      },
      ios: { podspecPath: "./CodonNativeInput.podspec" },
    },
  },
}
