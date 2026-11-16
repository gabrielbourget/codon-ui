import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { Project, type ExportDeclaration } from "ts-morph"

import { buildNativeSourceGraph } from "./graph"
import { TABLE_COMPOSITION_FILES, TABLE_NATIVE_FILES } from "./ownership"
import { createSourceReader, hashSource } from "./sourceFiles"
import { projectNativeTableSources } from "./tableProjection"

const componentNames = [
  "alert-dialog",
  "avatar",
  "breadcrumbs",
  "button",
  "card",
  "carousel",
  "checkbox",
  "checkbox-group",
  "circle-loader",
  "circular-progress",
  "click-popover",
  "combo-box",
  "compact-typeahead-search",
  "counter",
  "date-time-picker",
  "date-time-range-picker",
  "form-field",
  "indicator",
  "input",
  "lagging-lines-loader",
  "line-segment",
  "linear-progress",
  "link",
  "list-box-item",
  "menu",
  "meter",
  "modal",
  "number-input",
  "pagination",
  "panel",
  "placeholder-text",
  "radio",
  "radio-group",
  "select",
  "slider",
  "sort-and-filter-panel",
  "stepper",
  "switch",
  "table",
  "tag",
  "tag-combo-box",
  "tag-group",
  "text",
  "text-area",
  "thumbnail-image",
  "thumbnail-showcase",
  "time-picker",
  "toaster",
  "toggle-button",
  "toggle-switcher",
  "tooltip",
  "typeahead-search",
] as const

type File = {
  sourcePath: string
  targetRole: "utils" | "components" | "assets"
  targetPath: string
  role: "source"
  contentHash: string
}
type Item = {
  name: string
  type: "component" | "support"
  sourcePackage: string
  files: File[]
  registryDependencies: string[]
  peerDependencies?: Record<string, string>
  runtimeDependencies?: Record<string, string>
}
const sourceItem = (sourcePath: string) => `native-source/${sourcePath}`

