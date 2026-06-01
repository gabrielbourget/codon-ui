export const PACKAGE_MANAGER_NPM = "npm"
export const PACKAGE_MANAGER_PNPM = "pnpm"
export const PACKAGE_MANAGER_YARN = "yarn"
export const PACKAGE_MANAGER_BUN = "bun"

export const ADD_COMMAND__NPM = "i"
export const ADD_COMMAND__PNPM = "add"
export const ADD_COMMAND__YARN = "add"
export const ADD_COMMAND__BUN = "add"

export const DEV_DEPENDENCY_FLAG__NPM = "-D"
export const DEV_DEPENDENCY_FLAG__PNPM = "-D"
export const DEV_DEPENDENCY_FLAG__YARN = "--dev"
export const DEV_DEPENDENCY_FLAG__BUN = "-d"

export const computePackageManagerAddCommand = (packageManager: string) => {
  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return ADD_COMMAND__NPM
    case PACKAGE_MANAGER_PNPM:
      return ADD_COMMAND__PNPM
    case PACKAGE_MANAGER_YARN:
      return ADD_COMMAND__YARN
    case PACKAGE_MANAGER_BUN:
      return ADD_COMMAND__BUN
    default:
      return ADD_COMMAND__NPM
  }
}

export const computePackageManagerDevDependencyFlag = (packageManager: string) => {
  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return DEV_DEPENDENCY_FLAG__NPM
    case PACKAGE_MANAGER_PNPM:
      return DEV_DEPENDENCY_FLAG__PNPM
    case PACKAGE_MANAGER_YARN:
      return DEV_DEPENDENCY_FLAG__YARN
    case PACKAGE_MANAGER_BUN:
      return DEV_DEPENDENCY_FLAG__BUN
    default:
      return DEV_DEPENDENCY_FLAG__NPM
  }
}
