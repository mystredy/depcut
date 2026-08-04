"use client";

import { createContext, useContext, useEffect, useState } from "react";

type MobileSidebarState = {
  isMobile: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const MobileSidebarContext = createContext<MobileSidebarState | null>(null);

// Shared between AppHeader (the hamburger trigger) and AppSidebar (the panel
// it opens) — siblings under the (home) layout, so neither can own the other's
// state. isMobile lives here too since both need to know it: the header to
// decide whether the trigger renders at all, the sidebar to switch from an
// in-flow rail to an off-canvas overlay.
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768); // Tailwind's `md`
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <MobileSidebarContext.Provider value={{ isMobile, open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) throw new Error("useMobileSidebar must be used within MobileSidebarProvider");
  return ctx;
}
