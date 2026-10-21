import { writeFileSync } from "node:fs"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef, useContext } from "react"
import {
  Autocomplete,
  Button,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  MenuStateContext,
  MenuTrigger,
  Popover,
  SearchField,
  SubmenuTrigger,
} from "react-aria-components"
import { afterAll, expect, it } from "vitest"

const records: unknown[] = []
afterAll(() => {
  const observationsPath = process.env.CODON_MENU_CONTRACT_OBSERVATIONS
  if (observationsPath) writeFileSync(observationsPath, JSON.stringify(records, null, 2))
})

it("observes pinned virtualized positions/counts across original sections and submenu branches", async () => {
  let state: React.ContextType<typeof MenuStateContext>
  const Root: typeof DefaultCollectionRenderer.CollectionRoot = (props) => {
    state = useContext(MenuStateContext)
    return <DefaultCollectionRenderer.CollectionRoot {...props} />
  }
  render(
    <CollectionRendererContext.Provider
      value={{ ...DefaultCollectionRenderer, isVirtualized: true, CollectionRoot: Root }}
    >
      <MenuTrigger defaultOpen>
        <Button>Open source menu</Button>
        <Popover isNonModal>
          <Menu aria-label="Source menu">
            <MenuItem id="a" data-testid="a">
              Alpha
            </MenuItem>
            <MenuSection>
              <Header>Group</Header>
              <MenuItem id="b" data-testid="b">
                Beta
              </MenuItem>
              <MenuItem id="c" data-testid="c">
                Charlie
              </MenuItem>
            </MenuSection>
            <SubmenuTrigger>
              <MenuItem id="trigger" data-testid="trigger">
                More
              </MenuItem>
              <Popover>
                <Menu aria-label="Child">
                  <MenuItem id="child">Child</MenuItem>
                </Menu>
              </Popover>
            </SubmenuTrigger>
            <MenuItem id="d" data-testid="d">
              Delta
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </CollectionRendererContext.Provider>,
  )
  const menu = await screen.findByRole("menu")
  expect(menu).toHaveAccessibleName("Open source menu")
  const items = ["a", "b", "c", "trigger", "d"].map((key) => {
    const element = screen.getByTestId(key)
    const node = state!.collection.getItem(key)!
    return {
      key,
      index: node.index,
      parentKey: node.parentKey,
      type: node.type,
      position: element.getAttribute("aria-posinset"),
      size: element.getAttribute("aria-setsize"),
    }
  })
  records.push({
    kind: "virtualized-menu",
    menuLabel: menu.getAttribute("aria-label"),
    menuLabelledBy: menu.getAttribute("aria-labelledby"),
    roots: [...state!.collection].map((node) => ({ key: node.key, type: node.type, index: node.index })),
    items,
  })
  expect(items.map(({ key, index, position, size }) => ({ key, index, position, size }))).toEqual([
    { key: "a", index: 0, position: "1", size: "4" },
    { key: "b", index: 1, position: "2", size: "4" },
    { key: "c", index: 2, position: "3", size: "4" },
    { key: "trigger", index: 0, position: "1", size: "4" },
    { key: "d", index: 3, position: "4", size: "4" },
  ])
  expect(items.every((item) => item.position === String(item.index + 1))).toBe(true)
})

it("observes actual Autocomplete input ownership of virtual focus and active descendant", async () => {
  const field = createRef<HTMLInputElement>()
  let state: React.ContextType<typeof MenuStateContext>
  const Root: typeof DefaultCollectionRenderer.CollectionRoot = (props) => {
    state = useContext(MenuStateContext)
    return <DefaultCollectionRenderer.CollectionRoot {...props} />
  }
  render(
    <CollectionRendererContext.Provider value={{ ...DefaultCollectionRenderer, CollectionRoot: Root }}>
      <Autocomplete>
        <SearchField aria-label="Find source action">
          <Input ref={field} data-testid="editor" />
        </SearchField>
        <Menu aria-label="Autocomplete menu">
          <MenuItem id="one" data-testid="one">
            One
          </MenuItem>
          <MenuItem id="two" data-testid="two">
            Two
          </MenuItem>
        </Menu>
      </Autocomplete>
    </CollectionRendererContext.Provider>,
  )
  await act(async () => field.current!.focus())
  fireEvent.keyDown(field.current!, { key: "ArrowDown", code: "ArrowDown" })
  await waitFor(() => expect(state!.selectionManager.focusedKey).not.toBeNull())
  const menu = screen.getByRole("menu", { name: "Autocomplete menu" })
  const focused = state!.selectionManager.focusedKey!
  records.push({
    kind: "autocomplete-owned-focus",
    focusedKey: focused,
    activeElement:
      document.activeElement === field.current ? "editor" : document.activeElement?.getAttribute("data-testid"),
    inputActiveDescendant: field.current!.getAttribute("aria-activedescendant"),
    menuActiveDescendant: menu.getAttribute("aria-activedescendant"),
    itemId: screen.getByTestId(String(focused)).id,
  })
  expect(document.activeElement).toBe(field.current)
  expect(menu.getAttribute("aria-activedescendant")).toBeNull()
  expect(field.current!.getAttribute("aria-activedescendant")).toBe(screen.getByTestId(String(focused)).id)
})
