import { z } from "zod"

export const componentRegistryEntrySchema = z.object({
  name: z.string(),
  isIcon: z.boolean(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  componentRegistryDependencies: z.array(z.string()).optional(),
  helperRegistryDependencies: z.array(z.string()).optional(),
  directory: z.string().optional(),
  file: z.string().optional(),
})

export type TComponentRegistryEntry = z.infer<typeof componentRegistrySchema>

export const componentRegistrySchema = z.array(componentRegistryEntrySchema)

export type TComponentRegistry = z.infer<typeof componentRegistrySchema>
