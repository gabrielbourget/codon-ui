import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ignoredDirectories = new Set([".git", "node_modules", ".expo", ".gradle", "build", "dist", "Pods"])
export const hash = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`
export const readJson = (filename) => JSON.parse(readFileSync(filename, "utf8"))
export const writeJson = (filename, value) => writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`)
const contained = (root, target) => {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

export const consumerPath = (root, relative) => {
  assert.equal(typeof relative, "string", "consumer paths must be strings")
  assert.ok(relative && !path.isAbsolute(relative), `expected a relative consumer path: ${relative}`)
  const target = path.resolve(root, relative)
  assert.ok(contained(path.resolve(root), target), `path escapes consumer: ${relative}`)
  let current = target
  while (!existsSync(current)) current = path.dirname(current)
  assert.ok(contained(realpathSync(root), realpathSync(current)), `linked path escapes consumer: ${relative}`)
  return target
}

export const assertExternalConsumer = (root, repository) => {
  const consumer = realpathSync(root)
  const workspace = realpathSync(repository)
  assert.ok(
    !contained(workspace, consumer) && !contained(consumer, workspace),
    "consumer must be outside the repository",
  )
  let parent = consumer
  while (true) {
    assert.ok(!existsSync(path.join(parent, "pnpm-workspace.yaml")), `consumer inherits workspace ${parent}`)
    if (parent === path.dirname(parent)) break
    parent = path.dirname(parent)
  }
}

export const snapshot = (root, roots = ["."]) => {
  const files = {}
  const visit = (relative) => {
    const target = consumerPath(root, relative)
    const stat = lstatSync(target)
    assert.ok(!stat.isSymbolicLink(), `source snapshot contains a symlink: ${relative}`)
    if (stat.isDirectory()) {
      for (const name of readdirSync(target).sort()) {
        if (!ignoredDirectories.has(name)) visit(path.posix.join(relative, name))
      }
    } else {
      assert.ok(stat.isFile(), `unsupported consumer entry: ${relative}`)
      files[relative.replace(/^\.\//, "")] = hash(readFileSync(target))
    }
  }
  for (const relative of roots) visit(relative)
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
}

export const assertUnchanged = (before, after) => {
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (filename) => before[filename] !== after[filename],
  )
  assert.deepEqual(changed, [], `consumer files changed: ${changed.join(", ")}`)
}

export const assertEditableFiles = (root, files) => {
  assert.ok(Object.keys(files).length > 0, "declare the expected distributed files")
  for (const [relative, expectedHash] of Object.entries(files)) {
    const target = consumerPath(root, relative)
    const stat = lstatSync(target)
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `expected an editable regular file: ${relative}`)
    assert.equal(stat.nlink, 1, `editable file shares an inode: ${relative}`)
    assert.equal(hash(readFileSync(target)), expectedHash, `unexpected distributed bytes: ${relative}`)
  }
}

const resolvePackage = (root, name, context) => {
  assert.match(name, /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i, "invalid package name")
  let directory = realpathSync(consumerPath(root, context))
  let manifest
  while (true) {
    const candidate = path.join(directory, "node_modules", name, "package.json")
    if (path.basename(directory) !== "node_modules" && existsSync(candidate)) {
      manifest = candidate
      break
    }
    assert.notEqual(directory, path.dirname(directory), `cannot resolve ${name} from ${context}`)
    directory = path.dirname(directory)
  }
  const packageRoot = realpathSync(path.dirname(manifest))
  assert.ok(
    contained(realpathSync(root), packageRoot),
    `${name} resolves outside the external consumer from ${context}`,
  )
  const installed = readJson(path.join(packageRoot, "package.json"))
  assert.equal(installed.name, name, `unexpected package identity for ${name}`)
  return { root: packageRoot, manifest: installed }
}

export const assertDependencies = (root, versions, contexts = ["."]) => {
  assert.ok(contexts.includes("."), "dependency contexts must include the consumer root")
  const consumer = readJson(path.join(root, "package.json"))
  const identities = {}
  for (const [name, version] of Object.entries(versions)) {
    const declarations = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].flatMap(
      (field) => (consumer[field]?.[name] === undefined ? [] : [consumer[field][name]]),
    )
    assert.deepEqual(declarations, [version], `${name} must have one exact consumer declaration`)
    const roots = new Set()
    for (const context of contexts) {
      const resolved = resolvePackage(root, name, context)
      assert.equal(resolved.manifest.version, version, `${name} version mismatch from ${context}`)
      roots.add(resolved.root)
    }
    assert.equal(roots.size, 1, `${name} has multiple installed identities across requested contexts`)
    identities[name] = { version, root: [...roots][0] }
  }
  return identities
}

