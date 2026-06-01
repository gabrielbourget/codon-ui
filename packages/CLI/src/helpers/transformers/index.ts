import { promises as fs } from "fs"
import { tmpdir } from "os"
import path from "path"

import { Project, ScriptKind, type SourceFile } from "ts-morph"

import type { TConfig } from "@/src/helpers/config/schema"
import { transformImports } from "@/src/helpers/transformers/transformImports"
import { transformRSC } from "@/src/helpers/transformers/transformRSC"
import { transformToJS } from "@/src/helpers/transformers/transformToJSOrJSX"

export type TTransformOptions = {
  filename: string
  raw: string
  config: TConfig
}

export type TTransform<Output = SourceFile> = (opts: TTransformOptions & { sourceFile: SourceFile }) => Promise<Output>

const transformers: TTransform[] = [transformImports, transformRSC]

const project = new Project({ compilerOptions: {} })

const createTempSourceFile = async (fileName: string) => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "amino-ui-"))
  return path.join(directory, fileName)
}

export const transform = async (options: TTransformOptions) => {
  const fileNameComponents = options.filename.split(".")
  const extension = fileNameComponents[fileNameComponents.length - 1]

  const tempFile = await createTempSourceFile(options.filename)
  const sourceFile = project.createSourceFile(tempFile, options.raw, {
    scriptKind: extension === "tsx" ? ScriptKind.TSX : ScriptKind.TS,
  })

  for (const transformer of transformers) {
    transformer({ sourceFile, ...options })
  }

  if (options.config.tsx) return sourceFile.getFullText()

  return await transformToJS({ sourceFile, ...options })
}
