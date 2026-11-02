export type TNativeFormDescriptor = Readonly<{
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  metadataTarget: number
  target: number
  formId: string
}>
export type TNativeFieldDescriptor = TNativeFormDescriptor &
  Readonly<{ hasFormAssociation: boolean; ownedEditorBinding?: string; ownedControlBinding?: string }>
