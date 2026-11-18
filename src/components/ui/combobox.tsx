"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type ComboboxOption = { id: string; label: string; detail?: string; search?: string }

// Searchable single select on Popover + Command (ADR 0031; the registry's Combobox is Base UI, we use Radix + cmdk).
// A visually hidden input carries `name`/`required` so it submits with Server Action forms and gets native validation.
function Combobox({
  options,
  value,
  defaultValue = "",
  onValueChange,
  placeholder,
  searchPlaceholder = "ค้นหา",
  emptyText = "ไม่พบรายการ",
  name,
  required = false,
  disabled = false,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange"> & {
  options: ComboboxOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
  name?: string
  required?: boolean
}) {
  const trigger = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)
  const [inner, setInner] = React.useState(defaultValue)
  const current = value ?? inner
  const selected = options.find(option => option.id === current)

  function select(next: string) {
    setInner(next)
    onValueChange?.(next)
    setOpen(false)
  }

  return (
    <div data-slot="combobox" className={cn("relative", className)}>
      <input
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={trigger}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between border-input px-3 font-normal", current && "pr-16")}
            {...props}
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
            <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    keywords={[option.label, option.detail ?? "", option.search ?? ""]}
                    onSelect={() => select(option.id)}
                  >
                    <CheckIcon className={cn(option.id === current ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="flex flex-col">
                      <strong className="font-medium">{option.label}</strong>
                      {option.detail && <span className="text-sm text-muted-foreground">{option.detail}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {current && !required && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="ล้างตัวเลือก"
          className="absolute top-1/2 right-8 -translate-y-1/2"
          onClick={() => {
            trigger.current?.focus()
            select("")
          }}
        >
          <XIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export { Combobox, type ComboboxOption }
