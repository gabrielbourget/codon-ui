const assert = require("node:assert/strict")
const path = require("node:path")

const repo = path.resolve(__dirname, "../../../..")
const { pathToFileURL } = require("node:url")

const verify = async () => {
  const { default: plugin } = await import(
    pathToFileURL(path.join(repo, "apps/native-showcase/plugins/withNativeSDKSourceBuild.mjs"))
  )
  const config = plugin({ name: "SDK source fixture", slug: "sdk-source-fixture" })
  const originalIOS = { "expo.jsEngine": "hermes", "existing.fixture": "preserved" }
  const ios = await config.mods.ios.podfileProperties({
    ...config,
    modRequest: {},
    modResults: { ...originalIOS },
  })
  assert.deepEqual(ios.modResults, { ...originalIOS, "ios.buildReactNativeFromSource": "true" })
  const originalAndroid = 'rootProject.name = "Existing"\ninclude ":app"\n'
  const android = await config.mods.android.settingsGradle({
    ...config,
    modRequest: {},
    modResults: { language: "groovy", contents: originalAndroid },
  })
  assert.ok(android.modResults.contents.startsWith(originalAndroid))
  assert.match(android.modResults.contents, /includeBuild\(codonReactNativeSource\)/)
  assert.match(android.modResults.contents, /com.facebook.react:react-android/)
  assert.match(android.modResults.contents, /com.facebook.react:hermes-android/)
  const repeated = await config.mods.android.settingsGradle({ ...android, modRequest: {} })
  assert.equal(repeated.modResults.contents, android.modResults.contents)
  await assert.rejects(
    config.mods.android.settingsGradle({
      ...config,
      modRequest: {},
      modResults: { language: "kotlin", contents: "" },
    }),
    /existing Groovy settings file/,
  )
  console.log("7 actual Expo source-build mod assertions passed; no SDK build or linked artifact verdict")
}

verify().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
