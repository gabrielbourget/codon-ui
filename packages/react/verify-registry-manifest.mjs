import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, "../..")
const manifestSourcePath = path.join(packageRoot, "src/registry/manifest.ts")
const typesSourcePath = path.join(packageRoot, "src/registry/types.ts")

const fail = (message) => {
  console.error(`[registry-manifest-contract] ${message}`)
  process.exitCode = 1
}

const parseSourceFile = (filePath) =>
  ts.createSourceFile(filePath, readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

const unwrapExpression = (expression) => {
  let currentExpression = expression

  while (
    ts.isSatisfiesExpression(currentExpression) ||
    ts.isAsExpression(currentExpression) ||
    ts.isParenthesizedExpression(currentExpression)
  ) {
    currentExpression = currentExpression.expression
  }

  return currentExpression
}

const readPropertyName = (name) => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text

  return undefined
}

const collectStringConstants = (sourceFile) => {
  const constants = new Map()

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapExpression(node.initializer)

      if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
        constants.set(node.name.text, initializer.text)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return constants
}

const readStringValue = (expression, constants, context) => {
  const unwrappedExpression = unwrapExpression(expression)

  if (ts.isStringLiteral(unwrappedExpression) || ts.isNoSubstitutionTemplateLiteral(unwrappedExpression)) {
    return unwrappedExpression.text
  }

  if (ts.isIdentifier(unwrappedExpression) && constants.has(unwrappedExpression.text)) {
    return constants.get(unwrappedExpression.text)
  }

  fail(`Expected ${context} to be a string literal or known string constant.`)

  return undefined
}

const readObjectProperties = (expression, context) => {
  const unwrappedExpression = unwrapExpression(expression)

  if (!ts.isObjectLiteralExpression(unwrappedExpression)) {
    fail(`Expected ${context} to be an object literal.`)
    return new Map()
  }

  const properties = new Map()

  unwrappedExpression.properties.forEach((property) => {
    if (!ts.isPropertyAssignment(property)) {
      fail(`Expected ${context} to use property assignments only.`)
      return
    }

    const propertyName = readPropertyName(property.name)
    if (!propertyName) {
      fail(`Expected ${context} to use readable property names.`)
      return
    }

    properties.set(propertyName, property.initializer)
  })

  return properties
}

const readArrayExpression = (expression, context) => {
  const unwrappedExpression = unwrapExpression(expression)

  if (!ts.isArrayLiteralExpression(unwrappedExpression)) {
    fail(`Expected ${context} to be an array literal.`)
    return undefined
  }

  return unwrappedExpression
}

const requireProperty = (properties, propertyName, context) => {
  const property = properties.get(propertyName)

  if (!property) {
    fail(`Expected ${context} to define ${propertyName}.`)
  }

  return property
}

const validateRelativePath = ({ basePath, context, mustExist = false, value }) => {
  if (path.isAbsolute(value)) {
    fail(`Expected ${context} to be relative, received ${value}.`)
    return
  }

  if (value.split(/[\\/]/u).includes("..")) {
    fail(`Expected ${context} not to traverse outside its base path, received ${value}.`)
    return
  }

  if (mustExist && !existsSync(path.join(basePath, value))) {
    fail(`Expected ${context} to exist at ${value}.`)
  }
}

const validateStringArray = (expression, constants, context) => {
  const arrayExpression = readArrayExpression(expression, context)
  if (!arrayExpression) return []
  const values = []

  arrayExpression.elements.forEach((element, index) => {
    const value = readStringValue(element, constants, `${context}[${index}]`)

    if (!value) {
      fail(`Expected ${context}[${index}] to be non-empty.`)
      return
    }

    values.push(value)
  })

  return values
}

