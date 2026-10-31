import configPlugins from "expo/config-plugins.js"

const { withPodfileProperties, withSettingsGradle } = configPlugins

const sourceBuildMarker = "// Codon approved RN 0.86.3 source-patch prototype"
const androidSubstitution =
  '    substitute(module("com.facebook.react:react-android")).using(project(":packages:react-native:ReactAndroid"))'
const legacyAndroidSubstitution =
  '    substitute(module("com.facebook.react:react-native")).using(project(":packages:react-native:ReactAndroid"))'

const withNativeSDKSourceBuild = (config) => {
  config = withPodfileProperties(config, (config) => {
    config.modResults["ios.buildReactNativeFromSource"] = "true"
    return config
  })
  return withSettingsGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("The native SDK prototype requires the existing Groovy settings file")
    }
    if (!config.modResults.contents.includes(sourceBuildMarker)) {
      config.modResults.contents += `
${sourceBuildMarker}
def codonReactNativeSource = new File(providers.exec {
  workingDir(rootDir)
  commandLine("node", "--print", "require.resolve('react-native/package.json')")
}.standardOutput.asText.get().trim()).parentFile
includeBuild(codonReactNativeSource) {
  dependencySubstitution {
    substitute(module("com.facebook.react:react-android")).using(project(":packages:react-native:ReactAndroid"))
    substitute(module("com.facebook.react:hermes-android")).using(project(":packages:react-native:ReactAndroid:hermes-engine"))
  }
}
`
    }
    if (!config.modResults.contents.includes(legacyAndroidSubstitution)) {
      if (!config.modResults.contents.includes(androidSubstitution)) {
        throw new Error("The native SDK prototype requires its ReactAndroid source substitution")
      }
      config.modResults.contents = config.modResults.contents.replace(
        androidSubstitution,
        `${androidSubstitution}\n${legacyAndroidSubstitution}`,
      )
    }
    return config
  })
}

export default withNativeSDKSourceBuild
