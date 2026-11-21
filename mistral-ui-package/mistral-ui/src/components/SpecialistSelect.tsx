import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { glass, type ThemeMode } from "../theme/glass";

export type SpecialistOption<T extends string> = {
  value: T;
  label: string;
  tone?: string;
};

// Adapted from UI Forge shadcn/select: portal, Popper placement, scroll buttons,
// ItemText and ItemIndicator. Mistral supplies the glass surface and motion.
export function SpecialistSelect<T extends string>({ label, value, options, onChange, theme, Icon }: {
  label: string;
  value: T;
  options: readonly SpecialistOption<T>[];
  onChange: (value: T) => void;
  theme: ThemeMode;
  Icon?: LucideIcon;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger aria-label={label} className="sp-filter sp-select-trigger">
        {Icon && <Icon size={15} aria-hidden="true" />}
        <Select.Value />
        <Select.Icon asChild><ChevronDown size={14} className="sp-chevron" aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" align="end" sideOffset={7} collisionPadding={12} aria-label={label}
          className="sp-popup sp-select-popup" data-theme={theme} style={glass(theme).surface}>
          <Select.ScrollUpButton className="sp-popup-scroll"><ChevronUp size={15} /></Select.ScrollUpButton>
          <Select.Viewport className="sp-popup-items">
            {options.map((option) => (
              <Select.Item value={option.value} key={option.value} className="sp-popup-item">
                {option.tone && <span aria-hidden="true" className="sp-option-dot" style={{ backgroundColor: option.tone }} />}
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="sp-option-check"><Check aria-hidden="true" size={15} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="sp-popup-scroll"><ChevronDown size={15} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
