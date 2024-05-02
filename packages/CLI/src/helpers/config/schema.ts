import { z } from "zod";

export const coreConfigSchema = z.object({
  $schema: z.string().optional(),
  rsc: z.coerce.boolean().default(false),
  tsx: z.coerce.boolean().default(true),
  aliases: z.object({
    components: z.string(),
    utils: z.string(),
    types: z.string(),
    constants: z.string(),
    globalCSS: z.string(),
    textCSS: z.string(),
  }),
}).strict();

export type TCoreConfig = z.infer<typeof coreConfigSchema>;

export const configSchema = coreConfigSchema.extend({
  resolvedPaths: z.object({
    components: z.string(),
    icons: z.string(),
    utils: z.string(),
    types: z.string(),
    constants: z.string(),
    globalCSS: z.string(),
    textCSS: z.string(),
  })
});

export type TConfig = z.infer<typeof configSchema>;
