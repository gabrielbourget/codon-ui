import { createHash } from "node:crypto"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import path from "node:path"

import { parse } from "@babel/parser"
import { ts } from "ts-morph"

export type TSourceFinding = { code: string; sourcePath: string; message: string }
export type TSourceImport = { specifier: string; typeOnly: boolean }
export type TSourceNode = Record<string, unknown>

export const visitSource = (value: unknown, visitor: (node: TSourceNode) => void): void => {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((child) => visitSource(child, visitor))
    return
  }
  const node = value as TSourceNode
  if (typeof node.type === "string") visitor(node)
  for (const [key, child] of Object.entries(node)) {
    if (!["loc", "comments", "tokens"].includes(key)) visitSource(child, visitor)
  }
}

export const parseSource = (content: string) =>
  parse(content, { sourceType: "unambiguous", plugins: ["typescript", "jsx"], createImportExpressions: true })

export const stringLiteral = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined
  const node = value as TSourceNode
  return node.type === "StringLiteral" && typeof node.value === "string" ? node.value : undefined
}

export const readSourceImports = (content: string) => {
  const references = ts.preProcessFile(content, false, true).referencedFiles
  const imports: TSourceImport[] = references.map(({ fileName }) => ({
    specifier: fileName.startsWith(".") || path.posix.isAbsolute(fileName) ? fileName : `./${fileName}`,
    typeOnly: true,
  }))
  const unsupported: string[] = references
    .filter(({ fileName }) => path.posix.isAbsolute(fileName))
    .map(() => "Absolute type reference")
  visitSource(parseSource(content), (node) => {
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(String(node.type))) {
      const specifier = stringLiteral(node.source)
      const specifiers = node.specifiers as TSourceNode[] | undefined
      if (specifier)
        imports.push({
          specifier,
          typeOnly:
            node.importKind === "type" ||
            node.exportKind === "type" ||
            Boolean(
              specifiers?.length &&
              specifiers.every((item) => item.importKind === "type" || item.exportKind === "type"),
            ),
        })
    }
    if (node.type === "TSImportType" || node.type === "ImportExpression") {
      const specifier = stringLiteral(node.argument ?? node.source)
      if (specifier) imports.push({ specifier, typeOnly: node.type === "TSImportType" })
      else unsupported.push("Nonliteral import")
    }
    if (node.type === "CallExpression") {
      const callee = node.callee as TSourceNode
      if (callee.type !== "Identifier" || callee.name !== "require") return
      const specifier = stringLiteral((node.arguments as unknown[])[0])
      if (specifier) imports.push({ specifier, typeOnly: false })
      else unsupported.push("Nonliteral require")
    }
    if (node.type === "TSImportEqualsDeclaration") {
      const reference = node.moduleReference as TSourceNode
      const specifier = stringLiteral(reference.expression)
      if (specifier) imports.push({ specifier, typeOnly: node.importKind === "type" })
    }
  })
  return { imports, unsupported }
}

export const hashSource = (content: Uint8Array) => createHash("sha256").update(content).digest("hex")
export const stripSourceComments = (content: string, hashComments = false) =>
  content.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*/g, (token) =>
    token.startsWith("//") || token.startsWith("/*") || (hashComments && token.startsWith("#"))
      ? token.replace(/[^\n]/g, " ")
      : token,
  )
export const createSourceReader = async (sourceRoot: string) => {
  const root = await realpath(sourceRoot)
  const resolve = async (sourcePath: string) => {
    if (!sourcePath || path.isAbsolute(sourcePath) || sourcePath.includes("\\"))
      throw new Error(`Invalid relative source path: ${sourcePath}`)
    const absolute = path.resolve(root, sourcePath)
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error(`Source path escapes package: ${sourcePath}`)
    // Reject every symlink segment, including links that currently resolve inside the package.
    let current = root
    for (const segment of path.relative(root, absolute).split(path.sep)) {
      current = path.join(current, segment)
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink source is unsupported: ${sourcePath}`)
    }
    return absolute
  }
  const read = async (sourcePath: string) => readFile(await resolve(sourcePath))
  const list = async (directory: string): Promise<string[]> => {
    const entries = await readdir(await resolve(directory), { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (["build", "node_modules", "__tests__", ".DS_Store"].includes(entry.name)) continue
      const sourcePath = `${directory}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error(`Symlink source is unsupported: ${sourcePath}`)
      if (entry.isDirectory()) files.push(...(await list(sourcePath)))
      else if (entry.isFile()) files.push(sourcePath)
    }
    return files
  }
  const isFile = async (sourcePath: string) => {
    try {
      return (await lstat(await resolve(sourcePath))).isFile()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR")
        return false
      throw error
    }
  }
  const references = async (directory: string) =>
    (await readdir(await resolve(directory), { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isFile() &&
          /^(?:LICENSE|NOTICE|COPYING)(?:\.|$)|(?:^|_)UPSTREAM\.json$|\.UPSTREAM\.json$/.test(entry.name),
      )
      .map((entry) => `${directory}/${entry.name}`)
      .sort()
  return { read, list, isFile, references }
}

export type TSourceReader = Awaited<ReturnType<typeof createSourceReader>>
