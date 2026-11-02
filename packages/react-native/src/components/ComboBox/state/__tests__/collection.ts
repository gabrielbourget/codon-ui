import { createNativeCollectionSnapshot, type TNativeCollectionItem } from "../../../../collection/snapshot"

export type TItem = { id: string | number; label: string }
export const ITEMS: TItem[] = [
  { id: 0, label: "Alpha" },
  { id: "", label: "Empty" },
  { id: "b", label: "Beta" },
]

const modelItems = (): readonly TNativeCollectionItem<TItem>[] =>
  ITEMS.map((item) => ({
    key: item.id,
    type: "item",
    value: item,
    props: {},
    textValue: item.label,
    rendered: item.label,
  }))

export const collection = () => createNativeCollectionSnapshot(modelItems())

export const sectionCollection = () =>
  createNativeCollectionSnapshot<TItem>([
    {
      key: "section",
      type: "section",
      value: null,
      props: {},
      rendered: null,
      textValue: "Group",
      children: modelItems(),
    },
  ])