export const captureNativeInputs = (root, roots) => {
  assert.ok(roots?.length > 0, "declare all native package, spec, wrapper, manifest and lock inputs")
  const files = snapshot(root, roots)
  assert.ok(Object.keys(files).length > 0, "native input set cannot be empty")
  return { kind: "native-input-fingerprint", roots, files, digest: hash(JSON.stringify(files)) }
}

export const assertNativeInputs = (root, captured) => {
  assert.equal(captured.kind, "native-input-fingerprint")
  assert.deepEqual(
    captureNativeInputs(root, captured.roots),
    captured,
    "native inputs changed; rebuild before runtime verification",
  )
}

export const assertNativePackage = (root, relative, expected) => {
  const directory = consumerPath(root, relative)
  const manifest = readJson(path.join(directory, "package.json"))
  assert.equal(manifest.name, expected.name)
  assert.equal(manifest.version, expected.version)
  assert.equal(manifest.codegenConfig?.name, expected.codegenName)
  assert.ok(expected.codegenName, "declare the expected selected codegen identity")
  const specs = snapshot(directory, [manifest.codegenConfig.jsSrcsDir])
  assert.ok(
    Object.keys(specs).some((filename) => /\.[jt]sx?$/.test(filename)),
    "codegen source directory has no JS/TS specs",
  )
  const files = snapshot(directory)
  assert.ok(
    Object.keys(files).some((filename) => filename.endsWith(".podspec")),
    "missing iOS podspec",
  )
  assert.ok(
    Object.keys(files).some((filename) => /^ios\/.*\.(h|m|mm|swift)$/.test(filename)),
    "missing iOS source",
  )
  assert.ok(files["android/build.gradle"], "missing Android build integration")
  assert.ok(
    Object.keys(files).some((filename) => /^android\/.*\.(java|kt|cpp)$/.test(filename)),
    "missing Android source",
  )
  assert.ok(files["react-native.config.js"] || files["react-native.config.cjs"], "missing RN autolink configuration")
  return { name: manifest.name, version: manifest.version, codegenName: manifest.codegenConfig.name, files }
}

export const assertCodegenSchema = (schema, expectedModules) => {
  assert.ok(expectedModules?.length > 0, "declare the exact selected codegen module names")
  assert.deepEqual(
    Object.keys(schema.modules ?? {}).sort(),
    [...expectedModules].sort(),
    "unexpected codegen module selection",
  )
  for (const name of expectedModules) {
    assert.ok(["Component", "NativeModule"].includes(schema.modules[name].type), `invalid codegen module type: ${name}`)
  }
}

export const assertAutolink = (root, config, expected) => {
  assert.ok(["android", "ios"].includes(expected.platform), "select an autolink platform")
  assert.equal(realpathSync(config.root), realpathSync(root), "autolink scanned the wrong consumer")
  assert.ok(expected.packages?.length > 0, "declare the selected native package set")
  for (const name of expected.absent ?? [])
    assert.ok(!config.dependencies?.[name], `unselected native dependency: ${name}`)
  for (const selected of expected.packages) {
    const dependency = config.dependencies?.[selected.name]
    assert.ok(dependency, `missing autolink dependency: ${selected.name}`)
    const packageRoot = consumerPath(root, selected.path)
    assert.equal(realpathSync(dependency.root), realpathSync(packageRoot), `wrong autolink root: ${selected.name}`)
    const manifest = readJson(path.join(packageRoot, "package.json"))
    assert.equal(manifest.name, selected.name, "native package name drift")
    assert.equal(manifest.version, selected.version, "native package version drift")
    const platform = dependency.platforms?.[expected.platform]
    assert.ok(platform, `missing ${expected.platform} integration: ${selected.name}`)
    for (const [field, relative] of Object.entries(selected.paths ?? {})) {
      assert.equal(
        realpathSync(platform[field]),
        realpathSync(consumerPath(root, relative)),
        `wrong ${field}: ${selected.name}`,
      )
    }
    for (const [field, value] of Object.entries(selected.values ?? {})) {
      assert.deepEqual(platform[field], value, `wrong ${field}: ${selected.name}`)
    }
  }
}

