import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";

export const metadata: Metadata = {
  title: "Slowly Downward — Limited edition prints by Stanley Donwood",
  description:
    "Limited edition prints by Stanley Donwood. Each work numbered, catalogued, and released in strictly limited quantities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <CartProvider>{children}</CartProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