const validateDependencyMap = (expression, constants, context) => {
  const properties = readObjectProperties(expression, context)

  properties.forEach((valueExpression, dependencyName) => {
    if (!dependencyName) {
      fail(`Expected ${context} dependency names to be non-empty.`)
    }

    const dependencyVersion = readStringValue(valueExpression, constants, `${context}.${dependencyName}`)

    if (!dependencyVersion) {
      fail(`Expected ${context}.${dependencyName} to be non-empty.`)
    }
  })
}

const validateManifestFile = ({ constants, expression, itemName, index, validFileRoles, validTargetRoles }) => {
  const context = `${itemName}.files[${index}]`
  const properties = readObjectProperties(expression, context)
  const sourcePathExpression = requireProperty(properties, "sourcePath", context)
  const targetRoleExpression = requireProperty(properties, "targetRole", context)
  const targetPathExpression = requireProperty(properties, "targetPath", context)
  const roleExpression = requireProperty(properties, "role", context)

  if (!sourcePathExpression || !targetRoleExpression || !targetPathExpression || !roleExpression) return

  const sourcePath = readStringValue(sourcePathExpression, constants, `${context}.sourcePath`)
  const targetRole = readStringValue(targetRoleExpression, constants, `${context}.targetRole`)
  const targetPath = readStringValue(targetPathExpression, constants, `${context}.targetPath`)
  const role = readStringValue(roleExpression, constants, `${context}.role`)

  if (sourcePath) {
    validateRelativePath({ basePath: repoRoot, context: `${context}.sourcePath`, mustExist: true, value: sourcePath })
  }

  if (targetPath) {
    validateRelativePath({ basePath: repoRoot, context: `${context}.targetPath`, value: targetPath })
  }

  if (targetRole && !validTargetRoles.has(targetRole)) {
    fail(`Expected ${context}.targetRole to be one of ${[...validTargetRoles].join(", ")}, received ${targetRole}.`)
  }

  if (role && !validFileRoles.has(role)) {
    fail(`Expected ${context}.role to be one of ${[...validFileRoles].join(", ")}, received ${role}.`)
  }

  if (!targetRole || !targetPath) return undefined

  return { targetPath, targetRole }
}

const validateManifestItem = ({ constants, expression, index, validFileRoles, validItemTypes, validTargetRoles }) => {
  const context = `reactRegistryManifest[${index}]`
  const properties = readObjectProperties(expression, context)
  const nameExpression = requireProperty(properties, "name", context)
  const typeExpression = requireProperty(properties, "type", context)
  const sourcePackageExpression = requireProperty(properties, "sourcePackage", context)
  const filesExpression = requireProperty(properties, "files", context)

  if (!nameExpression || !typeExpression || !sourcePackageExpression || !filesExpression) return

  const name = readStringValue(nameExpression, constants, `${context}.name`)
  const type = readStringValue(typeExpression, constants, `${context}.type`)
  const sourcePackage = readStringValue(sourcePackageExpression, constants, `${context}.sourcePackage`)
  const files = readArrayExpression(filesExpression, `${context}.files`)

  if (!name) {
    fail(`Expected ${context}.name to be non-empty.`)
  }

  if (type && !validItemTypes.has(type)) {
    fail(`Expected ${context}.type to be one of ${[...validItemTypes].join(", ")}, received ${type}.`)
  }

  if (sourcePackage !== "@amino-ui/react") {
    fail(`Expected ${context}.sourcePackage to be @amino-ui/react, received ${sourcePackage}.`)
  }

  if (!files || files.elements.length === 0) {
    fail(`Expected ${context}.files to include at least one explicit file.`)
  }

  const fileTargets = []

  files?.elements.forEach((fileExpression, fileIndex) => {
    const fileTarget = validateManifestFile({
      constants,
      expression: fileExpression,
      itemName: context,
      index: fileIndex,
      validFileRoles,
      validTargetRoles,
    })

    if (fileTarget) fileTargets.push(fileTarget)
  })

  const registryDependencies = properties.get("registryDependencies")
  const registryDependencyNames = registryDependencies
    ? validateStringArray(registryDependencies, constants, `${context}.registryDependencies`)
    : []
  ;["peerDependencies", "runtimeDependencies", "devDependencies"].forEach((dependencyFieldName) => {
    const dependencies = properties.get(dependencyFieldName)
    if (dependencies) validateDependencyMap(dependencies, constants, `${context}.${dependencyFieldName}`)
  })

  if (!name) return undefined

  return {
    fileTargets,
    name,
    registryDependencies: registryDependencyNames,
  }
}

