import * as React from "react";
import { DayPicker, DayButton } from "react-day-picker";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3", className)}
      components={{
        DayButton: CalendarDayButton,
        ...props.components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        // base
        "h-9 w-9 rounded-md text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "ring-offset-background",

        // selected/range states
        modifiers.selected && "bg-primary text-primary-foreground hover:bg-primary",
        modifiers.range_middle && "bg-accent text-accent-foreground rounded-none",
        modifiers.range_start && "bg-primary text-primary-foreground rounded-l-md",
        modifiers.range_end && "bg-primary text-primary-foreground rounded-r-md",

        // today
        modifiers.today && !modifiers.selected && "border border-ring",

        // disabled/outside
        (modifiers.disabled || modifiers.outside) && "text-muted-foreground opacity-50 hover:bg-transparent",

        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
