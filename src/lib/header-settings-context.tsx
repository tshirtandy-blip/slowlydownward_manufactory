"use client";

import { createContext, useContext } from "react";

export type HeaderSettings = {
  logoType: "TEXT" | "IMAGE" | "NONE";
  logoText: string | null;
  logoImageUrl: string | null;
  logoPosition: "LEFT" | "CENTER" | "RIGHT";
  // Percentage size of the logo — 100 = normal size.
  logoScale: number;
  showCartIcon: boolean;
  cartIconUrl: string | null;
  showAccountIcon: boolean;
  accountIconUrl: string | null;
  showCurrencySelector: boolean;
};

export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  logoType: "TEXT",
  logoText: "Slowly Downward",
  logoImageUrl: null,
  logoPosition: "LEFT",
  logoScale: 100,
  showCartIcon: true,
  cartIconUrl: null,
  showAccountIcon: true,
  accountIconUrl: null,
  showCurrencySelector: true,
};

const HeaderSettingsContext = createContext<HeaderSettings>(DEFAULT_HEADER_SETTINGS);

/** Makes the admin-configured header (logo, icons, layout) available to
 * SiteHeader without every route having to fetch it itself. Populated once,
 * server-side, in the root layout. */
export function HeaderSettingsProvider({
  settings,
  children,
}: {
  settings: HeaderSettings;
  children: React.ReactNode;
}) {
  return <HeaderSettingsContext.Provider value={settings}>{children}</HeaderSettingsContext.Provider>;
}

export function useHeaderSettings() {
  return useContext(HeaderSettingsContext);
}
