import type { TTransform } from "@/src/helpers/transformers"

export const transformImports: TTransform = async ({ sourceFile, config }) => {
  const importDeclarations = sourceFile.getImportDeclarations()

  for (const importDeclaration of importDeclarations) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue()

    if (moduleSpecifier.startsWith("@/registry/components")) {
      importDeclaration.setModuleSpecifier(
        moduleSpecifier.replace(/^@\/registry\/components\/[^/]+/, config.aliases.components),
      )
    }

    if (moduleSpecifier === "@/utils") {
      importDeclaration.setModuleSpecifier(moduleSpecifier.replace(/^@\/utils/, config.aliases.utils))
    }

    if (moduleSpecifier === "@/types") {
      importDeclaration.setModuleSpecifier(moduleSpecifier.replace(/^@\/types/, config.aliases.types))
    }

    if (moduleSpecifier === "@/constants") {
      importDeclaration.setModuleSpecifier(moduleSpecifier.replace(/^@\/constants/, config.aliases.constants))
    }
  }

  return sourceFile
}
