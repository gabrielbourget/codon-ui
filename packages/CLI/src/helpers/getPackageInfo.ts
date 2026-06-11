import { type PackageJson } from "type-fest"

export const CODON_UI_CLI_PACKAGE_INFO_NAME = "@codon-ui/cli"
export const CODON_UI_CLI_PACKAGE_INFO_VERSION = "0.1.2"

export const getPackageInfo = (): PackageJson =>
  ({
    name: CODON_UI_CLI_PACKAGE_INFO_NAME,
    version: CODON_UI_CLI_PACKAGE_INFO_VERSION,
  }) as PackageJson
