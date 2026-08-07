import { readFileSync } from "node:fs"

const REQUIRED_PACKAGE_NAME = "@codon-ui/cli"
const REQUIRED_PACKAGE_VERSION = "0.2.1"
const REQUIRED_PACKAGE_REPOSITORY_URL = "git+https://github.com/gabrielbourget/codon-ui.git"
const REQUIRED_PACKAGE_REPOSITORY_DIRECTORY = "packages/CLI"
const REQUIRED_PREPUBLISH_ONLY_SCRIPT = "pnpm pack:check && pnpm release:check"
const REQUIRED_PUBLISH_ACCESS = "restricted"
const REQUIRED_PUBLISH_REGISTRY = "https://registry.npmjs.org"
const REQUIRED_RELEASE_ENVIRONMENT = "npm-release"
const REQUIRED_RELEASE_WORKFLOW_FILE = "publish-cli.yml"

const packageJsonUrl = new URL("../package.json", import.meta.url)
const releaseWorkflowUrl = new URL(`../../../.github/workflows/${REQUIRED_RELEASE_WORKFLOW_FILE}`, import.meta.url)
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

const assertReleaseWorkflowContract = (source) => {
  const requiredSnippets = [
    "workflow_dispatch:",
    "group: publish-codon-ui-cli",
    "cancel-in-progress: false",
    "github.ref == 'refs/heads/develop'",
    "inputs.confirmation == format('publish {0}', inputs.version)",
    `environment: ${REQUIRED_RELEASE_ENVIRONMENT}`,
    "contents: read",
    "id-token: write",
    "runs-on: ubuntu-latest",
    'node-version: "24.15.0"',
    "package-manager-cache: false",
    'test "$(node --version)" = "v24.15.0"',
    'test "$(npm --version)" = "11.12.1"',
    "persist-credentials: false",
    "NPM_RELEASE_EXPECTED_VERSION: ${{ inputs.version }}",
    "node packages/CLI/scripts/publication-safety.mjs verify-request",
    "working-directory: packages/CLI",
    "npm publish --access restricted",
  ]
  const forbiddenPatterns = [
    { label: "a push trigger", pattern: /^\s+push:/mu },
    { label: "a pull-request trigger", pattern: /^\s+pull_request:/mu },
    { label: "a release trigger", pattern: /^\s+release:/mu },
    { label: "a reusable-workflow trigger", pattern: /^\s+workflow_call:/mu },
    { label: "a GitHub secret expression", pattern: /\$\{\{\s*secrets\./u },
    { label: "NPM_TOKEN", pattern: /\bNPM_TOKEN\b/u },
    { label: "NODE_AUTH_TOKEN", pattern: /\bNODE_AUTH_TOKEN\b/u },
    { label: "an npm provenance override", pattern: /--provenance\b/u },
  ]
  const findings = []

  if (!/^on:\n  workflow_dispatch:/mu.test(source)) {
    findings.push("release workflow must expose only the manual workflow_dispatch trigger.")
  }

  requiredSnippets.forEach((snippet) => {
    if (!source.includes(snippet)) {
      findings.push(`release workflow is missing ${JSON.stringify(snippet)}.`)
    }
  })

  forbiddenPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(source)) {
      findings.push(`release workflow contains ${label}.`)
    }
  })

  if ((source.match(/id-token: write/gu) ?? []).length !== 1) {
    findings.push("release workflow must grant id-token: write exactly once at the publishing job boundary.")
  }

  if (findings.length > 0) {
    printFailure("Release workflow safety check failed.", findings)
    process.exit(1)
  }

  console.log("Release workflow safety check passed.")
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

  if (packageJson.publishConfig?.registry !== REQUIRED_PUBLISH_REGISTRY) {
    unsafeFindings.push(`publishConfig.registry must be ${REQUIRED_PUBLISH_REGISTRY}.`)
  }

  if (packageJson.repository?.type !== "git") {
    unsafeFindings.push("package repository.type must be git.")
  }

  if (packageJson.repository?.url !== REQUIRED_PACKAGE_REPOSITORY_URL) {
    unsafeFindings.push(`package repository.url must be ${REQUIRED_PACKAGE_REPOSITORY_URL}.`)
  }

  if (packageJson.repository?.directory !== REQUIRED_PACKAGE_REPOSITORY_DIRECTORY) {
    unsafeFindings.push(`package repository.directory must be ${REQUIRED_PACKAGE_REPOSITORY_DIRECTORY}.`)
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
} else if (command === "verify-request") {
  verifyPublicationSafety()

  const expectedVersion = process.env.NPM_RELEASE_EXPECTED_VERSION

  if (!expectedVersion) {
    printFailure("Release request safety check failed.", ["NPM_RELEASE_EXPECTED_VERSION is required."])
    process.exit(1)
  }

  if (expectedVersion !== packageJson.version) {
    printFailure("Release request safety check failed.", [
      `requested version ${expectedVersion} does not match package version ${packageJson.version}.`,
    ])
    process.exit(1)
  }

  console.log(`Release request safety check passed for ${packageJson.name}@${packageJson.version}.`)
} else if (command === "verify-workflow") {
  assertReleaseWorkflowContract(readFileSync(releaseWorkflowUrl, "utf8"))
} else {
  printFailure(`Unknown publication safety command: ${command}`)
  process.exit(1)
}
