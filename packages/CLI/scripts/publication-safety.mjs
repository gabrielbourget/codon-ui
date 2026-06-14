import { readFileSync } from "node:fs"

const REQUIRED_PACKAGE_NAME = "@codon-ui/cli"
const REQUIRED_PACKAGE_VERSION = "0.1.3"
const REQUIRED_PREPUBLISH_ONLY_SCRIPT = "pnpm pack:check && pnpm release:check"
const REQUIRED_PUBLISH_ACCESS = "restricted"

const packageJsonUrl = new URL("../package.json", import.meta.url)
const getPackageInfoSourceUrl = new URL("../src/helpers/getPackageInfo.ts", import.meta.url)
const consumerContractConstantsSourceUrl = new URL("../src/helpers/consumerContract/constants.ts", import.meta.url)
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"))
const getPackageInfoSource = readFileSync(getPackageInfoSourceUrl, "utf8")
const consumerContractConstantsSource = readFileSync(consumerContractConstantsSourceUrl, "utf8")
const scripts = packageJson.scripts ?? {}

const printFailure = (message, details = []) => {
  console.error(message)

  details.forEach((detail) => {
    console.error(`- ${detail}`)
  })
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const hasExportedStringConstant = (source, constantName, expectedValue) =>
  new RegExp(`export\\s+const\\s+${constantName}\\s*=\\s*["']${escapeRegExp(expectedValue)}["']`, "u").test(source)

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
    unsafeFindings.push(`package version must be ${REQUIRED_PACKAGE_VERSION} for this private CLI release.`)
  }

  if (!hasExportedStringConstant(getPackageInfoSource, "CODON_UI_CLI_PACKAGE_INFO_NAME", REQUIRED_PACKAGE_NAME)) {
    unsafeFindings.push(`CLI package metadata name must be ${REQUIRED_PACKAGE_NAME}.`)
  }

  if (!hasExportedStringConstant(getPackageInfoSource, "CODON_UI_CLI_PACKAGE_INFO_VERSION", REQUIRED_PACKAGE_VERSION)) {
    unsafeFindings.push(`CLI package metadata version must be ${REQUIRED_PACKAGE_VERSION}.`)
  }

  if (
    !hasExportedStringConstant(
      consumerContractConstantsSource,
      "CODON_UI_CLI_SHORTCUT_DEFAULT_DEV_DEPENDENCY_RANGE",
      REQUIRED_PACKAGE_VERSION,
    )
  ) {
    unsafeFindings.push(`init --setup-cli default package range must be ${REQUIRED_PACKAGE_VERSION}.`)
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
