"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"

function Drawer<Payload = unknown>({ ...props }: DrawerPrimitive.Root.Props<Payload>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger<Payload = unknown>({
  ...props
}: DrawerPrimitive.Trigger.Props<Payload>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerBackdrop({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerViewport({ className, ...props }: DrawerPrimitive.Viewport.Props) {
  return (
    <DrawerPrimitive.Viewport
      data-slot="drawer-viewport"
      className={cn("fixed inset-x-0 bottom-0 z-50 flex justify-center", className)}
      {...props}
    />
  )
}

/** `nested` drops the drag handle and rounds all four corners — a nested
 * drawer sits fully on top of its parent rather than peeking the parent's
 * edge out from under it. */
function DrawerPopup({
  className,
  children,
  nested = false,
  ...props
}: DrawerPrimitive.Popup.Props & { nested?: boolean }) {
  return (
    <DrawerPrimitive.Popup
      data-slot="drawer-popup"
      className={cn(
        "w-full max-w-md touch-auto overflow-y-auto overscroll-contain border-t border-border bg-popover text-popover-foreground shadow-lg outline-none [transform:translateY(var(--drawer-swipe-movement-y))]",
        "max-h-[85vh] rounded-t-2xl",
        "data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]",
        "transition-transform duration-300 ease-out data-swiping:duration-0 data-ending-style:duration-200",
        nested && "rounded-t-2xl",
        className
      )}
      {...props}
    >
      {!nested && (
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
          <div className="h-1 w-9 rounded-full bg-foreground/20" />
        </div>
      )}
      {children}
    </DrawerPrimitive.Popup>
  )
}

function DrawerContent({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-content"
      className={cn("px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-[11px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
}
