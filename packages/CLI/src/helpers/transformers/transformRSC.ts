import { type TTransform } from "@/src/helpers/transformers"
import { SyntaxKind } from "ts-morph"

export const transformRSC: TTransform = async ({ sourceFile, config }) => {
  if (config.rsc) return sourceFile

  // -> Remove "use client" from the top of the file if the user is not using NextJS.
  const firstLine = sourceFile.getFirstChildByKind(SyntaxKind.ExpressionStatement)
  if (firstLine?.getText() === `"use client"`) firstLine.remove()

  return sourceFile;
};
