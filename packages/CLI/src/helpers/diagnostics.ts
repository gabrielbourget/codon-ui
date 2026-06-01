import { logger } from "@/src/helpers/logger"

export const DIAGNOSTIC_LEVEL__INFO = "info"
export const DIAGNOSTIC_LEVEL__WARNING = "warning"
export const DIAGNOSTIC_LEVEL__ERROR = "error"

export const DIAGNOSTIC_LEVELS = [DIAGNOSTIC_LEVEL__INFO, DIAGNOSTIC_LEVEL__WARNING, DIAGNOSTIC_LEVEL__ERROR] as const

export type TDiagnosticLevel = (typeof DIAGNOSTIC_LEVELS)[number]

export type TDiagnostic = {
  level: TDiagnosticLevel
  message: string
}

export const createInfoDiagnostic = (message: string): TDiagnostic => ({
  level: DIAGNOSTIC_LEVEL__INFO,
  message,
})

export const createWarningDiagnostic = (message: string): TDiagnostic => ({
  level: DIAGNOSTIC_LEVEL__WARNING,
  message,
})

export const createErrorDiagnostic = (message: string): TDiagnostic => ({
  level: DIAGNOSTIC_LEVEL__ERROR,
  message,
})

export const formatUnknownError = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

export const printDiagnostic = (diagnostic: TDiagnostic): void => {
  switch (diagnostic.level) {
    case DIAGNOSTIC_LEVEL__INFO:
      logger.info(`[info] ${diagnostic.message}`)
      return
    case DIAGNOSTIC_LEVEL__WARNING:
      logger.warn(`[warning] ${diagnostic.message}`)
      return
    case DIAGNOSTIC_LEVEL__ERROR:
      logger.error(`[error] ${diagnostic.message}`)
      return
  }
}

export const printDiagnostics = (diagnostics: TDiagnostic[]): void => {
  for (const diagnostic of diagnostics) printDiagnostic(diagnostic)
}
