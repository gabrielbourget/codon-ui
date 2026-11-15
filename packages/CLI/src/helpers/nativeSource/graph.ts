import path from "node:path"

import { z } from "zod"

import { inspectNativeAdapter, type TNativeAdapter, type TNativeDependency } from "./nativeAdapter"
import { createSourceReader, hashSource, readSourceImports, type TSourceFinding } from "./sourceFiles"

const manifestSchema = z.object({
  name: z.literal("@codon-ui/react-native"),
  dependencies: z.record(z.string()).default({}),
  peerDependencies: z.record(z.string()).default({}),
  codegenConfig: z.unknown(),
})

export type TNativeSourceFile = { sourcePath: string; contentHash: string; owners: string[] }
export type TNativeSourceEdge = { from: string; to: string; kind: "source" | "type" | TNativeDependency["kind"] }
export type TNativeExternalDependency = {
  packageName: string
  specifier: string
  requiredRange?: string
  kind: "peer" | "runtime" | "undeclared"
  importedBy: string[]
}
export type TNativeSourceGraph = {
  sourcePackage: string
  files: TNativeSourceFile[]
  edges: TNativeSourceEdge[]
  externalDependencies: TNativeExternalDependency[]
  nativeRuntimeOwners: { sourcePath: string; owners: string[] }[]
  nativeAdapter?: Omit<TNativeAdapter, "findings"> & { owners: string[] }
  findings: TSourceFinding[]
  valid: boolean
}

