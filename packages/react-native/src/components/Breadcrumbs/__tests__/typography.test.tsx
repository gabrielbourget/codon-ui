import { render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, type TextStyle, type View } from "react-native"

import { Link, NativeFocusView, Pagination } from "../../.."
import { NativeTextStyleProvider } from "../../NativeTextStyleProvider"
import { NativeBreadcrumbsRoot } from "../NativeBreadcrumbsRoot"

beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

const breadcrumbMetadata = {
  nativeNavigation: true,
  nativeNavigationLabel: "Trail",
  nativeIsDisabled: false,
  nativeDescriptionLabel: "Description",
  nativeDetailsLabel: "Details",
} as const

it.each(["Breadcrumbs", "Pagination"] as const)(
  "preserves explicit %s descendants while the enclosing legacy boundary retires",
  async (owner) => {
    const ref = createRef<View>()
    const page = jest.fn()
    const size = jest.fn()
    const node = (migrated: boolean, updated = false) => {
      const metrics = { fontFamily: updated ? "NextNav" : "NavBody", lineHeight: updated ? 30 : 26 }
      return (
        <NativeTextStyleProvider nativeInheritance={!migrated} style={{ fontFamily: "LegacyBody", lineHeight: 38 }}>
          <NativeFocusView testID="legacy-owner">
            {owner === "Breadcrumbs" ? (
              <NativeBreadcrumbsRoot {...breadcrumbMetadata} ref={ref} testID="nav" nativeBaselineStyle={metrics}>
                <Link href="#owned">Owned trail</Link>
              </NativeBreadcrumbsRoot>
            ) : (
              <Pagination
                ref={ref}
                testID="nav"
                currentPage={3}
                itemsPerPage={10}
                numberOfItems={100}
                setCurrentPage={page}
                setItemsPerPage={size}
                chosenPaginationSubcomponents={["page-counter"]}
                customComponentStyles={metrics}
              />
            )}
          </NativeFocusView>
        </NativeTextStyleProvider>
      )
    }
    const view = await render(node(false))
    const original = ref.current
    expect(original).not.toBeNull()
    const descendant = () => (owner === "Breadcrumbs" ? screen.getByRole("link") : screen.getByTestId("counter"))
    const label = () => screen.getByText(owner === "Breadcrumbs" ? "Owned trail" : "Pages")
    expect(JSON.parse(screen.getByTestId("nav").props.nativeTypographyStyle)).toMatchObject({
      fontFamily: "LegacyBody",
      lineHeight: 38,
    })
    expect(JSON.parse(descendant().props.nativeTypographyStyle)).toMatchObject({
      fontFamily: "NavBody",
      lineHeight: 26,
    })
    expect(label()).toHaveStyle({ fontFamily: "NavBody", lineHeight: 26 })
    await view.rerender(node(true))
    expect(screen.getByTestId("legacy-owner").props.nativeTypographyStyle).toBeUndefined()
    expect(screen.getByTestId("nav").props.nativeTypographyStyle).toBeUndefined()
    expect(descendant().props.nativeTypographyStyle).toBeUndefined()
    expect(label()).toHaveStyle({ fontFamily: "NavBody", lineHeight: 26 })
    expect(ref.current).toBe(original)
    await view.rerender(node(true, true))
    expect(ref.current).toBe(original)
    expect(label()).toHaveStyle({ fontFamily: "NextNav", lineHeight: 30 })
    expect(page).not.toHaveBeenCalled()
    expect(size).not.toHaveBeenCalled()
    await view.unmount()
    expect(ref.current).toBeNull()
  },
)

it.each(["Breadcrumbs", "Pagination"] as const)(
  "requires explicit migration of effective %s root weights",
  async (owner) => {
    const node = (customStyles: TextStyle, style?: TextStyle) =>
      owner === "Breadcrumbs" ? (
        <NativeBreadcrumbsRoot {...breadcrumbMetadata} nativeBaselineStyle={customStyles} style={style}>
          <Link href="#owned">Owned trail</Link>
        </NativeBreadcrumbsRoot>
      ) : (
        <Pagination
          currentPage={3}
          itemsPerPage={10}
          numberOfItems={100}
          setCurrentPage={jest.fn()}
          setItemsPerPage={jest.fn()}
          chosenPaginationSubcomponents={["page-counter"]}
          customComponentStyles={customStyles}
          style={style}
        />
      )
    await expect(render(node({ fontWeight: 750.5 }))).rejects.toThrow(
      `${owner}: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly`,
    )
    await render(node({ fontWeight: 750.5 }, { fontWeight: "700" }))
  },
)