/** Creates registry-v1 copy inputs from canonical sources. No consumer writes or installation. */
export const buildNativeRegistry = async (repoRoot: string) => {
  const nativeRoot = path.join(repoRoot, "packages/react-native")
  const reader = await createSourceReader(nativeRoot)
  const manifest = JSON.parse((await reader.read("package.json")).toString("utf8"))
  const project = new Project({ compilerOptions: {}, useInMemoryFileSystem: true })
  type PublicExport = { sourcePath: string; declaration: ExportDeclaration }
  const declarations: PublicExport[] = []
  const publicComponentBarrels = new Set<string>()
  const visited = new Set<string>()
  const resolvePublicSource = async (base: string) => {
    for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"])
      if (await reader.isFile(base + suffix)) return base + suffix
    throw new Error(`Missing native public source: ${base}`)
  }
  const collectPublicExports = async (sourcePath: string): Promise<void> => {
    if (visited.has(sourcePath)) return
    visited.add(sourcePath)
    const file = project.createSourceFile(sourcePath, (await reader.read(sourcePath)).toString("utf8"))
    for (const declaration of file.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue()
      if (!specifier?.startsWith(".")) continue
      const resolved = await resolvePublicSource(
        path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier)),
      )
      if (declaration.isNamespaceExport()) {
        if (sourcePath === "src/index.ts" && resolved.startsWith("src/components/"))
          publicComponentBarrels.add(resolved)
        await collectPublicExports(resolved)
      } else declarations.push({ sourcePath: resolved, declaration })
    }
  }
  await collectPublicExports("src/index.ts")
  const declarationPath = (item: PublicExport) => item.sourcePath.replace(/\.tsx?$/, "")
  const exportedNames = (item: PublicExport) =>
    item.declaration.getNamedExports().map((exported) => exported.getAliasNode()?.getText() ?? exported.getName())
  const entrypoints: Record<string, string[]> = {}
  const generated = new Map<string, string>()
  const entryFiles = new Map<string, File>()
  const canonicalFile = (sourcePath: string, contentHash: string): File => ({
    sourcePath: `packages/react-native/${sourcePath}`,
    targetRole: "utils",
    targetPath: `native/${sourcePath}`,
    role: "source",
    contentHash: `sha256:${contentHash}`,
  })
  const generatedFile = (
    relative: string,
    content: string,
    targetRole: File["targetRole"],
    targetPath: string,
  ): File => {
    const sourcePath = `packages/CLI/registry/native/${relative}`
    generated.set(sourcePath, content)
    return {
      sourcePath,
      targetRole,
      targetPath,
      role: "source",
      contentHash: `sha256:${hashSource(Buffer.from(content))}`,
    }
  }
  for (const name of [...componentNames, "native-root"]) {
    const symbol = name
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("")
    const primary = declarations.find((declaration) => exportedNames(declaration).includes(symbol))
    if (name !== "native-root" && !primary) throw new Error(`Missing canonical native export: ${symbol}`)
    const familyBarrel =
      primary &&
      [...publicComponentBarrels].find(
        (barrel) => path.posix.dirname(barrel) === path.posix.dirname(primary.sourcePath),
      )
    if (familyBarrel) {
      entrypoints[name] = [familyBarrel]
      const sourcePath = `packages/CLI/registry/native/components/${name}.ts`
      let relative = path.posix.relative(
        path.posix.dirname(sourcePath),
        `packages/react-native/${familyBarrel.replace(/\.tsx?$/, "")}`,
      )
      if (!relative.startsWith(".")) relative = `./${relative}`
      entryFiles.set(
        name,
        generatedFile(
          `components/${name}.ts`,
          `// Generated from the canonical component barrel. Installed implementation sources remain editable.\nexport * from ${JSON.stringify(relative)}\n`,
          "components",
          `${symbol}/index.ts`,
        ),
      )
      continue
    }
    const selected =
      name === "native-root"
        ? declarations.filter((declaration) => !declaration.sourcePath.startsWith("src/components/"))
        : declarations.filter(
            (declaration) =>
              path.posix.dirname(declarationPath(declaration)) === path.posix.dirname(declarationPath(primary!)),
          )
    entrypoints[name] = await Promise.all(
      [...new Set(selected.map(declarationPath))].map(async (base) => {
        for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"])
          if (await reader.isFile(base + suffix)) return base + suffix
        throw new Error(`Missing native public source: ${base}`)
      }),
    )
    const sourcePath = `packages/CLI/registry/native/components/${name}.ts`
    const content =
      "// Generated from canonical native exports. Installed implementation sources remain editable.\n" +
      selected
        .map((declaration) => {
          const original = declaration.declaration.getModuleSpecifierValue()!
          let relative = path.posix.relative(
            path.posix.dirname(sourcePath),
            `packages/react-native/${declarationPath(declaration)}`,
          )
          if (!relative.startsWith(".")) relative = `./${relative}`
          return declaration.declaration.getText().replace(JSON.stringify(original), JSON.stringify(relative))
        })
        .join("\n") +
      "\n"
    entryFiles.set(name, generatedFile(`components/${name}.ts`, content, "components", `${symbol}/index.ts`))
  }
  const graph = await buildNativeSourceGraph({ sourceRoot: nativeRoot, entrypoints })
  if (!graph.valid || !graph.nativeAdapter)
    throw new Error(`Invalid native source graph: ${JSON.stringify(graph.findings)}`)
  const adapter = { ...graph.nativeAdapter, findings: [] }
  const coreProjection = await projectNativeTableSources(reader, adapter, false)
  const nativeFiles = new Set(adapter.files)
  const tableFiles = new Set<string>(TABLE_NATIVE_FILES)
  const compositionFiles = new Set<string>(TABLE_COMPOSITION_FILES)
  const items: Item[] = []
  const dependencyFields = (files: readonly string[]) => {
    const selected = new Set(files)
    const result: { peerDependencies: Record<string, string>; runtimeDependencies: Record<string, string> } = {
      peerDependencies: {},
      runtimeDependencies: {},
    }
    for (const dependency of graph.externalDependencies) {
      if (!dependency.importedBy.some((file) => selected.has(file))) continue
      if (dependency.kind === "undeclared" || !dependency.requiredRange)
        throw new Error(`Undeclared native dependency ${dependency.packageName}`)
      result[dependency.kind === "peer" ? "peerDependencies" : "runtimeDependencies"][dependency.packageName] =
        dependency.requiredRange
    }
    return result
  }
  for (const file of graph.files) {
    if (nativeFiles.has(file.sourcePath)) continue
    items.push({
      name: sourceItem(file.sourcePath),
      type: "support",
      sourcePackage: manifest.name,
      files: [canonicalFile(file.sourcePath, file.contentHash)],
      registryDependencies: [],
      ...dependencyFields([file.sourcePath]),
    })
  }
  const fileHashes = new Map(graph.files.map((file) => [file.sourcePath, file.contentHash]))
  const fromCanonical = async (file: string) =>
    canonicalFile(file, fileHashes.get(file) ?? hashSource(await reader.read(file)))
  const runtimeManifest =
    JSON.stringify(
      {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        private: true,
        type: "module",
        main: "index.js",
        codegenConfig: manifest.codegenConfig,
      },
      null,
      2,
    ) + "\n"
  const runtimeFiles = [
    generatedFile("runtime/package.json", runtimeManifest, "utils", "native/package.json"),
    generatedFile("runtime/index.js", "export {}\n", "utils", "native/index.js"),
  ]
  for (const file of adapter.files)
    if (file !== "package.json" && !tableFiles.has(file) && !compositionFiles.has(file))
      runtimeFiles.push(await fromCanonical(file))
  items.push({
    name: "native-core",
    type: "support",
    sourcePackage: manifest.name,
    files: runtimeFiles,
    registryDependencies: [],
    ...dependencyFields(adapter.files.filter((file) => !tableFiles.has(file))),
  })
  items.push({
    name: "native-table",
    type: "support",
    sourcePackage: manifest.name,
    files: await Promise.all(TABLE_NATIVE_FILES.map(fromCanonical)),
    registryDependencies: ["native-core"],
  })
  const fullComposition = await Promise.all(TABLE_COMPOSITION_FILES.map(fromCanonical))
  const coreComposition = await Promise.all(
    TABLE_COMPOSITION_FILES.map(async (file) => {
      const replacement = coreProjection.replacements.find((candidate) => candidate.sourcePath === file)
      return replacement
        ? generatedFile(`core/${file}`, replacement.content, "utils", `native/${file}`)
        : fromCanonical(file)
    }),
  )
  items.push({
    name: "native-composition",
    type: "support",
    sourcePackage: manifest.name,
    files: coreComposition,
    registryDependencies: ["native-core"],
  })
  const moduleConfig = generatedFile(
    "bootstrap/react-native.module.js",
    'import { readFileSync } from "node:fs"\nimport path from "node:path"\nimport { fileURLToPath } from "node:url"\nconst config = JSON.parse(readFileSync(new URL("./codon-ui.config.json", import.meta.url), "utf8"))\nconst utils = config.paths?.roles?.utils ?? (config.paths?.registry ?? "src/components/_codon-ui-registry") + "/utils"\nexport default { dependencies: { "@codon-ui/react-native": { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), utils, "native") } } }\n',
    "assets",
    "react-native.config.js",
  )
  const commonConfig = generatedFile(
    "bootstrap/react-native.common.cjs",
    'const path = require("node:path")\nconst config = require("./codon-ui.config.json")\nconst utils = config.paths?.roles?.utils ?? (config.paths?.registry ?? "src/components/_codon-ui-registry") + "/utils"\nmodule.exports = { dependencies: { "@codon-ui/react-native": { root: path.resolve(__dirname, utils, "native") } } }\n',
    "assets",
    "react-native.config.js",
  )
  items.push({
    name: "native-integration",
    type: "support",
    sourcePackage: manifest.name,
    files: [commonConfig],
    registryDependencies: ["native-core"],
  })
  const showcase = JSON.parse(await readFile(path.join(repoRoot, "apps/native-showcase/package.json"), "utf8"))
  const intlPath = "apps/native-showcase/src/runtime/number-format.ts"
  const intlContent = await readFile(path.join(repoRoot, intlPath))
  const intlFile: File = {
    sourcePath: intlPath,
    targetRole: "utils",
    targetPath: "runtime/number-format.ts",
    role: "source",
    contentHash: `sha256:${hashSource(intlContent)}`,
  }
  const intlDependencies = Object.fromEntries(
    [
      "@formatjs/intl-getcanonicallocales",
      "@formatjs/intl-locale",
      "@formatjs/intl-pluralrules",
      "@formatjs/intl-numberformat",
    ].map((name) => [name, showcase.dependencies[name] as string]),
  )
  for (const name of [...componentNames, "native-root"]) {
    const owned = graph.files.filter((file) => file.owners.includes(name) && !nativeFiles.has(file.sourcePath))
    items.push({
      name,
      type: name === "native-root" ? "support" : "component",
      sourcePackage: manifest.name,
      files: name === "native-root" ? [entryFiles.get(name)!, intlFile] : [entryFiles.get(name)!],
      ...(name === "native-root" ? { runtimeDependencies: intlDependencies } : {}),
      registryDependencies: [
        ...new Set([
          "native-core",
          "native-composition",
          "native-integration",
          ...(name === "native-root" ? [] : ["native-root"]),
          ...(name === "table" ? ["native-table"] : []),
          ...owned.map((file) => sourceItem(file.sourcePath)),
        ]),
      ].sort(),
    })
  }
  return {
    registry: {
      schemaVersion: 1 as const,
      sourceIdentity: "@codon-ui/react-native-local",
      sourceRoot: "../../..",
      items,
      native: {
        schemaVersion: 1 as const,
        composition: { core: coreComposition, table: fullComposition },
        rootConfig: { module: moduleConfig, commonjs: commonConfig },
      },
    },
    generated,
  }
}

export const writeNativeRegistry = async (repoRoot: string) => {
  const { registry, generated } = await buildNativeRegistry(repoRoot)
  for (const [file, content] of generated) {
    const destination = path.join(repoRoot, file)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }
  await writeFile(
    path.join(repoRoot, "packages/CLI/registry/local-native.registry.json"),
    JSON.stringify(registry, null, 2) + "\n",
  )
  return { components: componentNames.length, files: generated.size, registryItems: registry.items.length }
}
