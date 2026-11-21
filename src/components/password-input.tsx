"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

// A text-labelled toggle (not an eye icon) so the state is announced and readable on every screen.
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [isShown, setIsShown] = useState(false);
  return <span className="relative flex">
    <Input {...props} type={isShown ? "text" : "password"} className="pr-24" />
    <button type="button" aria-pressed={isShown} aria-controls={props.id} onClick={() => setIsShown(value => !value)}
      className="absolute inset-y-1 right-1 min-w-20 cursor-pointer rounded-sm border-0 bg-muted px-2.5 text-sm font-semibold text-primary">
      {isShown ? "ซ่อน" : "แสดง"}
    </button>
  </span>;
}
