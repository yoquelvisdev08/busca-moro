"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox relative inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-transparent text-white transition-colors outline-none after:absolute after:-inset-x-2.5 after:-inset-y-2.5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary-container data-checked:bg-primary-container data-indeterminate:border-primary-container data-indeterminate:bg-primary-container data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          "flex items-center justify-center text-current data-unchecked:opacity-0 data-checked:opacity-100 data-indeterminate:opacity-100 transition-opacity"
        )}
        render={
          <Check className="size-3" />
        }
      >
        <CheckboxPrimitive.Indicator
          className="group-data-indeterminate/checkbox:block hidden"
          render={<Minus className="size-3" />}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
