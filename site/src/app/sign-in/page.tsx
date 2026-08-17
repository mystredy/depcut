import type { Metadata } from "next";

import { AuthScreen } from "@/app/_components/landing/AuthScreen";

export const metadata: Metadata = {
  title: "Log in | Depcut",
  description: "Log in to Depcut with Google.",
};

export default function Page() {
  return <AuthScreen mode="sign-in" />;
}
