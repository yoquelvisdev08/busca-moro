"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-checked:border-primary data-checked:bg-primary",
        "data-unchecked:border-border data-unchecked:bg-surface-high",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        size === "default" ? "h-6 w-11" : "h-5 w-9",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
          "data-checked:translate-x-full data-unchecked:translate-x-0",
          size === "default" ? "size-5" : "size-4",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
