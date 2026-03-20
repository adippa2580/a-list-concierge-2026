import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

// ── Select Root ──────────────────────────────────────────────────────────────
interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
});

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

function Select({ value: controlledValue, defaultValue = "", onValueChange, children }: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) setUncontrolledValue(newValue);
      onValueChange?.(newValue);
      setOpen(false);
    },
    [controlledValue, onValueChange]
  );

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

// ── SelectTrigger ─────────────────────────────────────────────────────────────
interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(SelectContext);
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#E5E4E2]/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn("h-4 w-4 text-white/40 transition-transform", open && "rotate-180")}
        />
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

// ── SelectValue ───────────────────────────────────────────────────────────────
interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = React.useContext(SelectContext);
  return (
    <span className={cn(!value && "text-white/30")}>
      {value || placeholder}
    </span>
  );
}

// ── SelectContent ─────────────────────────────────────────────────────────────
interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
}

function SelectContent({ className, children }: SelectContentProps) {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-white/10 bg-zinc-900 shadow-2xl",
        className
      )}
    >
      <div className="p-1">{children}</div>
    </div>
  );
}

// ── SelectItem ────────────────────────────────────────────────────────────────
interface SelectItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function SelectItem({ value, className, children }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white",
        isSelected && "bg-white/10 text-white font-medium",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
