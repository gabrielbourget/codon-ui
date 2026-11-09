import { screen } from "@testing-library/react-native"

export const filterEditor = (name: string, queries: Pick<typeof screen, "getAllByLabelText"> = screen) => {
  const editors = queries.getAllByLabelText(name).filter((target) => typeof target.props.onChangeText === "function")
  expect(editors).toHaveLength(1)
  expect(editors[0]).toHaveProp("accessibilityLabel", name)
  return editors[0]!
}
