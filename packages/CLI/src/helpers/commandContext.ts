export type TCommandContext = {
  advisory: boolean
}

export const createCommandContext = ({ advisory = false }: Partial<TCommandContext> = {}): TCommandContext => ({
  advisory,
})
