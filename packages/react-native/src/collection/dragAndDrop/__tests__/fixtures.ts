import {
  createNativeCollectionSnapshot,
  type TNativeCollectionDescriptor,
  type TNativeCollectionHierarchyEntry,
  type TNativeCollectionKey,
} from "../../snapshot"

export const dragValues = [{ id: "zero" }, { id: "empty" }, { id: "folder" }, { id: "child" }]
export const dragCollection = () => {
  const descriptors = new Map<string, TNativeCollectionDescriptor<object>>()
  const hierarchy: TNativeCollectionHierarchyEntry[] = []
  const add = (key: TNativeCollectionKey, value: object, parent: string, index: number, children = false) => {
    const id = `node-${hierarchy.length}`
    descriptors.set(id, {
      descriptorId: id,
      descriptorRevision: `${id}-revision`,
      key,
      type: "item",
      value,
      rendered: null,
      textValue: String(key),
      props: {},
    })
    hierarchy.push({
      descriptorId: id,
      descriptorRevision: `${id}-revision`,
      parentDescriptorId: parent,
      target: hierarchy.length + 100,
      index,
      retainedIndex: index,
      hasRetainedChildren: children,
    })
    return id
  }
  add(0, dragValues[0], "", 0)
  add("", dragValues[1], "", 1)
  const parent = add("folder", dragValues[2], "", 2, true)
  add("child", dragValues[3], parent, 0)
  return createNativeCollectionSnapshot(hierarchy, descriptors)
}
