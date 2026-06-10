import { readFileSync } from "node:fs"

const PUBLICATION_BLOCKER_SCRIPT = "node scripts/publication-safety.mjs block-publish"

const packageJsonUrl = new URL("../package.json", import.meta.url)
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"))
const scripts = packageJson.scripts ?? {}

const printFailure = (message, details = []) => {
  console.error(message)

  details.forEach((detail) => {
    console.error(`- ${detail}`)
  })
}

const blockPublish = () => {
  printFailure("Publishing is blocked for this package.", [
    "Finish the Codon UI package rename.",
    "Prove the private package contents with a local npm pack/install run.",
    "Approve the private npm publish policy before replacing this guard.",
  ])
  process.exit(1)
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

  if (scripts.prepublishOnly !== PUBLICATION_BLOCKER_SCRIPT) {
    unsafeFindings.push("prepublishOnly must keep npm publish blocked until the private Codon UI release policy lands.")
  }

  if (unsafeFindings.length > 0) {
    printFailure("Publication safety check failed.", unsafeFindings)
    process.exit(1)
  }

  console.log("Publication safety check passed.")
}

const command = process.argv[2] ?? "verify"

if (command === "block-publish") {
  blockPublish()
} else if (command === "verify") {
  verifyPublicationSafety()
} else {
  printFailure(`Unknown publication safety command: ${command}`)
  process.exit(1)
}
