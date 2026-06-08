import { existsSync, readFileSync } from "fs"
import path from "path"

import {
  INSTALL_PLAN_DEPENDENCY_KIND__DEV,
  INSTALL_PLAN_DEPENDENCY_KIND__PEER,
  INSTALL_PLAN_DEPENDENCY_KIND__RUNTIME,
  INSTALL_PLAN_DEPENDENCY_STATUS__INCOMPATIBLE,
  INSTALL_PLAN_DEPENDENCY_STATUS__MISSING,
  INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED,
  INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED,
  INSTALL_PLAN_FINDING__DEPENDENCY_INCOMPATIBLE,
  INSTALL_PLAN_FINDING__DEPENDENCY_MISSING,
  INSTALL_PLAN_FINDING__UNRESOLVED_DEPENDENCY_VERSION,
  INSTALL_PLAN_FINDING_SEVERITY__WARNING,
} from "./constants"
import {
  dependencyMapSchema,
  installPlanDependencySchema,
  type TInstallPlanDependencies,
  type TInstallPlanDependency,
  type TInstallPlanDependencyKind,
  type TInstallPlanDependencyStatus,
  type TInstallPlanFinding,
} from "./schema"

type TPackageDependencySection = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies"

type TDeclaredDependency = {
  declaredIn: TPackageDependencySection
  declaredRange: string
}

type TParsedVersion = {
  major: number
  minor: number
  patch: number
}

type TRangeBoundary = {
  inclusive: boolean
  version: TParsedVersion
}

type TRangeInterval = {
  max?: TRangeBoundary
  min?: TRangeBoundary
}

const PACKAGE_DEPENDENCY_SECTIONS: readonly TPackageDependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]

const UNRESOLVED_REQUIRED_RANGE = "TO_DECIDE"

export const createDependencyOwnerKey = (dependency: Pick<TInstallPlanDependency, "kind" | "name">) =>
  `${dependency.kind}:${dependency.name}`

const compareVersions = (leftVersion: TParsedVersion, rightVersion: TParsedVersion) => {
  if (leftVersion.major !== rightVersion.major) return leftVersion.major - rightVersion.major
  if (leftVersion.minor !== rightVersion.minor) return leftVersion.minor - rightVersion.minor

  return leftVersion.patch - rightVersion.patch
}

const parseVersion = (value: string): TParsedVersion | undefined => {
  const match = value.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/u)

  if (!match) return undefined

  return {
    major: Number.parseInt(match[1] ?? "0", 10),
    minor: Number.parseInt(match[2] ?? "0", 10),
    patch: Number.parseInt(match[3] ?? "0", 10),
  }
}

const createExclusiveUpperVersionForCaret = (version: TParsedVersion): TParsedVersion => {
  if (version.major > 0) {
    return {
      major: version.major + 1,
      minor: 0,
      patch: 0,
    }
  }

  if (version.minor > 0) {
    return {
      major: 0,
      minor: version.minor + 1,
      patch: 0,
    }
  }

  return {
    major: 0,
    minor: 0,
    patch: version.patch + 1,
  }
}

const createExclusiveUpperVersionForTilde = (version: TParsedVersion): TParsedVersion => ({
  major: version.major,
  minor: version.minor + 1,
  patch: 0,
})

const chooseGreaterMinimum = (
  leftBoundary: TRangeBoundary | undefined,
  rightBoundary: TRangeBoundary | undefined,
): TRangeBoundary | undefined => {
  if (!leftBoundary) return rightBoundary
  if (!rightBoundary) return leftBoundary

  const comparison = compareVersions(leftBoundary.version, rightBoundary.version)

  if (comparison > 0) return leftBoundary
  if (comparison < 0) return rightBoundary

  return {
    inclusive: leftBoundary.inclusive && rightBoundary.inclusive,
    version: leftBoundary.version,
  }
}

const chooseLesserMaximum = (
  leftBoundary: TRangeBoundary | undefined,
  rightBoundary: TRangeBoundary | undefined,
): TRangeBoundary | undefined => {
  if (!leftBoundary) return rightBoundary
  if (!rightBoundary) return leftBoundary

  const comparison = compareVersions(leftBoundary.version, rightBoundary.version)

  if (comparison < 0) return leftBoundary
  if (comparison > 0) return rightBoundary

  return {
    inclusive: leftBoundary.inclusive && rightBoundary.inclusive,
    version: leftBoundary.version,
  }
}

