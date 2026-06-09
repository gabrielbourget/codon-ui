import { createRemoveCommand } from "./remove"

export const deleteCommand = createRemoveCommand({
  argumentDescription: "The installed registry item you'd like to inspect or delete.",
  commandName: "delete",
  description: "Delete one installed Amino UI registry item using the same safety checks as remove.",
  jsonDescription: "Print machine-readable delete/remove output.",
})
