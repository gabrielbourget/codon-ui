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
          "CUIOwnedFocusViewComponentDescriptor",
          "CUIKeyboardScopeComponentDescriptor",
          "CUICollectionRootComponentDescriptor",
          "CUIFormRootComponentDescriptor",
          "CUIFieldBindingComponentDescriptor",
          "CUIDateSegmentComponentDescriptor",
          "CUIOverlayHostComponentDescriptor",
        ],
      },
      ios: { podspecPath: "./CodonNativeInput.podspec" },
    },
  },
}
