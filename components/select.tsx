"use client";

import ReactSelect, { type Props } from "react-select";
import type { GroupBase } from "react-select";

export function Select<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(props: Props<Option, IsMulti, Group>) {
  return (
    <ReactSelect
      unstyled
      classNames={{
        control: ({ isFocused }) =>
          `w-full rounded-lg border bg-background px-2 py-1.5 text-xs ${
            isFocused ? "border-foreground/40" : "border-foreground/20"
          }`,
        menu: () =>
          "mt-1 rounded-lg border border-foreground/20 bg-background shadow-lg overflow-hidden",
        option: ({ isFocused, isSelected }) =>
          `px-2 py-1.5 text-xs cursor-pointer ${
            isSelected
              ? "bg-foreground text-background"
              : isFocused
                ? "bg-foreground/10"
                : ""
          }`,
        singleValue: () => "text-foreground",
        placeholder: () => "text-foreground/40",
        dropdownIndicator: () => "text-foreground/40",
        indicatorSeparator: () => "hidden",
        noOptionsMessage: () => "px-2 py-1.5 text-xs text-foreground/40",
        loadingMessage: () => "px-2 py-1.5 text-xs text-foreground/40",
      }}
      {...props}
    />
  );
}
