import { readFileSync } from "node:fs"

import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { TToggleSwitcherProps } from "../helpers"
import ToggleSwitcher from "../ToggleSwitcher"
import styles from "../ToggleSwitcherStyles.module.css"

const toggleSwitcherStylesSource = readFileSync("src/components/ToggleSwitcher/ToggleSwitcherStyles.module.css", "utf8")

const baseItems = [
  {
    id: "and",
    label: "Match all",
  },
  {
    id: "or",
    label: "Match any",
  },
]

const ToggleSwitcherExample = (props: Partial<TToggleSwitcherProps> = {}) => (
  <ToggleSwitcher aria-label="Match mode" items={baseItems} {...props} />
)

describe("<ToggleSwitcher />", () => {
  it("renders.", () => {
    render(<ToggleSwitcherExample />)

    expect(screen.getByTestId("toggle-switcher")).toBeInTheDocument()
    expect(screen.getAllByTestId("toggle-switcher-option")).toHaveLength(2)
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<ToggleSwitcherExample height={40} width={240} />)

      expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ height: "40px", width: "240px" })
    })

    it("responds to font size prop.", () => {
      const { rerender } = render(<ToggleSwitcherExample />)
      let options = screen.getAllByTestId("toggle-switcher-option")

      options.forEach((option) => expect(option).toHaveStyle({ fontSize: "12px" }))

      rerender(<ToggleSwitcherExample fontSize={14} />)
      options = screen.getAllByTestId("toggle-switcher-option")

      options.forEach((option) => expect(option).toHaveStyle({ fontSize: "14px" }))
    })

    it("responds to color prop.", () => {
      render(<ToggleSwitcherExample color="red" selectedKey="or" />)

      const toggleSwitcher = screen.getByTestId("toggle-switcher")
      const selectedOption = screen.getByRole("button", { name: "Match any" })

      expect(toggleSwitcher.style.getPropertyValue("--toggle-switcher-selected-color")).toBe("red")
      expect(selectedOption).toHaveClass(styles["toggleSwitcher__option--custom"])
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<ToggleSwitcherExample geometry="rounded" />)
      const toggleSwitcher = screen.getByTestId("toggle-switcher")
      const options = screen.getAllByTestId("toggle-switcher-option")

      expect(toggleSwitcher).toHaveClass(styles["toggleSwitcher--rounded"])
      options.forEach((option) => expect(option).toHaveClass(styles["toggleSwitcher__option--rounded"]))

      rerender(<ToggleSwitcherExample geometry="round" />)
      expect(toggleSwitcher).toHaveClass(styles["toggleSwitcher--round"])
      options.forEach((option) => expect(option).toHaveClass(styles["toggleSwitcher__option--round"]))

      rerender(<ToggleSwitcherExample geometry="orthogonal" />)
      expect(toggleSwitcher).not.toHaveClass(styles["toggleSwitcher--rounded"])
      expect(toggleSwitcher).not.toHaveClass(styles["toggleSwitcher--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<ToggleSwitcherExample />)
      const option = screen.getAllByTestId("toggle-switcher-option")[0]

      expect(option).toHaveClass(styles["toggleSwitcher__option--default"])
      expect(option).not.toHaveClass(styles["toggleSwitcher__option--primary"])

      rerender(<ToggleSwitcherExample order="primary" />)
      expect(option).toHaveClass(styles["toggleSwitcher__option--primary"])

      rerender(<ToggleSwitcherExample order="secondary" />)
      expect(option).toHaveClass(styles["toggleSwitcher__option--secondary"])

      rerender(<ToggleSwitcherExample order="tertiary" />)
      expect(option).toHaveClass(styles["toggleSwitcher__option--tertiary"])

      rerender(<ToggleSwitcherExample order="quaternary" />)
      expect(option).toHaveClass(styles["toggleSwitcher__option--quaternary"])

      rerender(<ToggleSwitcherExample order="quintenary" />)
      expect(option).toHaveClass(styles["toggleSwitcher__option--quintenary"])
    })

    it("selected order styles use numbered palette tokens.", () => {
      expect(toggleSwitcherStylesSource).toContain("var(--cui-color-primary-500)")
      expect(toggleSwitcherStylesSource).toContain("var(--cui-color-secondary-500)")
      expect(toggleSwitcherStylesSource).toContain("var(--cui-color-tertiary-500)")
      expect(toggleSwitcherStylesSource).toContain("var(--cui-color-quaternary-500)")
      expect(toggleSwitcherStylesSource).toContain("var(--cui-color-quintenary-500)")
      expect(toggleSwitcherStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to selected and default selection props.", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      const { rerender } = render(
        <ToggleSwitcherExample defaultSelectedKey="or" onSelectionChange={onSelectionChange} />,
      )

      expect(screen.getByRole("button", { name: "Match any" })).toHaveAttribute("data-selected", "true")

      await user.click(screen.getByRole("button", { name: "Match all" }))
      expect(onSelectionChange).toHaveBeenCalledWith("and")
      expect(screen.getByRole("button", { name: "Match all" })).toHaveAttribute("data-selected", "true")

      rerender(<ToggleSwitcherExample selectedKey="or" onSelectionChange={onSelectionChange} />)
      expect(screen.getByRole("button", { name: "Match any" })).toHaveAttribute("data-selected", "true")
    })

    it("renders one selected surface on the active option.", async () => {
      const user = userEvent.setup()
      render(<ToggleSwitcherExample defaultSelectedKey="and" />)

      const matchAllOption = screen.getByRole("button", { name: "Match all" })
      const matchAnyOption = screen.getByRole("button", { name: "Match any" })

      expect(screen.getAllByTestId("toggle-switcher-selected-surface")).toHaveLength(1)
      expect(within(matchAllOption).getByTestId("toggle-switcher-selected-surface")).toBeInTheDocument()
      expect(within(matchAnyOption).queryByTestId("toggle-switcher-selected-surface")).toBeNull()

      await user.click(matchAnyOption)

      expect(screen.getAllByTestId("toggle-switcher-selected-surface")).toHaveLength(1)
      expect(within(matchAnyOption).getByTestId("toggle-switcher-selected-surface")).toBeInTheDocument()
      expect(within(matchAllOption).queryByTestId("toggle-switcher-selected-surface")).toBeNull()
    })

    it("responds to canonical disabled and readonly props.", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      const { rerender } = render(<ToggleSwitcherExample isDisabled onSelectionChange={onSelectionChange} />)

      expect(screen.getByTestId("toggle-switcher")).toHaveAttribute("data-disabled", "true")
      expect(screen.getByRole("button", { name: "Match any" })).toBeDisabled()

      rerender(<ToggleSwitcherExample isReadOnly onSelectionChange={onSelectionChange} />)
      await user.click(screen.getByRole("button", { name: "Match any" }))
      expect(screen.getByTestId("toggle-switcher")).toHaveAttribute("data-readonly", "true")
      expect(onSelectionChange).not.toHaveBeenCalled()
    })

    it("treats item-level disabled state as option-local button state.", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()

      render(
        <ToggleSwitcherExample
          items={[
            baseItems[0],
            {
              ...baseItems[1],
              disabled: true,
            },
          ]}
          onSelectionChange={onSelectionChange}
        />,
      )

      const matchAnyOption = screen.getByRole("button", { name: "Match any" })

      expect(screen.getByTestId("toggle-switcher")).not.toHaveAttribute("data-disabled")
      expect(matchAnyOption).toBeDisabled()

      await user.click(matchAnyOption)

      expect(onSelectionChange).not.toHaveBeenCalled()
    })

    it("can opt out of disabled and readonly states with canonical props.", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      const { rerender } = render(
        <ToggleSwitcherExample isDisabled={false} isReadOnly={false} onSelectionChange={onSelectionChange} />,
      )

      let toggleSwitcher = screen.getByTestId("toggle-switcher")
      expect(toggleSwitcher).not.toHaveAttribute("data-disabled")
      expect(toggleSwitcher).not.toHaveAttribute("data-readonly")
      expect(screen.getByRole("button", { name: "Match any" })).not.toBeDisabled()

      await user.click(screen.getByRole("button", { name: "Match any" }))
      expect(onSelectionChange).toHaveBeenCalledWith("or")

      rerender(<ToggleSwitcherExample isDisabled isReadOnly onSelectionChange={onSelectionChange} />)
      toggleSwitcher = screen.getByTestId("toggle-switcher")
      expect(toggleSwitcher).toHaveAttribute("data-disabled", "true")
      expect(toggleSwitcher).toHaveAttribute("data-readonly", "true")
      expect(screen.getByRole("button", { name: "Match any" })).toBeDisabled()
    })

    it("responds to focus, raised, uppercase, and font weight props.", () => {
      const { rerender } = render(
        <ToggleSwitcherExample
          raised
          uppercase
          optionFontWeight="bold"
          selectedOptionFontWeight="bold"
          selectedKey="and"
        />,
      )
      const toggleSwitcher = screen.getByTestId("toggle-switcher")
      const selectedOption = screen.getByRole("button", { name: "Match all" })

      expect(toggleSwitcher).toHaveClass(styles["toggleSwitcher--raised"])
      expect(selectedOption).toHaveClass(styles["toggleSwitcher__option--uppercase"])
      expect(selectedOption.style.getPropertyValue("--toggle-switcher-option-font-weight")).toBe("bold")
      expect(selectedOption.style.getPropertyValue("--toggle-switcher-selected-option-font-weight")).toBe("bold")
      expect(selectedOption).toHaveClass(styles["toggleSwitcher__option--applyFocusStyle"])
      expect(selectedOption).toHaveClass(styles["toggleSwitcher__option--offsetFocusRing"])

      rerender(<ToggleSwitcherExample enableFocusStyle={false} offsetFocusRing={false} />)
      expect(selectedOption).toHaveClass(styles["toggleSwitcher__option--noFocusStyle"])
      expect(selectedOption).not.toHaveClass(styles["toggleSwitcher__option--applyFocusStyle"])
      expect(selectedOption).not.toHaveClass(styles["toggleSwitcher__option--offsetFocusRing"])
    })

    it("responds to custom styles props.", () => {
      render(
        <ToggleSwitcherExample
          customStyles={{ backgroundColor: "yellow" }}
          customOptionStyles={{ minHeight: 32 }}
          customSelectedOptionStyles={{ color: "teal" }}
          selectedKey="or"
        />,
      )

      expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ backgroundColor: "rgb(255, 255, 0)" })
      screen
        .getAllByTestId("toggle-switcher-option")
        .forEach((option) => expect(option).toHaveStyle({ minHeight: "32px" }))
      expect(screen.getByRole("button", { name: "Match any" })).toHaveStyle({ color: "rgb(0, 128, 128)" })
    })

    it("merges native and custom root and selected-option styling props.", () => {
      render(
        <ToggleSwitcherExample
          className="native-toggle-switcher"
          customClassName="custom-toggle-switcher"
          customSelectedOptionClassName="custom-selected-option"
          customStyles={{ height: 40 }}
          style={{ width: 240 }}
          selectedKey="or"
        />,
      )

      const toggleSwitcher = screen.getByTestId("toggle-switcher")
      const selectedOption = screen.getByRole("button", { name: "Match any" })
      expect(toggleSwitcher).toHaveClass(styles.toggleSwitcher)
      expect(toggleSwitcher).toHaveClass("custom-toggle-switcher")
      expect(toggleSwitcher).toHaveClass("native-toggle-switcher")
      expect(toggleSwitcher).toHaveStyle({ height: "40px", width: "240px" })
      expect(selectedOption).toHaveClass("custom-selected-option")
    })

    it("consumes wrapper-only props before spreading root props.", () => {
      render(
        <ToggleSwitcherExample
          color="red"
          customClassName="custom-toggle-switcher"
          customOptionClassName="custom-toggle-option"
          customSelectedOptionClassName="custom-selected-option"
          customStyles={{ height: 40 }}
          geometry="round"
          height={40}
          isDisabled
          isReadOnly
          raised
          width={240}
        />,
      )

      const toggleSwitcher = screen.getByTestId("toggle-switcher")
      expect(toggleSwitcher).not.toHaveAttribute("color")
      expect(toggleSwitcher).not.toHaveAttribute("customClassName")
      expect(toggleSwitcher).not.toHaveAttribute("customOptionClassName")
      expect(toggleSwitcher).not.toHaveAttribute("customSelectedOptionClassName")
      expect(toggleSwitcher).not.toHaveAttribute("customStyles")
      expect(toggleSwitcher).not.toHaveAttribute("disabled")
      expect(toggleSwitcher).not.toHaveAttribute("geometry")
      expect(toggleSwitcher).not.toHaveAttribute("height")
      expect(toggleSwitcher).not.toHaveAttribute("readOnly")
      expect(toggleSwitcher).not.toHaveAttribute("raised")
      expect(toggleSwitcher).not.toHaveAttribute("width")
    })
  })
})
