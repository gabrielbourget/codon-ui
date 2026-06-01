import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { localRegistrySourceSchema, type TLocalRegistrySource } from "./schema"

export type TLocalRegistryReadResult = {
  registrySource: TLocalRegistrySource
  registrySourcePath: string
  sourceRoot: string
}

export const getDefaultLocalRegistrySourcePath = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(moduleDirectory, "../registry/local-react-support.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-react-support.registry.json"),
  ]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const readLocalRegistrySource = async (
  registrySourcePath = getDefaultLocalRegistrySourcePath(),
): Promise<TLocalRegistryReadResult> => {
  const resolvedRegistrySourcePath = path.resolve(registrySourcePath)

  if (!existsSync(resolvedRegistrySourcePath)) {
    throw new Error(`Local registry source not found at ${resolvedRegistrySourcePath}.`)
  }

  const registrySource = localRegistrySourceSchema.parse(JSON.parse(await readFile(resolvedRegistrySourcePath, "utf8")))
  const sourceRoot = path.resolve(path.dirname(resolvedRegistrySourcePath), registrySource.sourceRoot ?? ".")

  return {
    registrySource,
    registrySourcePath: resolvedRegistrySourcePath,
    sourceRoot,
  }
}
