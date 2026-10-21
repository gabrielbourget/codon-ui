import { createNativeCollectionSnapshot, type TNativeCollectionDescriptor } from "../../../../collection/snapshot"

export type TItem = { id: string | number; label: string }
export const ITEMS: TItem[] = [
  { id: 0, label: "Alpha" },
  { id: "", label: "Empty" },
  { id: "b", label: "Beta" },
]

export const collection = () =>
  createNativeCollectionSnapshot(
    ITEMS.map((item, index) => ({
      descriptorId: `item-${index}`,
      descriptorRevision: "1",
      parentDescriptorId: "",
      target: 100 + index,
      index,
      retainedIndex: index,
      hasRetainedChildren: false,
    })),
    new Map(
      ITEMS.map((item, index) => [
        `item-${index}`,
        {
          descriptorId: `item-${index}`,
          descriptorRevision: "1",
          key: item.id,
          type: "item",
          value: item,
          props: {},
          textValue: item.label,
          rendered: item.label,
        },
      ]),
    ),
  )

export const sectionCollection = () => {
  const descriptors = new Map<string, TNativeCollectionDescriptor<TItem>>([
    [
      "section",
      {
        descriptorId: "section",
        descriptorRevision: "1",
        key: "section",
        type: "section",
        value: null,
        props: {},
        rendered: null,
        textValue: "Group",
      },
    ],
    ...ITEMS.map((item, index): [string, TNativeCollectionDescriptor<TItem>] => [
      `item-${index}`,
      {
        descriptorId: `item-${index}`,
        descriptorRevision: "1",
        key: item.id,
        type: "item",
        value: item,
        props: {},
        rendered: item.label,
        textValue: item.label,
      },
    ]),
  ])
  return createNativeCollectionSnapshot(
    [
      {
        descriptorId: "section",
        descriptorRevision: "1",
        parentDescriptorId: "",
        target: 99,
        index: 0,
        retainedIndex: 0,
        hasRetainedChildren: true,
      },
      ...ITEMS.map((item, index) => ({
        descriptorId: `item-${index}`,
        descriptorRevision: "1",
        parentDescriptorId: "section",
        target: 100 + index,
        index,
        retainedIndex: index,
        hasRetainedChildren: false,
      })),
    ],
    descriptors,
  )
}
