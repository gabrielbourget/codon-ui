import { DEFAULT_THEME, CURRENT_THEME_KEY } from "@/src/constants/ui";

export const getTheme = () => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.localStorage.getItem(CURRENT_THEME_KEY) || DEFAULT_THEME;
};