const validateManifestGraph = (manifestItems) => {
  const itemNames = new Set()

  manifestItems.forEach((item) => {
    if (itemNames.has(item.name)) {
      fail(`Expected registry item "${item.name}" to be defined once.`)
      return
    }

    itemNames.add(item.name)
  })

  manifestItems.forEach((item) => {
    item.registryDependencies.forEach((dependencyName) => {
      if (!itemNames.has(dependencyName)) {
        fail(`Expected registry item "${item.name}" dependency "${dependencyName}" to be defined in the manifest.`)
      }
    })
  })

  const itemByName = new Map(manifestItems.map((item) => [item.name, item]))
  const visitedItemNames = new Set()
  const visitingItemNames = new Set()
  const registryDependencyPath = []

  const visitItem = (itemName) => {
    if (visitedItemNames.has(itemName)) return

    const item = itemByName.get(itemName)
    if (!item) return

    if (visitingItemNames.has(itemName)) {
      const cycleStartIndex = registryDependencyPath.indexOf(itemName)
      const cyclePath = [...registryDependencyPath.slice(Math.max(cycleStartIndex, 0)), itemName]

      fail(`Expected registry dependencies not to cycle, received ${cyclePath.join(" -> ")}.`)
      return
    }

    visitingItemNames.add(itemName)
    registryDependencyPath.push(itemName)

    item.registryDependencies.forEach(visitItem)

    registryDependencyPath.pop()
    visitingItemNames.delete(itemName)
    visitedItemNames.add(itemName)
  }

  manifestItems.forEach((item) => visitItem(item.name))

  const fileTargetsByKey = new Map()

  manifestItems.forEach((item) => {
    item.fileTargets.forEach((fileTarget) => {
      const targetKey = `${fileTarget.targetRole}:${fileTarget.targetPath}`
      const existingItemName = fileTargetsByKey.get(targetKey)

      if (existingItemName) {
        fail(`Expected registry target ${targetKey} to be owned once, received ${existingItemName} and ${item.name}.`)
        return
      }

      fileTargetsByKey.set(targetKey, item.name)
    })
  })
}

const manifestSourceFile = parseSourceFile(manifestSourcePath)
const typeSourceFile = parseSourceFile(typesSourcePath)
const constants = collectStringConstants(typeSourceFile)
const validItemTypes = new Set(["component", "support", "style", "theme", "asset", "test"])
const validFileRoles = new Set(["source", "style", "test", "theme", "support", "asset"])
const validTargetRoles = new Set(["components", "tokens", "utils", "types", "theme", "assets"])

let manifestExpression

const visitManifest = (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "reactRegistryManifest") {
    manifestExpression = node.initializer
  }

  ts.forEachChild(node, visitManifest)
}

visitManifest(manifestSourceFile)

if (!manifestExpression) {
  fail("Expected src/registry/manifest.ts to export reactRegistryManifest.")
} else {
  const manifest = readArrayExpression(manifestExpression, "reactRegistryManifest")
  const manifestItems = []

  manifest?.elements.forEach((itemExpression, index) => {
    const manifestItem = validateManifestItem({
      constants,
      expression: itemExpression,
      index,
      validFileRoles,
      validItemTypes,
      validTargetRoles,
    })

    if (manifestItem) manifestItems.push(manifestItem)
  })

  validateManifestGraph(manifestItems)
}

if (process.exitCode) {
  process.exit()
}

console.log("[registry-manifest-contract] reactRegistryManifest contract passed.")
