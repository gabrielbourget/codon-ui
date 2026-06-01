// amino-ui-helper-file-marker

export const listBoxItemsListGen = (items: string[]) =>
  items.map((item: string, index) => ({ id: index.toString(), name: item }))
