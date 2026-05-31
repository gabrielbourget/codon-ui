import { type TTransform } from "@/src/helpers/transformers"
import { ParserOptions, parse } from "@babel/parser";
const { transformFromAstSync } = require("@babel/core");
// @ts-ignore
import transformTypescript from "@babel/plugin-transform-typescript"
import * as recast from "recast"

// This is a copy of the babel options from recast/parser.
// The goal here is to tolerate as much syntax as possible.
// See https://github.com/benjamn/recast/blob/master/parsers/_babel_options.ts.
const parserOptions: ParserOptions = {
  sourceType: "module",
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  startLine: 1,
  tokens: true,
  plugins: [
    "asyncGenerators",
    "bigInt",
    "classPrivateMethods",
    "classPrivateProperties",
    "classProperties",
    "classStaticBlock",
    "decimal",
    "decorators-legacy",
    "doExpressions",
    "dynamicImport",
    "exportDefaultFrom",
    "exportNamespaceFrom",
    "functionBind",
    "functionSent",
    "importAssertions",
    "importMeta",
    "nullishCoalescingOperator",
    "numericSeparator",
    "objectRestSpread",
    "optionalCatchBinding",
    "optionalChaining",
    [
      "pipelineOperator",
      {
        proposal: "minimal",
      },
    ],
    [
      "recordAndTuple",
      {
        syntaxType: "hash",
      },
    ],
    "throwExpressions",
    "topLevelAwait",
    "v8intrinsic",
    "typescript",
    "jsx",
  ],
}

export const transformToJS: TTransform<String> = async ({ sourceFile, config }) => {
  const output = sourceFile.getFullText();

  const ast = recast.parse(output, {
    parser: {
      parse: (code: string) => parse(code, parserOptions)
    }
  });

  const result = transformFromAstSync(ast, output, {
    cloneInputAst: false,
    code: false,
    ast: true,
    plugins: [transformTypescript],
    configFile: false,
  });

  if (!result || !result.ast) {
    throw new Error("Failed to transform TSX or TS to JSX or JS");
  }

  return recast.print(result.ast).code;
};
