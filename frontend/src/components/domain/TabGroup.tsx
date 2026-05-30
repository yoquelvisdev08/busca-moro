import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type TabVariant = "underline" | "pills"

export interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
  disabled?: boolean
}

export interface TabGroupProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  variant?: TabVariant
  className?: string
}

const variantStyles: Record<TabVariant, {
  list: string
  triggerBase: string
  triggerActive: string
  triggerInactive: string
}> = {
  underline: {
    list: "flex gap-0 border-b border-border",
    triggerBase:
      "relative px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    triggerActive: "text-text",
    triggerInactive: "text-text-muted hover:text-text-secondary",
  },
  pills: {
    list: "flex gap-1 rounded-lg bg-surface p-1",
    triggerBase:
      "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    triggerActive: "bg-surface-highest text-text shadow-sm",
    triggerInactive: "text-text-muted hover:text-text-secondary",
  },
}

function TabGroup({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  className,
}: TabGroupProps) {
  const styles = variantStyles[variant]

  const handleKeyDown = (
    e: React.KeyboardEvent,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null
    const enabledTabs = tabs.map((t, i) => ({ ...t, index: i })).filter((t) => !t.disabled)

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = enabledTabs.find((t) => t.index > currentIndex)?.index ?? enabledTabs[0]?.index ?? null
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = [...enabledTabs].reverse().find((t) => t.index < currentIndex)?.index ?? enabledTabs[enabledTabs.length - 1]?.index ?? null
        break
      case "Home":
        nextIndex = enabledTabs[0]?.index ?? null
        break
      case "End":
        nextIndex = enabledTabs[enabledTabs.length - 1]?.index ?? null
        break
    }

    if (nextIndex !== null && nextIndex !== undefined) {
      e.preventDefault()
      onTabChange(tabs[nextIndex].id)
    }
  }

  return (
    <div
      data-slot="tab-group"
      data-variant={variant}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(styles.list, className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab
        const isDisabled = tab.disabled

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              styles.triggerBase,
              isActive ? styles.triggerActive : styles.triggerInactive,
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.icon && (
                <span className="[&>svg]:size-4 shrink-0">{tab.icon}</span>
              )}
              {tab.label}
              {tab.count !== undefined && (
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className="ml-1 h-4 px-1 text-[10px]"
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </Badge>
              )}
            </span>
            {variant === "underline" && isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-container rounded-full"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export { TabGroup }
