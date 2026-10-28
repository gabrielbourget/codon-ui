import { SortParameterList, type SortParameter, type SortParameterListProps } from ".."

const item: SortParameter = { ID: "", name: "", sortDirection: "Ascending" }
const props: SortParameterListProps = {
  sortParameterList: [item],
  onSortParameterListChange: (items) => {
    const original: SortParameter[] = items
    void original
  },
  ariaLabel: "Sort parameters",
  ariaLabelledBy: "first second",
  ariaDescribedBy: "description",
  ariaDetails: "details",
  customStyles: { width: 250, color: "navy" },
  style: { width: undefined },
  customItemStyles: { backgroundColor: "tomato" },
  customItemIconStyles: { color: "red", marginRight: 5 },
  customItemTextStyles: { marginLeft: 10 },
}
export const standalone = <SortParameterList {...props} />
export const queryShape = (
  <SortParameterList
    sortParameterList={[
      // @ts-expect-error The standalone contract uses ID/name, independently of the query editor.
      { id: "x", criteriaName: "X", sortDirection: "Ascending" },
    ]}
  />
)
// @ts-expect-error DOM class names have no native owner.
export const browserClass = <SortParameterList {...props} className="browser" />
// @ts-expect-error CSS pixel strings are not native dimensions.
export const browserDimension = <SortParameterList {...props} customStyles={{ width: "250px" }} />