/** Read-only preparation for later registry integration. Does not resolve consumer projects or write install plans. */
export const buildNativeSourceGraph = async ({
  sourceRoot,
  entrypoints,
}: {
  sourceRoot: string
  entrypoints: Readonly<Record<string, readonly string[]>>
}): Promise<TNativeSourceGraph> => {
  const reader = await createSourceReader(sourceRoot)
  const manifest = manifestSchema.parse(JSON.parse((await reader.read("package.json")).toString("utf8")))
  const files = new Map<string, { content: Buffer; owners: Set<string> }>()
  const edges = new Map<string, TNativeSourceEdge>()
  const externals = new Map<string, TNativeExternalDependency>()
  const findings: TSourceFinding[] = []
  const visited = new Set<string>()
  const nativeOwners = new Set<string>()
  const nativeRuntimeOwners = new Map<string, Set<string>>()
  const sourceImports = new Map<string, ReturnType<typeof readSourceImports>>()
  const importResolutions = new Map<string, Promise<string>>()
  const references = new Map<string, string[]>()
  const addEdge = (edge: TNativeSourceEdge) => edges.set(JSON.stringify(edge), edge)
  const report = (code: string, sourcePath: string, message: string) => findings.push({ code, sourcePath, message })
  const addFile = async (sourcePath: string, owner: string) => {
    let file = files.get(sourcePath)
    if (!file) {
      file = { content: await reader.read(sourcePath), owners: new Set() }
      files.set(sourcePath, file)
    }
    file.owners.add(owner)
    return file.content.toString("utf8")
  }
  const resolveSourceImport = async (from: string, specifier: string) => {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
    // Platform suffixes are deliberately refused until a consumer-platform policy is integrated.
    for (const suffix of [".ios.ts", ".ios.tsx", ".android.ts", ".android.tsx", ".native.ts", ".native.tsx"]) {
      if (await reader.isFile(`${base}${suffix}`))
        throw new Error(`Platform-specific resolution is unsupported: ${specifier}`)
    }
    const candidates = [
      base,
      ...[".ts", ".tsx", ".js", ".jsx", ".json"].map((suffix) => `${base}${suffix}`),
      ...["ts", "tsx", "js", "jsx"].map((suffix) => `${base}/index.${suffix}`),
    ]
    for (const candidate of candidates) if (await reader.isFile(candidate)) return candidate
    throw new Error(`Unresolved relative import: ${specifier}`)
  }
  const resolveImport = (from: string, specifier: string) => {
    const key = JSON.stringify([from, specifier])
    let resolution = importResolutions.get(key)
    if (!resolution) {
      resolution = resolveSourceImport(from, specifier)
      importResolutions.set(key, resolution)
    }
    return resolution
  }
  const visit = async (sourcePath: string, owner: string, runtime: boolean): Promise<void> => {
    sourcePath = path.posix.normalize(sourcePath)
    const key = JSON.stringify([sourcePath, owner, runtime])
    if (visited.has(key)) return
    visited.add(key)
    try {
      const content = await addFile(sourcePath, owner)
      for (
        let directory = path.posix.dirname(sourcePath);
        directory.startsWith("src");
        directory = path.posix.dirname(directory)
      ) {
        if (!references.has(directory)) references.set(directory, await reader.references(directory))
        for (const reference of references.get(directory) ?? []) {
          await addFile(reference, owner)
          addEdge({ from: sourcePath, to: reference, kind: "source" })
        }
      }
      if (!/\.[cm]?[jt]sx?$/.test(sourcePath)) return
      let parsed = sourceImports.get(sourcePath)
      if (!parsed) {
        parsed = readSourceImports(content)
        sourceImports.set(sourcePath, parsed)
      }
      const { imports, unsupported } = parsed
      unsupported.forEach((message) => report("unsupported-import", sourcePath, message))
      if (runtime && sourcePath.startsWith("src/input/specs/")) {
        nativeOwners.add(owner)
        const owners = nativeRuntimeOwners.get(sourcePath) ?? new Set<string>()
        owners.add(owner)
        nativeRuntimeOwners.set(sourcePath, owners)
      }
      for (const item of imports) {
        if (item.specifier.startsWith(".")) {
          try {
            const target = await resolveImport(sourcePath, item.specifier)
            if (target.includes("/__tests__/") || /\.(test|spec)\.[jt]sx?$/.test(target)) {
              report("test-source-import", sourcePath, `Production source imports ${target}`)
              continue
            }
            addEdge({ from: sourcePath, to: target, kind: item.typeOnly ? "type" : "source" })
            await visit(target, owner, runtime && !item.typeOnly)
          } catch (error) {
            report("unresolved-source", sourcePath, String(error))
          }
        } else {
          const packageName = item.specifier.startsWith("@")
            ? item.specifier.split("/").slice(0, 2).join("/")
            : item.specifier.split("/")[0]
          const requiredRange = manifest.dependencies[packageName] ?? manifest.peerDependencies[packageName]
          const dependency = externals.get(item.specifier) ?? {
            packageName,
            specifier: item.specifier,
            requiredRange,
            kind: manifest.dependencies[packageName]
              ? "runtime"
              : manifest.peerDependencies[packageName]
                ? "peer"
                : "undeclared",
            importedBy: [],
          }
          if (!dependency.importedBy.includes(sourcePath)) dependency.importedBy.push(sourcePath)
          externals.set(item.specifier, dependency as TNativeExternalDependency)
          if (!requiredRange)
            report("undeclared-dependency", sourcePath, `Undeclared source dependency: ${item.specifier}`)
        }
      }
    } catch (error) {
      report("unreadable-source", sourcePath, String(error))
    }
  }
  for (const [owner, paths] of Object.entries(entrypoints).sort(([a], [b]) => a.localeCompare(b))) {
    if (!owner || !paths.length)
      report("invalid-entrypoint", owner, "Each component needs a name and at least one source entrypoint")
    for (const sourcePath of [...paths].sort()) await visit(sourcePath, owner, true)
    await addFile("package.json", owner)
  }
  let nativeAdapter: TNativeSourceGraph["nativeAdapter"]
  if (nativeOwners.size) {
    const { findings: nativeFindings, ...adapter } = await inspectNativeAdapter(
      reader,
      manifest.name,
      manifest.codegenConfig,
    )
    findings.push(...nativeFindings)
    nativeAdapter = { ...adapter, owners: [...nativeOwners].sort() }
    adapter.dependencies.forEach(addEdge)
    for (const owner of nativeAdapter.owners) {
      for (const sourcePath of adapter.files) {
        if (sourcePath !== "package.json") addEdge({ from: "package.json", to: sourcePath, kind: "native-build" })
        if (sourcePath.startsWith("src/")) await visit(sourcePath, owner, false)
        else
          try {
            await addFile(sourcePath, owner)
          } catch (error) {
            report("unreadable-native-source", sourcePath, String(error))
          }
      }
    }
  }
  return {
    sourcePackage: manifest.name,
    files: [...files]
      .map(([sourcePath, file]) => ({
        sourcePath,
        contentHash: hashSource(file.content),
        owners: [...file.owners].sort(),
      }))
      .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)),
    edges: [...edges.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    externalDependencies: [...externals.values()]
      .map((item) => ({ ...item, importedBy: item.importedBy.sort() }))
      .sort((a, b) => a.specifier.localeCompare(b.specifier)),
    nativeRuntimeOwners: [...nativeRuntimeOwners]
      .map(([sourcePath, owners]) => ({ sourcePath, owners: [...owners].sort() }))
      .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)),
    nativeAdapter,
    findings: [...new Map(findings.map((item) => [JSON.stringify(item), item])).values()].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
    valid: findings.length === 0,
  }
}
