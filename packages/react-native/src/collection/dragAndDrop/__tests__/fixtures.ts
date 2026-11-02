import { createNativeCollectionSnapshot, type TNativeCollectionItem, type TNativeCollectionKey } from "../../snapshot"

export const dragValues = [{ id: "zero" }, { id: "empty" }, { id: "folder" }, { id: "child" }]
export const dragCollection = () => {
  const item = (
    key: TNativeCollectionKey,
    value: object,
    children?: readonly TNativeCollectionItem<object>[],
  ): TNativeCollectionItem<object> => ({
    key,
    type: "item",
    value,
    rendered: null,
    textValue: String(key),
    props: {},
    children,
  })
  return createNativeCollectionSnapshot([
    item(0, dragValues[0]),
    item("", dragValues[1]),
    item("folder", dragValues[2], [item("child", dragValues[3])]),
  ])
}
