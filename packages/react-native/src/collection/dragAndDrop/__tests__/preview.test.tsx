import { act, render } from "@testing-library/react-native"
import { createRef } from "react"
import { View } from "react-native"

import { NativeDragAndDropContext, NativeDragPreview } from "../hooks"
import type { TNativeDragPreviewRenderer } from "../types"
import type { TNativeDraggableCollectionState } from "../useNativeDraggableCollectionState"

it("hands back the original authored preview and offsets, then releases it on replacement, drag end and unmount", async () => {
  const ref = createRef<TNativeDragPreviewRenderer>(),
    first = jest.fn(),
    second = jest.fn(),
    third = jest.fn(),
    items = [{ "text/plain": "original", "application/x-codon": "" }],
    renderPreview = jest.fn(() => ({ element: <View testID="authored-preview" />, x: 7, y: 9 })),
    state = { draggingKeys: new Set([0]) } as TNativeDraggableCollectionState
  const content = () => (
    <NativeDragAndDropContext.Provider value={{ dragState: state }}>
      <NativeDragPreview ref={ref}>{renderPreview}</NativeDragPreview>
    </NativeDragAndDropContext.Provider>
  )
  const fixture = await render(content())
  expect(renderPreview).not.toHaveBeenCalled()
  await act(() => ref.current!(items, first))
  expect(renderPreview).toHaveBeenLastCalledWith(items)
  expect(first).toHaveBeenCalledTimes(1)
  expect(first.mock.calls[0][0]).toBeTruthy()
  expect(first.mock.calls[0].slice(1)).toEqual([7, 9])
  const original = first.mock.calls[0][0]
  await act(() => ref.current!(items, second))
  expect(first.mock.calls.at(-1)).toEqual([null])
  expect(second.mock.calls[0][0]).toBe(original)
  state.draggingKeys = new Set()
  await fixture.rerender(content())
  expect(second.mock.calls.at(-1)).toEqual([null])
  expect(fixture.queryByTestId("authored-preview")).toBeNull()
  state.draggingKeys = new Set([0])
  await fixture.rerender(content())
  await act(() => ref.current!(items, third))
  await fixture.unmount()
  expect(third.mock.calls.at(-1)).toEqual([null])
})
