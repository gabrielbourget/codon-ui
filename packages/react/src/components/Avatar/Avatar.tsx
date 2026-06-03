import * as RadixAvatar from "@radix-ui/react-avatar"
import { type FC } from "react"

import Text from "../Text/Text"

import type { TAvatarProps } from "./helpers"
import { calibrateComponent, generateInitials } from "./helpers"

const Avatar: FC<TAvatarProps> = (props) => {
  const {
    "data-testid": dataTestID,
    imageURL,
    name1,
    name2,
    clickable,
    onClick,
    fallbackDelay,
    labels,
    customTextStyles,
    customTextProps = {},
    customImageStyles,
    customFallbackStyles,
    className,
    color,
    foreground,
    background,
    geometry,
    raised,
    size,
    style,
    customStyles: customStyles__props,
    ...rest
  } = props

  const { initials, altTextName } = generateInitials(name1, name2, labels)
  const { avatarStyles, avatarImageStyles, avatarFallbackStyles, customStyles: avatarStyle } = calibrateComponent(props)
  const { customStyles: customTextPropsStyles, ...textProps } = customTextProps
  const resolvedCustomTextStyles = {
    ...customTextPropsStyles,
    ...customTextStyles,
  }

  return (
    <RadixAvatar.Root
      {...rest}
      onClick={clickable && onClick ? onClick : undefined}
      data-testid={dataTestID ?? "avatar"}
      className={avatarStyles}
      style={avatarStyle}
    >
      <RadixAvatar.Image
        src={imageURL}
        alt={altTextName}
        data-testid="avatar-image"
        className={avatarImageStyles}
        style={{ ...customImageStyles }}
      />
      <RadixAvatar.Fallback
        data-testid="avatar-fallback"
        className={avatarFallbackStyles}
        delayMs={fallbackDelay}
        style={{ ...customFallbackStyles }}
      >
        <Text customStyles={resolvedCustomTextStyles} {...textProps}>
          {initials}
        </Text>
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}

Avatar.displayName = "Avatar"

export default Avatar
