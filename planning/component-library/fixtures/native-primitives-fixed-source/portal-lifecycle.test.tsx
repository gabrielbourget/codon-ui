import { Portal, PortalHost } from "@rn-primitives/portal"
import { fireEvent, render, screen } from "@testing-library/react-native"
import React, { useEffect, useState } from "react"
import { Pressable, Text } from "react-native"

const Entry = ({ name, report }: { name: string; report?: (name: string) => void }) => {
  const [value, setValue] = useState(name)
  useEffect(() => () => report?.(name), [name, report])
  return (
    <Pressable testID={`edit-${name}`} onPress={() => setValue(`${name}-edited`)}>
      <Text testID={`state-${name}`}>{value}</Text>
    </Pressable>
  )
}

const Fixture = ({
  entries,
  host = "fixed-lifecycle",
  report,
}: {
  entries: string[]
  host?: string
  report?: (name: string) => void
}) => (
  <>
    {entries.map((name) => (
      <Portal key={name} name={name} hostName={host}>
        <Entry name={name} report={report} />
      </Portal>
    ))}
    <PortalHost name={host} />
  </>
)

it("retains an edited survivor when an earlier portal is removed", async () => {
  const report = jest.fn()
  const view = await render(<Fixture entries={["first", "second"]} report={report} />)
  await fireEvent.press(screen.getByTestId("edit-second"))
  await view.rerender(<Fixture entries={["second"]} report={report} />)
  expect(screen.getByTestId("state-second")).toHaveTextContent("second-edited")
  expect(report.mock.calls).toEqual([["first"]])
})

it("retains the earlier portal when the later portal is removed", async () => {
  const view = await render(<Fixture entries={["first", "second"]} />)
  await fireEvent.press(screen.getByTestId("edit-first"))
  await view.rerender(<Fixture entries={["first"]} />)
  expect(screen.getByTestId("state-first")).toHaveTextContent("first-edited")
  expect(screen.queryByTestId("state-second")).toBeNull()
})

it("keeps independent hosts isolated even with identical portal names", async () => {
  const view = await render(
    <>
      <Fixture entries={["same"]} host="fixed-host-one" />
      <Fixture entries={["same"]} host="fixed-host-two" />
    </>,
  )
  expect(screen.getAllByTestId("state-same")).toHaveLength(2)
  await view.rerender(<Fixture entries={["same"]} host="fixed-host-two" />)
  expect(screen.getAllByTestId("state-same")).toHaveLength(1)
})

it("cleans up every portal and resets fresh entries after complete closure", async () => {
  const report = jest.fn()
  const view = await render(<Fixture entries={["first", "second"]} report={report} />)
  await fireEvent.press(screen.getByTestId("edit-second"))
  await view.rerender(<Fixture entries={[]} report={report} />)
  expect(report.mock.calls.map(([name]) => name).sort()).toEqual(["first", "second"])
  expect(screen.queryByTestId("state-second")).toBeNull()
  await view.rerender(<Fixture entries={["second"]} report={report} />)
  expect(screen.getByTestId("state-second")).toHaveTextContent(/^second$/u)
})
