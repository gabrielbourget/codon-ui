import { render, screen } from "@testing-library/react"
import type { ComponentPropsWithoutRef, PropsWithChildren } from "react"
import { describe, expect, it, vi } from "vitest"

import Avatar from "../Avatar"
import styles from "../AvatarStyles.module.css"

type TMockAvatarRootProps = PropsWithChildren<ComponentPropsWithoutRef<"span">>
type TMockAvatarImageProps = ComponentPropsWithoutRef<"img">
type TMockAvatarFallbackProps = PropsWithChildren<ComponentPropsWithoutRef<"span"> & { delayMs?: number }>

vi.mock("@radix-ui/react-avatar", () => ({
  Root: ({ children, ...props }: TMockAvatarRootProps) => <span {...props}>{children}</span>,
  Image: (props: TMockAvatarImageProps) => <img {...props} />,
  Fallback: ({ children, delayMs: _delayMs, ...props }: TMockAvatarFallbackProps) => <span {...props}>{children}</span>,
}))

describe("<Avatar />", () => {
  it("renders.", () => {
    render(<Avatar />)

    expect(screen.getByTestId("avatar")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to size props.", () => {
      const { rerender } = render(<Avatar size="50" />)

      const avatar = screen.getByTestId("avatar")
      expect(avatar).toHaveStyle({ "--size": "50px" })

      rerender(<Avatar size={40} />)
      expect(avatar).toHaveStyle({ "--size": "40px" })

      rerender(<Avatar size="50%" />)
      expect(avatar).toHaveStyle({ "--size": "50%" })

      rerender(<Avatar size="2rem" />)
      expect(avatar).toHaveStyle({ "--size": "2rem" })

      rerender(<Avatar size="var(--avatar-size)" />)
      expect(avatar).toHaveStyle({ "--size": "var(--avatar-size)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Avatar geometry="rounded" />)
      const avatar = screen.getByTestId("avatar")
      expect(avatar).toHaveClass(styles["avatar--rounded"])

      rerender(<Avatar geometry="round" />)
      expect(avatar).toHaveClass(styles["avatar--round"])

      rerender(<Avatar geometry="orthogonal" />)
      expect(avatar).not.toHaveClass(styles["avatar--rounded"])
      expect(avatar).not.toHaveClass(styles["avatar--round"])
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Avatar raised />)
      const avatar = screen.getByTestId("avatar")

      expect(avatar).toHaveClass(styles["avatar--raised"])

      rerender(<Avatar raised={false} />)
      expect(avatar).not.toHaveClass(styles["avatar--raised"])
    })

    it("responds to color props.", () => {
      const { rerender } = render(<Avatar foreground="red" background="blue" />)

      const avatar = screen.getByTestId("avatar")
      expect(avatar).toHaveStyle({ "--foreground": "red" })
      expect(avatar).toHaveStyle({ "--background": "blue" })

      rerender(<Avatar foreground="green" />)
      expect(avatar).toHaveStyle({ "--foreground": "green" })
    })

    it("responds to image URL prop.", () => {
      const { rerender } = render(<Avatar imageURL="https://example.com/avatar.jpg" />)

      expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "https://example.com/avatar.jpg")

      rerender(<Avatar />)
      expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument()
    })

    it("responds to name props.", () => {
      const { rerender } = render(<Avatar name1="Alice" name2="Smith" />)
      const avatar = screen.getByTestId("avatar")
      expect(avatar).toHaveTextContent(/as/iu)

      rerender(<Avatar name1="Alice" />)
      expect(avatar).toHaveTextContent(/a/iu)

      rerender(<Avatar name2="Smith" />)
      expect(avatar).toHaveTextContent(/s/iu)

      rerender(<Avatar />)
      expect(avatar).toHaveTextContent(/nu/iu)
    })

    it("accepts custom fallback labels for anonymous initials and image alt text.", () => {
      render(<Avatar labels={{ placeholderFirstName: "Anonymous", placeholderLastName: "Person" }} />)

      expect(screen.getByTestId("avatar")).toHaveTextContent(/ap/iu)
      expect(screen.getByTestId("avatar-image")).toHaveAttribute("alt", "Anonymous Person")
    })

    it("responds to custom style props.", () => {
      render(
        <Avatar
          customStyles={{ backgroundColor: "red" }}
          customImageStyles={{ backgroundColor: "green" }}
          customFallbackStyles={{ backgroundColor: "purple" }}
        />,
      )

      const avatar = screen.getByTestId("avatar")
      const avatarImage = screen.getByTestId("avatar-image")
      const avatarFallback = screen.getByTestId("avatar-fallback")

      expect(avatar).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(avatarImage).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(avatarFallback).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
    })

    it("merges native root class and style props.", () => {
      render(
        <Avatar
          className="custom-avatar-class"
          customStyles={{ backgroundColor: "red" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const avatar = screen.getByTestId("avatar")

      expect(avatar).toHaveClass(styles.avatar)
      expect(avatar).toHaveClass("custom-avatar-class")
      expect(avatar).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("forwards custom text props to the fallback text.", () => {
      render(
        <Avatar
          name1="Alice"
          name2="Smith"
          customTextProps={{
            "data-testid": "avatar-text",
            customClassName: "custom-avatar-text",
            customStyles: { color: "green" },
          }}
          customTextStyles={{ backgroundColor: "purple" }}
        />,
      )

      const avatarText = screen.getByTestId("avatar-text")

      expect(avatarText).toHaveClass("custom-avatar-text")
      expect(avatarText).toHaveStyle({ color: "rgb(0, 128, 0)", backgroundColor: "rgb(128, 0, 128)" })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Avatar
          size={40}
          color="red"
          foreground="white"
          background="black"
          imageURL="https://example.com/avatar.jpg"
          name1="Alice"
          name2="Smith"
          geometry="round"
          raised
          clickable
          onClick={() => null}
          fallbackDelay={10}
          labels={{ placeholderFirstName: "Anonymous", placeholderLastName: "Person" }}
          customStyles={{ marginTop: 5 }}
          customImageStyles={{ backgroundColor: "green" }}
          customFallbackStyles={{ backgroundColor: "purple" }}
          customTextStyles={{ color: "blue" }}
          customTextProps={{ customStyles: { fontWeight: 700 } }}
        />,
      )

      const avatar = screen.getByTestId("avatar")

      expect(avatar).not.toHaveAttribute("size")
      expect(avatar).not.toHaveAttribute("color")
      expect(avatar).not.toHaveAttribute("foreground")
      expect(avatar).not.toHaveAttribute("background")
      expect(avatar).not.toHaveAttribute("imageurl")
      expect(avatar).not.toHaveAttribute("name1")
      expect(avatar).not.toHaveAttribute("name2")
      expect(avatar).not.toHaveAttribute("geometry")
      expect(avatar).not.toHaveAttribute("raised")
      expect(avatar).not.toHaveAttribute("clickable")
      expect(avatar).not.toHaveAttribute("fallbackdelay")
      expect(avatar).not.toHaveAttribute("labels")
      expect(avatar).not.toHaveAttribute("customstyles")
      expect(avatar).not.toHaveAttribute("customimagestyles")
      expect(avatar).not.toHaveAttribute("customfallbackstyles")
      expect(avatar).not.toHaveAttribute("customtextstyles")
      expect(avatar).not.toHaveAttribute("customtextprops")
    })
  })
})
