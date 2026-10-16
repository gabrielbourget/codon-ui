import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, URL } from "node:url"

const [sourceRoot, consumerRoot, outputRoot, packageName, revision = "1"] = process.argv.slice(2)
if (
  !sourceRoot ||
  !consumerRoot ||
  !outputRoot ||
  !["portal", "dialog", "alert-dialog", "select"].includes(packageName)
) {
  throw new Error("Usage: build.mjs SOURCE_ROOT CONSUMER_ROOT NEW_OUTPUT_ROOT PACKAGE [TRIAL_REVISION]")
}
const require = createRequire(path.join(consumerRoot, "package.json"))
const typescript = require("typescript")
const configuration = JSON.parse(readFileSync(new URL("./build.config.json", import.meta.url), "utf8"))
if (typescript.version !== configuration.typescript) throw new Error("Unexpected TypeScript version")
if (existsSync(outputRoot)) throw new Error("Build output must have a fresh identity")
mkdirSync(outputRoot, { recursive: true })
const packageRoot = path.join(outputRoot, "package")
const upstreamRoot = path.join(sourceRoot, "packages", packageName)
cpSync(path.join(upstreamRoot, "src"), path.join(packageRoot, "src"), { recursive: true })
cpSync(path.join(sourceRoot, "LICENSE"), path.join(packageRoot, "LICENSE"))
const installedPackageRoot = path.dirname(path.dirname(require.resolve(`@rn-primitives/${packageName}`)))
const dependencyRoot = path.resolve(installedPackageRoot, "../..")
symlinkSync(dependencyRoot, path.join(packageRoot, "node_modules"), "dir")
const dist = path.join(packageRoot, "dist")
mkdirSync(dist)
const files = readdirSync(path.join(packageRoot, "src")).filter(
  (file) => /\.tsx?$/u.test(file) && !file.includes(".web."),
)
const sourceIdentities = []
for (const file of files) {
  const filename = path.join(packageRoot, "src", file)
  const source = readFileSync(filename, "utf8")
  sourceIdentities.push({ file, sha256: createHash("sha256").update(source).digest("hex") })
  for (const format of ["esm", "commonjs"]) {
    const result = typescript.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        target: typescript.ScriptTarget[configuration.target],
        module: format === "esm" ? typescript.ModuleKind.ESNext : typescript.ModuleKind.CommonJS,
        jsx: typescript.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      reportDiagnostics: true,
    })
    if (result.diagnostics?.length)
      throw new Error(
        typescript.formatDiagnosticsWithColorAndContext(result.diagnostics, {
          getCanonicalFileName: (value) => value,
          getCurrentDirectory: () => packageRoot,
          getNewLine: () => "\n",
        }),
      )
    const suffix = format === "esm" ? ".mjs" : ".js"
    const output =
      format === "esm"
        ? result.outputText.replace(/(from\s+["'])(\.\/[^"']+)(["'])/gu, "$1$2.mjs$3")
        : result.outputText
    writeFileSync(path.join(dist, file.replace(/\.tsx?$/u, suffix)), output)
  }
}
const options = typescript.convertCompilerOptionsFromJson(
  {
    ...configuration.declarations,
    target: configuration.target,
    declaration: true,
    emitDeclarationOnly: true,
    rootDir: path.join(packageRoot, "src"),
    outDir: dist,
    types: ["react"],
    typeRoots: [path.join(consumerRoot, "node_modules", "@types")],
    paths: {
      react: [path.join(consumerRoot, "node_modules", "@types", "react", "index.d.ts")],
      "react/*": [path.join(consumerRoot, "node_modules", "@types", "react", "*")],
    },
  },
  packageRoot,
)
const program = typescript.createProgram([path.join(packageRoot, "src", "index.ts")], options.options)
const diagnostics = [...options.errors, ...typescript.getPreEmitDiagnostics(program)]
if (diagnostics.length) {
  throw new Error(
    typescript.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (value) => value,
      getCurrentDirectory: () => packageRoot,
      getNewLine: () => "\n",
    }),
  )
}
if (program.emit().emitSkipped) throw new Error("Declaration emission failed")
const upstreamManifest = JSON.parse(readFileSync(path.join(upstreamRoot, "package.json"), "utf8"))
const manifest = {
  name: upstreamManifest.name,
  version: `${upstreamManifest.version}+codon.trial.${revision}`,
  private: true,
  description: "Non-shipping native-only Codon compatibility experiment",
  license: upstreamManifest.license,
  main: "dist/index.js",
  module: "dist/index.mjs",
  types: "dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.mjs",
      require: "./dist/index.js",
      default: "./dist/index.js",
    },
  },
  files: ["dist", "LICENSE", "codon-trial.json"],
  dependencies: upstreamManifest.dependencies,
  peerDependencies: upstreamManifest.peerDependencies,
  peerDependenciesMeta: upstreamManifest.peerDependenciesMeta,
}
writeFileSync(path.join(packageRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
const provenance = {
  upstreamRevision: "1bebe66b12e7ddd3c313226e0bc2ee02b6e78ab4",
  package: manifest.name,
  version: manifest.version,
  typescript: typescript.version,
  nativeOnly: true,
  sourceIdentities,
  builderSha256: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex"),
  configurationSha256: createHash("sha256").update(JSON.stringify(configuration)).digest("hex"),
}
writeFileSync(path.join(packageRoot, "codon-trial.json"), `${JSON.stringify(provenance, null, 2)}\n`)
execFileSync("pnpm", ["pack", "--pack-destination", outputRoot], { cwd: packageRoot, stdio: "inherit" })
const tarball = readdirSync(outputRoot).find((file) => file.endsWith(".tgz"))
if (!tarball) throw new Error("Missing packed artifact")
const bytes = readFileSync(path.join(outputRoot, tarball))
writeFileSync(
  path.join(outputRoot, "receipt.json"),
  `${JSON.stringify({ ...provenance, tarball, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2)}\n`,
)