const intersectIntervals = (
  leftInterval: TRangeInterval,
  rightInterval: TRangeInterval,
): TRangeInterval | undefined => {
  const min = chooseGreaterMinimum(leftInterval.min, rightInterval.min)
  const max = chooseLesserMaximum(leftInterval.max, rightInterval.max)

  if (min && max) {
    const comparison = compareVersions(min.version, max.version)

    if (comparison > 0) return undefined
    if (comparison === 0 && (!min.inclusive || !max.inclusive)) return undefined
  }

  return { max, min }
}

const createComparatorInterval = (rangeToken: string): TRangeInterval | undefined => {
  if (rangeToken === "*") return {}

  if (rangeToken.includes("*") || rangeToken.toLowerCase().includes("x")) return undefined

  const comparatorMatch = rangeToken.match(/^(>=|>|<=|<)(.+)$/u)

  if (comparatorMatch) {
    const version = parseVersion(comparatorMatch[2] ?? "")

    if (!version) return undefined

    switch (comparatorMatch[1]) {
      case ">":
        return {
          min: {
            inclusive: false,
            version,
          },
        }
      case ">=":
        return {
          min: {
            inclusive: true,
            version,
          },
        }
      case "<":
        return {
          max: {
            inclusive: false,
            version,
          },
        }
      case "<=":
        return {
          max: {
            inclusive: true,
            version,
          },
        }
      default:
        return undefined
    }
  }

  if (rangeToken.startsWith("^")) {
    const version = parseVersion(rangeToken.slice(1))

    if (!version) return undefined

    return {
      max: {
        inclusive: false,
        version: createExclusiveUpperVersionForCaret(version),
      },
      min: {
        inclusive: true,
        version,
      },
    }
  }

  if (rangeToken.startsWith("~")) {
    const version = parseVersion(rangeToken.slice(1))

    if (!version) return undefined

    return {
      max: {
        inclusive: false,
        version: createExclusiveUpperVersionForTilde(version),
      },
      min: {
        inclusive: true,
        version,
      },
    }
  }

  const exactVersion = parseVersion(rangeToken)

  if (!exactVersion) return undefined

  return {
    max: {
      inclusive: true,
      version: exactVersion,
    },
    min: {
      inclusive: true,
      version: exactVersion,
    },
  }
}

const createRangeIntervals = (range: string): readonly TRangeInterval[] | undefined => {
  if (range === UNRESOLVED_REQUIRED_RANGE) return undefined
  if (range.startsWith("workspace:") || range.startsWith("file:") || range.startsWith("link:")) return undefined

  const unionIntervals: TRangeInterval[] = []

  for (const rangePart of range.split("||")) {
    const comparatorTokens = rangePart.trim().split(/\s+/u).filter(Boolean)

    if (comparatorTokens.length === 0) return undefined

    let interval: TRangeInterval = {}

    for (const comparatorToken of comparatorTokens) {
      const comparatorInterval = createComparatorInterval(comparatorToken)

      if (!comparatorInterval) return undefined

      const intersection = intersectIntervals(interval, comparatorInterval)

      if (!intersection) return undefined

      interval = intersection
    }

    unionIntervals.push(interval)
  }

  return unionIntervals
}

const rangeIntervalsOverlap = (leftIntervals: readonly TRangeInterval[], rightIntervals: readonly TRangeInterval[]) =>
  leftIntervals.some((leftInterval) =>
    rightIntervals.some((rightInterval) => Boolean(intersectIntervals(leftInterval, rightInterval))),
  )

const readTargetDependencyDeclarations = ({
  consumerRoot,
  dependencyPackageJsonPath,
}: {
  consumerRoot?: string
  dependencyPackageJsonPath?: string
}) => {
  const packageJsonPath =
    dependencyPackageJsonPath ?? (consumerRoot ? path.resolve(consumerRoot, "package.json") : undefined)
  const declarations = new Map<string, TDeclaredDependency>()

  if (!packageJsonPath || !existsSync(packageJsonPath)) return declarations

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>

  PACKAGE_DEPENDENCY_SECTIONS.forEach((dependencySection) => {
    const dependencies = dependencyMapSchema.catch({}).parse(packageJson[dependencySection])

    Object.entries(dependencies).forEach(([dependencyName, dependencyRange]) => {
      if (declarations.has(dependencyName)) return

      declarations.set(dependencyName, {
        declaredIn: dependencySection,
        declaredRange: dependencyRange,
      })
    })
  })

  return declarations
}

