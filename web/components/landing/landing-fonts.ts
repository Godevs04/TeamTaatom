import { Playfair_Display } from "next/font/google";

/** Editorial headings on the marketing page only. */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});
