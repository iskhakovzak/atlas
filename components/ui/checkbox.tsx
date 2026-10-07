"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Atlas checkbox (styles: app/checkbox.css). The button is the tap target (44×44 on phones,
 * 32×32 elsewhere) and pulls its margins in, so in the layout it takes only the visible 20–22px box.
 * The tick and the dash are always in the DOM: switching is a CSS transition on data-state,
 * nothing mounts or unmounts on a click.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn("atlas-check", className)}
      {...props}
    >
      <span className="atlas-check-box" aria-hidden="true">
        <svg viewBox="0 0 16 16" focusable="false">
          <path className="atlas-check-tick" d="M3.6 8.3 6.6 11.2 12.4 5" pathLength={1} />
          <path className="atlas-check-dash" d="M4.5 8h7" />
        </svg>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
