import type { ExpoConfig } from "expo/config"

const config: ExpoConfig = {
  name: "Codon Native Showcase",
  slug: "codon-native-showcase",
  version: "0.1.0",
  platforms: ["ios", "android"],
  ios: { bundleIdentifier: "dev.codonui.showcase", supportsTablet: true },
  android: { package: "dev.codonui.showcase" },
  experiments: { reactCompiler: false },
  plugins: ["expo-dev-client", "./plugins/withNativeSDKSourceBuild.mjs"],
}

export default config
