import { readFileSync } from "node:fs"

const REQUIRED_PACKAGE_NAME = "@codon-ui/cli"
const REQUIRED_PACKAGE_VERSION = "0.1.0"
const REQUIRED_PREPUBLISH_ONLY_SCRIPT = "pnpm pack:check && pnpm release:check"
const REQUIRED_PUBLISH_ACCESS = "restricted"

const packageJsonUrl = new URL("../package.json", import.meta.url)
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"))
const scripts = packageJson.scripts ?? {}

const printFailure = (message, details = []) => {
  console.error(message)

  details.forEach((detail) => {
    console.error(`- ${detail}`)
  })
}

const verifyPublicationSafety = () => {
  const unsafeFindings = []

  Object.entries(scripts).forEach(([scriptName, scriptCommand]) => {
    if (scriptName.startsWith("pub:")) {
      unsafeFindings.push(`${scriptName} uses the retired pub:* release namespace.`)
    }

    if (/\bnpm\s+publish\b/u.test(scriptCommand)) {
      unsafeFindings.push(`${scriptName} runs npm publish.`)
    }

    if (/\bpnpm\s+publish\b/u.test(scriptCommand)) {
      unsafeFindings.push(`${scriptName} runs pnpm publish.`)
    }

    if (/\byarn\s+npm\s+publish\b/u.test(scriptCommand)) {
      unsafeFindings.push(`${scriptName} runs yarn npm publish.`)
    }

    if (/--access\s+public\b/u.test(scriptCommand)) {
      unsafeFindings.push(`${scriptName} includes --access public.`)
    }
  })

  if (packageJson.publishConfig?.access === "public") {
    unsafeFindings.push("publishConfig.access is public.")
  }

  if (packageJson.name !== REQUIRED_PACKAGE_NAME) {
    unsafeFindings.push(`package name must be ${REQUIRED_PACKAGE_NAME}.`)
  }

  if (packageJson.version !== REQUIRED_PACKAGE_VERSION) {
    unsafeFindings.push(`package version must be ${REQUIRED_PACKAGE_VERSION} for the first private CLI proof.`)
  }

  if (packageJson.private === true) {
    unsafeFindings.push("package private flag must not be true when publishing the CLI package.")
  }

  if (packageJson.publishConfig?.access !== REQUIRED_PUBLISH_ACCESS) {
    unsafeFindings.push(`publishConfig.access must be ${REQUIRED_PUBLISH_ACCESS}.`)
  }

  if (JSON.stringify(packageJson.files) !== JSON.stringify(["dist"])) {
    unsafeFindings.push('package files must be exactly ["dist"].')
  }

  if (scripts.prepublishOnly !== REQUIRED_PREPUBLISH_ONLY_SCRIPT) {
    unsafeFindings.push(`prepublishOnly must be "${REQUIRED_PREPUBLISH_ONLY_SCRIPT}".`)
  }

  if (unsafeFindings.length > 0) {
    printFailure("Publication safety check failed.", unsafeFindings)
    process.exit(1)
  }

  console.log("Publication safety check passed.")
}

const command = process.argv[2] ?? "verify"

if (command === "verify") {
  verifyPublicationSafety()
} else {
  printFailure(`Unknown publication safety command: ${command}`)
  process.exit(1)
}
