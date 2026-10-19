// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
export function formatErrorMessage(message: string, errorCode?: string) {
  return errorCode
    ? `${message}. For more information and steps for solving, visit https://motion.dev/troubleshooting/${errorCode}`
    : message
}
