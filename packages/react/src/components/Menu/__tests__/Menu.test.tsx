import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Button, MenuTrigger } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import MenuItem from "../components/MenuItem"
import MenuSeparator from "../components/MenuSeparator"
import type { TMenuProps } from "../helpers"
import Menu from "../Menu"
import styles from "../MenuStyles.module.css"

const menuStylesSource = readFileSync("src/components/Menu/MenuStyles.module.css", "utf8")

const TRIGGER_LABEL = "Open item actions"

type TMenuExampleProps = {
  menuProps?: Partial<TMenuProps>
  onActionMock?: (id: string) => void
  disabledKeys?: string[]
}

const TestImageIcon = ({ size = 14 }: { size?: number }) => (
  <svg aria-hidden="true" data-testid="test-image-icon" height={size} viewBox="0 0 16 16" width={size}>
    <path d="M2 3h12v10H2z" />
  </svg>
)

const MenuExample = ({ menuProps = {}, onActionMock, disabledKeys }: TMenuExampleProps) => (
  <MenuTrigger>
    <Button aria-label={TRIGGER_LABEL}>Actions</Button>
    <Menu
      placement="bottom end"
      onAction={onActionMock ? (key) => onActionMock(String(key)) : undefined}
      disabledKeys={disabledKeys}
      {...menuProps}
    >
      <MenuItem id="set-profile">Set as profile image</MenuItem>
      <MenuItem id="move-to-gallery">Move to gallery</MenuItem>
      <MenuSeparator />
      <MenuItem id="remove" variant="destructive">
        Remove
      </MenuItem>
    </Menu>
  </MenuTrigger>
)

const openMenu = async () => {
  const user = userEvent.setup()
  const triggerButton = screen.getByRole("button", { name: TRIGGER_LABEL })
  await user.click(triggerButton)

  const menu = await screen.findByTestId("menu")
  const menuList = await screen.findByRole("menu")

  return { user, menu, menuList }
}

