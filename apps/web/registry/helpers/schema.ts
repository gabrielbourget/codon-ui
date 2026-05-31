import { z } from "zod";

export const HELPER_REGISTRY_ITEM_TYPE__UTIL = "utils";
export const HELPER_REGISTRY_ITEM_TYPE__TYPE = "types";
export const HELPER_REGISTRY_ITEM_TYPE__CONSTANT = "constants";
export const HELPER_REGISTRY_ITEM_TYPE__GLOBAL_CSS = "globalCSS";
export const HELPER_REGISTRY_ITEM_TYPE__TEXT_CSS = "textCSS";
export const AVAILABLE_HELPER_REGISTRY_ITEM_TYPES = [
  HELPER_REGISTRY_ITEM_TYPE__UTIL, HELPER_REGISTRY_ITEM_TYPE__TYPE, HELPER_REGISTRY_ITEM_TYPE__GLOBAL_CSS,
  HELPER_REGISTRY_ITEM_TYPE__CONSTANT
];
export type TAvailableRegistryItemTypes = typeof AVAILABLE_HELPER_REGISTRY_ITEM_TYPES[number];
export const availableRegistryItemTypeSchema = z.union([
  z.literal(HELPER_REGISTRY_ITEM_TYPE__UTIL), z.literal(HELPER_REGISTRY_ITEM_TYPE__TYPE),
  z.literal(HELPER_REGISTRY_ITEM_TYPE__CONSTANT), z.literal(HELPER_REGISTRY_ITEM_TYPE__GLOBAL_CSS),
  z.literal(HELPER_REGISTRY_ITEM_TYPE__TEXT_CSS),
]);

export const helperRegistryEntrySchema = z.object({
  name: z.string(),
  type: availableRegistryItemTypeSchema,
  fileName: z.string(),
  file: z.string()
});

export type THelperRegistryEntry = z.infer<typeof helperRegistryEntrySchema>;

export const helperRegistrySchema = z.array(helperRegistryEntrySchema);

export type THelperRegistry = z.infer<typeof helperRegistrySchema>;
