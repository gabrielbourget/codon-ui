const { createRequire } = require("node:module")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const repo = path.resolve(__dirname, "../../../../")
const native = repo + "/packages/react-native"
const showcase = repo + "/apps/native-showcase"
const req = createRequire(showcase + "/package.json")
const expoReq = createRequire(req.resolve("expo/package.json"))
const metroReq = createRequire(expoReq.resolve("@expo/metro-config/package.json"))
const Metro = metroReq("metro")
const { getDefaultConfig } = req("expo/metro-config")
const sha = (content) => crypto.createHash("sha256").update(content).digest("hex")
const platform = process.argv[2]
const outputRoot = process.argv[3]
if (!outputRoot || !path.isAbsolute(outputRoot)) throw Error("Supply an absolute output directory")
;(async () => {
  if (!["android", "ios"].includes(platform)) throw Error("Expected android or ios")
  const config = await getDefaultConfig(showcase)
  config.maxWorkers = 2
  config.watchFolders = [...new Set([...config.watchFolders, repo])]
  const result = await Metro.runBuild(config, {
    entry: native + "/src/collection/state.ts",
    platform,
    dev: false,
    minify: false,
    sourceMap: true,
    sourceMapUrl: "collection-runtime.map",
    onProgress: (current, total) => {
      if (current === total) process.stdout.write("transformed " + current + "/" + total + "\n")
    },
  })
  const map = typeof result.map === "string" ? JSON.parse(result.map) : result.map
  if (!map || !Array.isArray(map.sources)) throw Error("Missing complete source map")
  const inputs = map.sources.map((source, index) => ({
    source,
    sha256: sha(map.sourcesContent[index] ?? ""),
    content: map.sourcesContent[index],
  }))
  const banned = inputs.filter((input) =>
    /(?:react-dom|react-aria|react-native-web|__tests__|test-renderer)/.test(input.source),
  )
  if (banned.length) throw Error("Unexpected runtime " + banned.map((item) => item.source))
  const stateSources = inputs.filter((input) => input.source.includes("/react-stately/"))
  if (!stateSources.length) throw Error("State runtime absent")
  const reactRoots = [
    ...new Set(
      inputs
        .filter((input) => /\/node_modules\/react\//.test(input.source))
        .map((input) => input.source.split("/node_modules/react/")[0]),
    ),
  ]
  if (reactRoots.length !== 1 || !reactRoots[0].includes("react@19.2.3")) throw Error("React identity " + reactRoots)
  const out = path.join(outputRoot, platform)
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(out + "/bundle.js", result.code)
  fs.writeFileSync(out + "/bundle.map", JSON.stringify(map))
  const nativeRequire = createRequire(native + "/package.json")
  const statelyRequire = createRequire(nativeRequire.resolve("react-stately/package.json"))
  const versions = {}
  for (const [name, version] of Object.entries({
    "react-stately": "3.46.0",
    "@internationalized/date": "3.12.1",
    "@internationalized/number": "3.6.6",
    "@internationalized/string": "3.2.8",
    "@react-types/shared": "3.34.0",
    "@swc/helpers": "0.5.2",
    "use-sync-external-store": "1.6.0",
  })) {
    const resolver = name === "react-stately" ? nativeRequire : statelyRequire
    const filename = resolver.resolve
      .paths(name)
      .map((directory) => path.join(directory, name, "package.json"))
      .find((candidate) => fs.existsSync(candidate))
    if (!filename) throw Error("Missing installed manifest " + name)
    const actual = JSON.parse(fs.readFileSync(filename, "utf8")).version
    if (actual !== version) throw Error(name + " version " + actual)
    versions[name] = actual
  }
  if (fs.realpathSync(statelyRequire.resolve("react")) !== fs.realpathSync(nativeRequire.resolve("react")))
    throw Error("State peer uses another React")
  const proof = {
    versions,
    scope: "Metro runtime source graph only; native actions0; no family or SDK acceptance",
    platform,
    entry: "packages/react-native/src/collection/state.ts",
    reactRoots,
    moduleCount: inputs.length,
    statelyModules: stateSources.length,
    domImports: banned.length,
    bundleSHA256: sha(result.code),
    sourceMapSHA256: sha(JSON.stringify(map)),
    inputsSHA256: Object.fromEntries(inputs.map(({ source, sha256 }) => [source, sha256])),
  }
  fs.writeFileSync(out + "/proof.json", JSON.stringify(proof, null, 2) + "\n")
  process.stdout.write(JSON.stringify({ ...proof, inputsSHA256: undefined }) + "\n")
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