export const seedConsumer = (root, repository) => {
  assertExternalConsumer(root, repository)
  assert.deepEqual(readdirSync(root), [], "seed requires an empty consumer directory")
  const showcase = readJson(path.join(repository, "apps/native-showcase/package.json"))
  const pickPins = (source, names) =>
    Object.fromEntries(
      names.map((name) => {
        assert.match(source[name], /^\d+\.\d+\.\d+$/, `expected an exact existing pin for ${name}`)
        return [name, source[name]]
      }),
    )
  writeJson(path.join(root, "package.json"), {
    name: "codon-external-expo-consumer",
    version: "0.0.0",
    private: true,
    packageManager: readJson(path.join(repository, "package.json")).packageManager,
    main: "index.js",
    scripts: { start: "expo start --dev-client", typecheck: "tsc --noEmit" },
    dependencies: pickPins(showcase.dependencies, ["expo", "expo-dev-client", "react", "react-native"]),
    devDependencies: pickPins(showcase.devDependencies, [
      "@babel/core",
      "@types/react",
      "babel-preset-expo",
      "typescript",
    ]),
  })
  writeJson(path.join(root, "app.json"), {
    expo: {
      name: "Codon External Consumer",
      slug: "codon-external-consumer",
      version: "0.0.0",
      scheme: "codon-external-consumer",
      platforms: ["ios", "android"],
      ios: { bundleIdentifier: "dev.codonui.externalconsumer" },
      android: { package: "dev.codonui.externalconsumer" },
      plugins: ["expo-dev-client"],
      experiments: { reactCompiler: false },
    },
  })
  writeJson(path.join(root, "tsconfig.json"), { extends: "expo/tsconfig.base", compilerOptions: { strict: true } })
  writeFileSync(path.join(root, "babel.config.cjs"), 'module.exports = { presets: ["babel-preset-expo"] }\n')
  writeFileSync(
    path.join(root, "metro.config.cjs"),
    'const { getDefaultConfig } = require("expo/metro-config")\nmodule.exports = getDefaultConfig(__dirname)\n',
  )
  writeFileSync(
    path.join(root, "index.js"),
    'import { registerRootComponent } from "expo"\nimport App from "./App"\nregisterRootComponent(App)\n',
  )
  writeFileSync(path.join(root, "App.tsx"), 'export { default } from "./SelectedComponents"\n')
  writeFileSync(
    path.join(root, "SelectedComponents.tsx"),
    [
      "// Replace this module with direct imports of the actual CLI-installed component sources.",
      "// Compose their real providers, an editable input and an overlay; retain owner state readouts.",
      "const SelectedComponents = (): never => {",
      '  throw new Error("Wire the actual selected Codon components before consumer smoke verification")',
      "}",
      "export default SelectedComponents\n",
    ].join("\n"),
  )
  return { root: realpathSync(root), pins: readJson(path.join(root, "package.json")), files: snapshot(root) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, root, argument] = process.argv.slice(2)
  assert.ok(root, "usage: consumer-probe.mjs seed|snapshot|native-check <consumer> <repository-or-fingerprint>")
  if (command === "seed") process.stdout.write(`${JSON.stringify(seedConsumer(root, argument), null, 2)}\n`)
  else if (command === "snapshot") process.stdout.write(`${JSON.stringify(snapshot(root), null, 2)}\n`)
  else if (command === "native-check") assertNativeInputs(root, readJson(argument))
  else throw new Error(`unknown command: ${command}`)
}