describe("<Menu />", () => {
  it("renders.", async () => {
    render(<MenuExample />)
    const { menu, menuList } = await openMenu()

    expect(menu).toBeInTheDocument()
    expect(menuList).toBeInTheDocument()
  })

  it("shows its items after opening.", async () => {
    render(<MenuExample />)
    await openMenu()

    const items = screen.getAllByRole("menuitem")
    expect(items).toHaveLength(3)
  })

  describe("Menu props API surface", () => {
    it("responds to width prop.", async () => {
      render(<MenuExample menuProps={{ width: 250 }} />)
      const { menu } = await openMenu()

      expect(menu).toHaveStyle({ width: "250px" })
    })

    it("responds to color prop.", async () => {
      render(<MenuExample menuProps={{ color: "teal" }} />)
      const { menu } = await openMenu()

      expect(menu).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    it.each([
      ["primary", "menu--primary"],
      ["secondary", "menu--secondary"],
      ["tertiary", "menu--tertiary"],
      ["quaternary", "menu--quaternary"],
      ["quintenary", "menu--quintenary"],
    ] as const)("responds to theming order prop: %s.", async (order, cssClass) => {
      render(<MenuExample menuProps={{ order }} />)
      const { menu } = await openMenu()

      expect(menu).toHaveClass(styles[cssClass])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(menuStylesSource).toContain("var(--cui-color-primary-500)")
      expect(menuStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to geometry prop: rounded.", async () => {
      render(<MenuExample menuProps={{ geometry: "rounded" }} />)
      const { menu } = await openMenu()

      expect(menu).toHaveClass(styles["menu--rounded"])
    })

    it("responds to geometry prop: orthogonal.", async () => {
      render(<MenuExample menuProps={{ geometry: "orthogonal" }} />)
      const { menu } = await openMenu()

      expect(menu).not.toHaveClass(styles["menu--rounded"])
    })

    it("is raised by default.", async () => {
      render(<MenuExample />)
      const { menu } = await openMenu()

      expect(menu).toHaveClass(styles["menu--raised"])
    })

    it("responds to raised={false}.", async () => {
      render(<MenuExample menuProps={{ raised: false }} />)
      const { menu } = await openMenu()

      expect(menu).not.toHaveClass(styles["menu--raised"])
    })

    it("responds to root and menu-list style props.", async () => {
      render(
        <MenuExample
          menuProps={{
            className: "native-menu-class",
            customClassName: "custom-menu-class",
            customMenuClassName: "custom-menu-list-class",
            customMenuStyles: { color: "gold" },
            customStyles: { color: "turquoise" },
            style: { backgroundColor: "blue" },
          }}
        />,
      )
      const { menu, menuList } = await openMenu()

      expect(menu).toHaveClass("native-menu-class")
      expect(menu).toHaveClass("custom-menu-class")
      expect(menu).toHaveStyle({ color: "rgb(64, 224, 208)" })
      expect(menu).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(menuList).toHaveClass("custom-menu-list-class")
      expect(menuList).toHaveStyle({ color: "rgb(255, 215, 0)" })
    })

    it("forwards its menu aria label to the menu list.", async () => {
      render(<MenuExample menuProps={{ menuAriaLabel: "Artwork actions" }} />)
      const { menuList } = await openMenu()

      expect(menuList).toHaveAttribute("aria-label", "Artwork actions")
    })

    it("can keep the popover open after selection.", async () => {
      const handleAction = vi.fn()
      render(<MenuExample onActionMock={handleAction} menuProps={{ shouldCloseOnSelect: false }} />)
      const { menu, user } = await openMenu()

      await user.click(screen.getByRole("menuitem", { name: "Set as profile image" }))

      expect(handleAction).toHaveBeenCalledWith("set-profile")
      expect(menu).toBeInTheDocument()
    })

    it("does not leak wrapper props to the popover root.", async () => {
      render(
        <MenuExample
          menuProps={{
            width: 250,
            color: "teal",
            order: "primary",
            geometry: "rounded",
            raised: true,
            customStyles: { backgroundColor: "turquoise" },
            customClassName: "custom-menu-class",
            customMenuStyles: { color: "gold" },
            customMenuClassName: "custom-menu-list-class",
          }}
        />,
      )
      const { menu } = await openMenu()

      expect(menu).not.toHaveAttribute("width")
      expect(menu).not.toHaveAttribute("color")
      expect(menu).not.toHaveAttribute("order")
      expect(menu).not.toHaveAttribute("geometry")
      expect(menu).not.toHaveAttribute("raised")
      expect(menu).not.toHaveAttribute("customstyles")
      expect(menu).not.toHaveAttribute("customclassname")
      expect(menu).not.toHaveAttribute("custommenustyles")
      expect(menu).not.toHaveAttribute("custommenuclassname")
    })
  })

  describe("MenuItem interaction", () => {
    it("clicking an item calls the Menu onAction handler with the item id.", async () => {
      const handleAction = vi.fn()
      render(<MenuExample onActionMock={handleAction} />)
      const { user } = await openMenu()

      await user.click(screen.getByRole("menuitem", { name: "Set as profile image" }))

      expect(handleAction).toHaveBeenCalledTimes(1)
      expect(handleAction).toHaveBeenCalledWith("set-profile")
    })

    it("clicking an item calls the individual MenuItem onAction handler.", async () => {
      const handleItemAction = vi.fn()
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem id="edit" onAction={handleItemAction}>
              Edit
            </MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      const { user } = await openMenu()

      await user.click(screen.getByRole("menuitem", { name: "Edit" }))

      expect(handleItemAction).toHaveBeenCalledTimes(1)
    })

    it("disabled items do not call onAction when clicked.", async () => {
      const handleAction = vi.fn()
      render(<MenuExample onActionMock={handleAction} disabledKeys={["set-profile"]} />)
      const { user } = await openMenu()

      const disabledItem = screen.getByRole("menuitem", { name: "Set as profile image" })
      await user.click(disabledItem)

      expect(handleAction).not.toHaveBeenCalled()
    })
  })

  describe("MenuItem visual props", () => {
    it("renders an icon when the icon prop is provided.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem id="photo" icon={<TestImageIcon size={14} />}>
              Photo
            </MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      expect(screen.getByTestId("menu-item-icon")).toBeInTheDocument()
      expect(screen.getByTestId("test-image-icon")).toBeInTheDocument()
    })

    it("does not render an icon slot when no icon prop is given.", async () => {
      render(<MenuExample />)
      await openMenu()

      expect(screen.queryByTestId("menu-item-icon")).not.toBeInTheDocument()
    })

    it("applies the destructive variant class.", async () => {
      render(<MenuExample />)
      await openMenu()

      const removeItem = screen.getByRole("menuitem", { name: "Remove" })
      expect(removeItem).toHaveClass(styles["menuItem--destructive"])
    })

    it("does not apply the destructive class by default.", async () => {
      render(<MenuExample />)
      await openMenu()

      const profileItem = screen.getByRole("menuitem", { name: "Set as profile image" })
      expect(profileItem).not.toHaveClass(styles["menuItem--destructive"])
    })

    it("responds to root style props.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem
              id="styled"
              className="native-menu-item-class"
              customClassName="custom-menu-item-class"
              customStyles={{ fontStyle: "italic" }}
              style={{ color: "teal" }}
            >
              Styled item
            </MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      const item = screen.getByRole("menuitem", { name: "Styled item" })
      expect(item).toHaveClass("native-menu-item-class")
      expect(item).toHaveClass("custom-menu-item-class")
      expect(item).toHaveStyle({ fontStyle: "italic" })
      expect(item).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    it("merges render-prop className and style with computed item styles.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end" disabledKeys={["styled"]}>
            <MenuItem
              id="styled"
              variant="destructive"
              customClassName="custom-menu-item-class"
              customStyles={{ backgroundColor: "gold" }}
              className={({ isDisabled }) => (isDisabled ? "disabled-render-class" : "enabled-render-class")}
              style={({ isDisabled }) => ({ color: isDisabled ? "teal" : "tomato", opacity: isDisabled ? 0.4 : 1 })}
            >
              Styled item
            </MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      const item = screen.getByRole("menuitem", { name: "Styled item" })
      expect(item).toHaveClass(styles.menuItem)
      expect(item).toHaveClass(styles["menuItem--destructive"])
      expect(item).toHaveClass("custom-menu-item-class")
      expect(item).toHaveClass("disabled-render-class")
      expect(item).toHaveStyle({
        backgroundColor: "rgb(255, 215, 0)",
        color: "rgb(0, 128, 128)",
        opacity: "0.4",
      })
    })

    it("does not leak wrapper props to the item root.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem
              id="styled"
              icon={<TestImageIcon size={14} />}
              variant="destructive"
              customStyles={{ fontStyle: "italic" }}
              customClassName="custom-menu-item-class"
            >
              Styled item
            </MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      const item = screen.getByRole("menuitem", { name: "Styled item" })
      expect(item).not.toHaveAttribute("icon")
      expect(item).not.toHaveAttribute("variant")
      expect(item).not.toHaveAttribute("customstyles")
      expect(item).not.toHaveAttribute("customclassname")
    })
  })

  describe("MenuSeparator", () => {
    it("renders inside the menu.", async () => {
      render(<MenuExample />)
      await openMenu()

      expect(screen.getByTestId("menu-separator")).toBeInTheDocument()
    })

    it("has separator role.", async () => {
      render(<MenuExample />)
      await openMenu()

      expect(screen.getByRole("separator")).toBeInTheDocument()
    })

    it("responds to root style props.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem id="edit">Edit</MenuItem>
            <MenuSeparator
              className="native-menu-separator-class"
              customClassName="custom-menu-separator-class"
              customStyles={{ marginTop: 5 }}
              style={{ marginBottom: 5 }}
            />
            <MenuItem id="remove">Remove</MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      const separator = screen.getByRole("separator")
      expect(separator).toHaveClass("native-menu-separator-class")
      expect(separator).toHaveClass("custom-menu-separator-class")
      expect(separator).toHaveStyle({ marginTop: "5px" })
      expect(separator).toHaveStyle({ marginBottom: "5px" })
    })

    it("does not leak wrapper props to the separator root.", async () => {
      render(
        <MenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>Actions</Button>
          <Menu placement="bottom end">
            <MenuItem id="edit">Edit</MenuItem>
            <MenuSeparator customStyles={{ marginTop: 5 }} customClassName="custom-menu-separator-class" />
            <MenuItem id="remove">Remove</MenuItem>
          </Menu>
        </MenuTrigger>,
      )
      await openMenu()

      const separator = screen.getByRole("separator")
      expect(separator).not.toHaveAttribute("customstyles")
      expect(separator).not.toHaveAttribute("customclassname")
    })
  })

  describe("keyboard navigation", () => {
    it("pressing Enter on the trigger opens the menu.", async () => {
      render(<MenuExample />)
      const user = userEvent.setup()

      await user.tab()
      await user.keyboard("{Enter}")

      expect(await screen.findByRole("menu")).toBeInTheDocument()
    })

    it("arrow key navigation selects items and fires onAction.", async () => {
      const handleAction = vi.fn()
      render(<MenuExample onActionMock={handleAction} />)
      const user = userEvent.setup()

      await user.tab()
      await user.keyboard("{Enter}")
      await screen.findByRole("menu")
      await user.keyboard("{ArrowDown}{Enter}")

      expect(handleAction).toHaveBeenCalledWith("move-to-gallery")
    })

    it("pressing Escape closes the menu.", async () => {
      render(<MenuExample />)
      const { user, menu } = await openMenu()

      await user.keyboard("{Escape}")

      expect(menu).not.toBeInTheDocument()
    })
  })
})
