import { act, render, screen } from "@testing-library/react-native"
import { StrictMode } from "react"
import { Linking, Text } from "react-native"

import type { TShowcaseRequest } from "../scenarioLink"
import { useShowcaseLink } from "../useShowcaseLink"

let emitURL: (event: { url: string }) => void
let remove: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  remove = jest.fn()
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null)
  jest.spyOn(Linking, "addEventListener").mockImplementation((_type, listener) => {
    emitURL = listener
    return { remove } as unknown as ReturnType<typeof Linking.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

const Harness = ({ receive }: { receive: (request: TShowcaseRequest) => void }) => {
  const error = useShowcaseLink(receive)
  return <Text testID="link-error">{error ?? "none"}</Text>
}

it("handles the actual initial-link API without adding a replacement listener on rerender", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("codon-showcase://scenario/avatar?reset=1")
  const receive = jest.fn()
  const view = await render(<Harness receive={receive} />)
  expect(receive).toHaveBeenCalledWith({ scene: "avatar", reset: true })
  await view.rerender(<Harness receive={receive} />)
  expect(Linking.addEventListener).toHaveBeenCalledTimes(1)
  expect(Linking.getInitialURL).toHaveBeenCalledTimes(1)
  expect(receive).toHaveBeenCalledTimes(1)
})

it("keeps a newer warm link when the initial URL resolves late", async () => {
  let resolveInitial!: (url: string) => void
  jest.mocked(Linking.getInitialURL).mockImplementation(() => new Promise((resolve) => (resolveInitial = resolve)))
  const receive = jest.fn()
  await render(<Harness receive={receive} />)
  await act(() => emitURL({ url: "codon-showcase://scenario/library?theme=dark" }))
  await act(() => resolveInitial("codon-showcase://scenario/avatar?reset=1"))
  expect(receive.mock.calls).toEqual([[{ scene: "library", theme: "dark", reset: false }]])
})

it("does not replay an initial reset when its effect restarts with an updated callback", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("codon-showcase://scenario/library?reset=1")
  const first = jest.fn()
  const next = jest.fn()
  const view = await render(<Harness receive={first} />)
  await view.rerender(<Harness receive={next} />)
  expect(first).toHaveBeenCalledTimes(1)
  expect(next).not.toHaveBeenCalled()
  expect(Linking.getInitialURL).toHaveBeenCalledTimes(1)
  await act(() => emitURL({ url: "codon-showcase://scenario/avatar" }))
  expect(next).toHaveBeenCalledWith({ scene: "avatar", reset: false })
})

it("retains the pending initial URL through Strict Mode effect cleanup and restart", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("codon-showcase://scenario/library")
  const receive = jest.fn()
  await render(
    <StrictMode>
      <Harness receive={receive} />
    </StrictMode>,
  )
  expect(receive).toHaveBeenCalledTimes(1)
  expect(Linking.getInitialURL).toHaveBeenCalledTimes(1)
})

it("reports invalid scenario requests without applying partial configuration and recovers on a valid link", async () => {
  const receive = jest.fn()
  await render(<Harness receive={receive} />)
  await act(() => emitURL({ url: "codon-showcase://scenario/avatar?theme=dark&fixture=typo&reset=1" }))
  expect(receive).not.toHaveBeenCalled()
  expect(screen.getByTestId("link-error")).toHaveTextContent("invalid-scenario-link")
  await act(() => emitURL({ url: "codon-showcase://scenario/avatar" }))
  expect(receive).toHaveBeenCalledWith({ scene: "avatar", reset: false })
  expect(screen.getByTestId("link-error")).toHaveTextContent("none")
})

it("ignores unrelated development-client links", async () => {
  const receive = jest.fn()
  await render(<Harness receive={receive} />)
  await act(() => emitURL({ url: "exp+codon-native-showcase://expo-development-client/?url=http://localhost:8081" }))
  expect(receive).not.toHaveBeenCalled()
  expect(screen.getByTestId("link-error")).toHaveTextContent("none")
})

it("reports native initial-link retrieval failure while allowing a later normal link", async () => {
  jest.mocked(Linking.getInitialURL).mockRejectedValue(new Error("native unavailable"))
  const receive = jest.fn()
  await render(<Harness receive={receive} />)
  expect(screen.getByTestId("link-error")).toHaveTextContent("initial-link-unavailable")
  await act(() => emitURL({ url: "codon-showcase://scenario/library" }))
  expect(receive).toHaveBeenCalledWith({ scene: "library", reset: false })
  expect(screen.getByTestId("link-error")).toHaveTextContent("none")
})

it("removes its native subscription and ignores a pending initial URL after unmount", async () => {
  let resolveInitial!: (url: string) => void
  jest.mocked(Linking.getInitialURL).mockImplementation(() => new Promise((resolve) => (resolveInitial = resolve)))
  const receive = jest.fn()
  const view = await render(<Harness receive={receive} />)
  await view.unmount()
  expect(remove).toHaveBeenCalledTimes(1)
  await act(() => resolveInitial("codon-showcase://scenario/avatar"))
  expect(receive).not.toHaveBeenCalled()
})
