import { Portal, PortalHost } from "@rn-primitives/portal"
import { render, screen } from "@testing-library/react-native"
import React, { useState } from "react"
import { Text } from "react-native"

const StatefulEntry = ({ name }: { name: string }) => {
  const [initialOwner] = useState(name)
  return <Text testID={`entry-${name}`}>{initialOwner}</Text>
}
const Fixture = ({ first }: { first: boolean }) => (
  <>
    {first && (
      <Portal key="first" name="first" hostName="published-identity">
        <StatefulEntry name="first" />
      </Portal>
    )}
    <Portal key="second" name="second" hostName="published-identity">
      <StatefulEntry name="second" />
    </Portal>
    <PortalHost name="published-identity" />
  </>
)

it("keeps a surviving portal's local state with its own owner", async () => {
  const view = await render(<Fixture first />)
  expect(screen.getByTestId("entry-second")).toHaveTextContent("second")
  await view.rerender(<Fixture first={false} />)
  expect(screen.getByTestId("entry-second")).toHaveTextContent("second")
})