const resolveDependencyStatus = ({
  declaredRange,
  requiredRange,
}: {
  declaredRange?: string
  requiredRange: string
}): TInstallPlanDependencyStatus => {
  const requiredIntervals = createRangeIntervals(requiredRange)

  if (!requiredIntervals) return INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED
  if (!declaredRange) return INSTALL_PLAN_DEPENDENCY_STATUS__MISSING

  const declaredIntervals = createRangeIntervals(declaredRange)

  if (!declaredIntervals) return INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED

  return rangeIntervalsOverlap(requiredIntervals, declaredIntervals)
    ? INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED
    : INSTALL_PLAN_DEPENDENCY_STATUS__INCOMPATIBLE
}

const createDependencyPlanEntries = ({
  dependencies,
  kind,
  targetDeclarations,
}: {
  dependencies: Record<string, string>
  kind: TInstallPlanDependencyKind
  targetDeclarations: ReadonlyMap<string, TDeclaredDependency>
}) =>
  Object.entries(dependencies)
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([dependencyName, requiredRange]) => {
      const declaration = targetDeclarations.get(dependencyName)

      return installPlanDependencySchema.parse({
        declaredIn: declaration?.declaredIn,
        declaredRange: declaration?.declaredRange,
        kind,
        name: dependencyName,
        requiredRange,
        status: resolveDependencyStatus({
          declaredRange: declaration?.declaredRange,
          requiredRange,
        }),
      })
    })

const formatDependencyKind = (kind: TInstallPlanDependencyKind) => `${kind} dependency`

const createDependencyFinding = ({
  dependency,
  dependencyOwners,
}: {
  dependency: TInstallPlanDependency
  dependencyOwners: ReadonlyMap<string, string>
}): TInstallPlanFinding | undefined => {
  const itemName = dependencyOwners.get(createDependencyOwnerKey(dependency))

  if (dependency.status === INSTALL_PLAN_DEPENDENCY_STATUS__MISSING) {
    return {
      code: INSTALL_PLAN_FINDING__DEPENDENCY_MISSING,
      itemName,
      message: `Dependency "${dependency.name}" is required as a ${formatDependencyKind(
        dependency.kind,
      )} but is not declared in package.json.`,
      severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
    }
  }

  if (dependency.status === INSTALL_PLAN_DEPENDENCY_STATUS__INCOMPATIBLE) {
    return {
      code: INSTALL_PLAN_FINDING__DEPENDENCY_INCOMPATIBLE,
      itemName,
      message: `Dependency "${dependency.name}" declares range "${dependency.declaredRange}" in ${dependency.declaredIn}, which does not overlap required ${formatDependencyKind(
        dependency.kind,
      )} range "${dependency.requiredRange}".`,
      severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
    }
  }

  if (dependency.status === INSTALL_PLAN_DEPENDENCY_STATUS__UNRESOLVED) {
    return {
      code: INSTALL_PLAN_FINDING__UNRESOLVED_DEPENDENCY_VERSION,
      itemName,
      message: `Dependency "${dependency.name}" has unresolved ${formatDependencyKind(
        dependency.kind,
      )} range "${dependency.requiredRange}".`,
      severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
    }
  }

  return undefined
}

export const createInstallPlanDependencyInspection = ({
  consumerRoot,
  dependencies,
  dependencyOwners = new Map<string, string>(),
  dependencyPackageJsonPath,
}: {
  consumerRoot?: string
  dependencies: TInstallPlanDependencies
  dependencyOwners?: ReadonlyMap<string, string>
  dependencyPackageJsonPath?: string
}): {
  dependencyPlan: readonly TInstallPlanDependency[]
  findings: readonly TInstallPlanFinding[]
} => {
  const targetDeclarations = readTargetDependencyDeclarations({
    consumerRoot,
    dependencyPackageJsonPath,
  })
  const dependencyPlan = [
    ...createDependencyPlanEntries({
      dependencies: dependencies.peerDependencies,
      kind: INSTALL_PLAN_DEPENDENCY_KIND__PEER,
      targetDeclarations,
    }),
    ...createDependencyPlanEntries({
      dependencies: dependencies.runtimeDependencies,
      kind: INSTALL_PLAN_DEPENDENCY_KIND__RUNTIME,
      targetDeclarations,
    }),
    ...createDependencyPlanEntries({
      dependencies: dependencies.devDependencies,
      kind: INSTALL_PLAN_DEPENDENCY_KIND__DEV,
      targetDeclarations,
    }),
  ]

  return {
    dependencyPlan,
    findings: dependencyPlan.flatMap((dependency) => {
      const finding = createDependencyFinding({
        dependency,
        dependencyOwners,
      })

      return finding ? [finding] : []
    }),
  }
}
