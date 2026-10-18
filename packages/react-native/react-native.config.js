export default {
  dependency: {
    platforms: {
      android: {
        sourceDir: "./android",
        packageImportPath: "import com.codonui.input.CodonInputPackage;",
        packageInstance: "new CodonInputPackage()",
      },
      ios: { podspecPath: "./CodonNativeInput.podspec" },
    },
  },
}
