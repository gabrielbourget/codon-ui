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
  if (!name.startsWith("--aui-")) {
    fail(`Expected ${name} to stay out of the package default; only --aui- variables are allowed.`)
  }
}

const requiredVariables = [
  "--aui-background",
  "--aui-border",
  "--aui-border-muted",
  "--aui-animation-fade-in",
  "--aui-animation-fade-out",
  "--aui-control-background",
  "--aui-control-border",
  "--aui-control-disabled-opacity",
  "--aui-control-foreground",
  "--aui-control-hover-background",
  "--aui-control-placeholder",
  "--aui-control-pressed-background",
  "--aui-control-selected-background",
  "--aui-control-selected-background-hover",
  "--aui-control-selected-background-pressed",
  "--aui-control-selected-foreground",
  "--aui-focus-ring",
  "--aui-focus-ring-offset",
  "--aui-foreground",
  "--aui-opacity-backdrop",
  "--aui-opacity-disabled",
  "--aui-space-unit",
  "--aui-state-danger",
  "--aui-state-danger-surface",
  "--aui-state-success",
  "--aui-state-success-surface",
  "--aui-state-warning",
  "--aui-state-warning-surface",
  "--aui-surface",
  "--aui-surface-foreground",
  "--aui-surface-muted",
  "--aui-surface-raised",
  "--aui-surface-raised-foreground",
  "--aui-transition-background-color",
  "--aui-transition-border-color",
  "--aui-transition-box-shadow",
  "--aui-transition-color",
  "--aui-transition-opacity",
  "--aui-transition-outline",
  "--aui-validation-error-border",
  "--aui-validation-success-border",
  "--aui-validation-warning-border",
  "--aui-z-index-base",
  "--aui-z-index-content-offset",
  "--aui-z-index-overlay-offset",
  "--aui-z-index-panel",
  "--aui-z-index-step",
  "--aui-z-index-toast",
]

requiredVariables.forEach((name) => requireThemeVariable(variables, name))
requireVariableFamily(variables, "--aui-neutral-", ["100", "200", "300", "400", "500", "600", "700", "800"])
requireVariableFamily(variables, "--aui-space-", [
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
requireVariableFamily(variables, "--aui-radius-", ["1", "2", "3", "4", "5"])
requireVariableFamily(variables, "--aui-shadow-", ["1", "2", "3", "4", "5"])

if (!themeCSS.includes("@keyframes fade-in")) {
  fail("Expected theme.css to define fade-in keyframes.")
}

if (!themeCSS.includes("@keyframes fade-out")) {
  fail("Expected theme.css to define fade-out keyframes.")
}

const forbiddenVariablePatterns = [
  /^--aui-color-/u,
  /^--aui-(primary|secondary|tertiary|quaternary|quintenary|quinary)-/u,
  /^--aui-gradient/u,
  /^--aui-map/u,
  /^--aui-navbar/u,
  /^--aui-route/u,
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
