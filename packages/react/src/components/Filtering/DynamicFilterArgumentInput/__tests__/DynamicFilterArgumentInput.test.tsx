import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FILTER_ARGUMENT_TYPE__INPUT, FILTER_ARGUMENT_TYPE__MULTI_INPUT } from "../../../Table/filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__NUMBER,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
} from "../../../Table/queryTypes"
import DynamicFilterArgumentInput from "../DynamicFilterArgumentInput"
import styles from "../DynamicFilterArgumentInputStyles.module.css"
import type { TDynamicFilterArgumentInputProps } from "../helpers"

const renderDynamicFilterArgumentInput = (props: Partial<TDynamicFilterArgumentInputProps> = {}) => {
  const defaultProps: TDynamicFilterArgumentInputProps = {
    dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
    filterArgumentType: FILTER_ARGUMENT_TYPE__INPUT,
    argument: "ambient",
    filterArgumentAccessibleLabel: "Filter Name",
    onArgumentChange: vi.fn(),
  }

  return render(<DynamicFilterArgumentInput {...defaultProps} {...props} />)
}

describe("<DynamicFilterArgumentInput />", () => {
  it("merges native root className and style with custom root styling aliases.", () => {
    renderDynamicFilterArgumentInput({
      className: "native-argument-input",
      customClassName: "custom-argument-input",
      customStyles: { backgroundColor: "turquoise", marginTop: 5 },
      style: { backgroundColor: "tomato", marginBottom: 10 },
      "data-testid": "custom-dynamic-argument-input",
    })

    const dynamicFilterArgumentInput = screen.getByTestId("custom-dynamic-argument-input")

    expect(dynamicFilterArgumentInput).toHaveClass(styles.dynamicFilterArgumentInput)
    expect(dynamicFilterArgumentInput).toHaveClass("custom-argument-input")
    expect(dynamicFilterArgumentInput).toHaveClass("native-argument-input")
    expect(dynamicFilterArgumentInput).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })

  it("maps aria labeling aliases onto the root element.", () => {
    renderDynamicFilterArgumentInput({
      ariaLabel: "Alias argument input",
      ariaLabelledBy: "alias-label-id",
      ariaDescribedBy: "alias-description-id",
      ariaDetails: "alias-details-id",
    })

    const dynamicFilterArgumentInput = screen.getByTestId("dynamic-filter-argument-input")

    expect(dynamicFilterArgumentInput).toHaveAttribute("aria-label", "Alias argument input")
    expect(dynamicFilterArgumentInput).toHaveAttribute("aria-labelledby", "alias-label-id")
    expect(dynamicFilterArgumentInput).toHaveAttribute("aria-describedby", "alias-description-id")
    expect(dynamicFilterArgumentInput).toHaveAttribute("aria-details", "alias-details-id")
  })

  it("applies field and input slot styling hooks to scalar argument inputs.", () => {
    const { baseElement } = renderDynamicFilterArgumentInput({
      customFieldClassName: "custom-argument-field",
      customFieldStyles: { backgroundColor: "turquoise" },
      customInputClassName: "custom-scalar-input",
      customInputStyles: { marginTop: 5 },
    })

    const scalarInput = screen.getByRole("textbox", { name: "Filter Name" })

    expect(baseElement.querySelector(".custom-argument-field")).toHaveStyle({
      backgroundColor: "rgb(64, 224, 208)",
    })
    expect(scalarInput).toHaveClass("custom-scalar-input")
    expect(scalarInput).toHaveStyle({ marginTop: "5px" })
  })

  it("stretches numeric scalar arguments across the full argument slot.", () => {
    renderDynamicFilterArgumentInput({
      argument: 130,
      dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__NUMBER,
    })

    expect(screen.getByTestId("number-input")).toHaveStyle({ width: "100%" })
    expect(screen.getByTestId("number-input-input")).toHaveStyle({
      flex: "1 1 auto",
      width: "100%",
    })
  })

  it("applies row and action slot styling hooks to multi-value argument inputs.", () => {
    const { baseElement } = renderDynamicFilterArgumentInput({
      argument: ["ambient", "warehouse"],
      filterArgumentType: FILTER_ARGUMENT_TYPE__MULTI_INPUT,
      customActionButtonClassName: "custom-argument-action",
      customActionButtonStyles: { paddingLeft: 20 },
      customRowClassName: "custom-argument-row",
      customRowStyles: { columnGap: 15 },
    })

    expect(baseElement.querySelectorAll(".custom-argument-row")).toHaveLength(2)
    expect(baseElement.querySelector(".custom-argument-row")).toHaveStyle({ columnGap: "15px" })
    expect(screen.getByRole("button", { name: "Add Filter Argument Entry" })).toHaveClass("custom-argument-action")
    expect(screen.getByRole("button", { name: "Add Filter Argument Entry" })).toHaveStyle({ paddingLeft: "20px" })
    expect(screen.getByRole("button", { name: "Add Filter Argument Entry" })).toContainElement(
      screen.getByTestId("multi-input-filter-argument-default-add-icon"),
    )
    expect(screen.getAllByTestId("multi-input-filter-argument-default-delete-icon")).toHaveLength(2)
  })

  it("does not leak wrapper-only props onto the root element.", () => {
    renderDynamicFilterArgumentInput({
      customClassName: "custom-argument-input",
      customStyles: { marginTop: 5 },
      customFieldClassName: "custom-field",
      customFieldStyles: { backgroundColor: "turquoise" },
      customInputClassName: "custom-input",
      customInputStyles: { marginBottom: 10 },
      customRowClassName: "custom-row",
      customRowStyles: { columnGap: 15 },
      customActionButtonClassName: "custom-action",
      customActionButtonStyles: { paddingLeft: 20 },
      customPlaceholderClassName: "custom-placeholder",
      customPlaceholderStyles: { paddingTop: 25 },
    })

    const dynamicFilterArgumentInput = screen.getByTestId("dynamic-filter-argument-input")

    expect(dynamicFilterArgumentInput).not.toHaveAttribute("datatype")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("filterargumenttype")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("argument")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("filterargumentaccessiblelabel")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customstyles")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customfieldclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customfieldstyles")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("custominputclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("custominputstyles")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customrowclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customrowstyles")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customactionbuttonclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customactionbuttonstyles")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customplaceholderclassname")
    expect(dynamicFilterArgumentInput).not.toHaveAttribute("customplaceholderstyles")
  })
})
