import { readFileSync } from "node:fs"

const themeCSS = readFileSync(new URL("./theme.css", import.meta.url), "utf8")

const collectThemeVariables = () => {
  const variables = new Map()

  for (const match of themeCSS.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match
    variables.set(name, value.trim())
  }

  return variables
}

const fail = (message) => {
  console.error(`[theme-css-contract] ${message}`)
  process.exitCode = 1
}

const requireThemeVariable = (variables, name) => {
  if (!variables.has(name)) {
    fail(`Expected ${name} to be declared in theme.css.`)
  }
}

const requireVariableFamily = (variables, prefix, steps) => {
  steps.forEach((step) => requireThemeVariable(variables, `${prefix}${step}`))
}

const variables = collectThemeVariables()

if (!themeCSS.includes(":root {")) {
  fail("Expected theme.css to define a base :root block.")
}

if (!themeCSS.includes(':root,\n[data-theme="light"] {')) {
  fail('Expected theme.css to define the editable light theme block at :root and [data-theme="light"].')
}

if (!themeCSS.includes('[data-theme="dark"] {')) {
  fail('Expected theme.css to define a [data-theme="dark"] block.')
}

for (const name of variables.keys()) {
  if (!name.startsWith("--cui-")) {
    fail(`Expected ${name} to stay out of the package default; only --cui- variables are allowed.`)
  }
}

const requiredVariables = [
  "--cui-background",
  "--cui-border",
  "--cui-border-muted",
  "--cui-animation-fade-in",
  "--cui-animation-fade-out",
  "--cui-control-background",
  "--cui-control-border",
  "--cui-control-disabled-opacity",
  "--cui-control-foreground",
  "--cui-control-hover-background",
  "--cui-control-placeholder",
  "--cui-control-pressed-background",
  "--cui-control-selected-background",
  "--cui-control-selected-background-hover",
  "--cui-control-selected-background-pressed",
  "--cui-control-selected-foreground",
  "--cui-focus-ring",
  "--cui-focus-ring-offset",
  "--cui-foreground",
  "--cui-opacity-backdrop",
  "--cui-opacity-disabled",
  "--cui-space-unit",
  "--cui-state-danger",
  "--cui-state-danger-surface",
  "--cui-state-success",
  "--cui-state-success-surface",
  "--cui-state-warning",
  "--cui-state-warning-surface",
  "--cui-surface",
  "--cui-surface-foreground",
  "--cui-surface-muted",
  "--cui-surface-raised",
  "--cui-surface-raised-foreground",
  "--cui-transition-background-color",
  "--cui-transition-border-color",
  "--cui-transition-box-shadow",
  "--cui-transition-color",
  "--cui-transition-opacity",
  "--cui-transition-outline",
  "--cui-validation-error-border",
  "--cui-validation-success-border",
  "--cui-validation-warning-border",
  "--cui-z-index-base",
  "--cui-z-index-content-offset",
  "--cui-z-index-overlay-offset",
  "--cui-z-index-panel",
  "--cui-z-index-step",
  "--cui-z-index-toast",
]

requiredVariables.forEach((name) => requireThemeVariable(variables, name))
requireVariableFamily(variables, "--cui-neutral-", ["100", "200", "300", "400", "500", "600", "700", "800"])
requireVariableFamily(variables, "--cui-space-", [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
])
requireVariableFamily(variables, "--cui-radius-", ["1", "2", "3", "4", "5"])
requireVariableFamily(variables, "--cui-shadow-", ["1", "2", "3", "4", "5"])

if (themeCSS.includes("--aui-")) {
  fail("Expected theme.css to expose only --cui-* variables; found a legacy --aui-* token.")
}

if (!themeCSS.includes("@keyframes fade-in")) {
  fail("Expected theme.css to define fade-in keyframes.")
}

if (!themeCSS.includes("@keyframes fade-out")) {
  fail("Expected theme.css to define fade-out keyframes.")
}

const forbiddenVariablePatterns = [
  /^--cui-color-/u,
  /^--cui-(primary|secondary|tertiary|quaternary|quintenary|quinary)-/u,
  /^--cui-gradient/u,
  /^--cui-map/u,
  /^--cui-navbar/u,
  /^--cui-route/u,
]

for (const name of variables.keys()) {
  if (forbiddenVariablePatterns.some((pattern) => pattern.test(name))) {
    fail(`Expected ${name} to remain deferred until a component proof requires it.`)
  }
}

for (const [name, value] of variables.entries()) {
  for (const reference of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const referencedVariableName = reference[1]

    if (!variables.has(referencedVariableName)) {
      fail(`${name} references undeclared variable ${referencedVariableName}.`)
    }
  }
}

if (process.exitCode) {
  process.exit()
}

console.log("[theme-css-contract] theme.css contract passed.")
