import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DayButton, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("bg-background p-3", className)}
      classNames={{
        ...defaultClassNames,

        root: cn("w-fit", defaultClassNames.root),

        months: cn("flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),

        caption: cn("relative flex items-center justify-center", defaultClassNames.caption),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),

        nav: cn(
          "absolute inset-x-0 top-0 flex items-center justify-between px-1",
          defaultClassNames.nav
        ),

        // nav buttons (no dependency on Button.tsx)
        button_previous: cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
          defaultClassNames.button_next
        ),

        table: cn("w-full border-collapse", defaultClassNames.table),
        head_row: cn("flex", defaultClassNames.head_row),
        head_cell: cn(
          "text-muted-foreground flex-1 rounded-md text-[0.8rem] font-normal",
          defaultClassNames.head_cell
        ),

        row: cn("mt-2 flex w-full", defaultClassNames.row),
        cell: cn("relative flex-1 p-0 text-center", defaultClassNames.cell),

        day: cn(
          "h-9 w-9 rounded-md text-sm hover:bg-accent hover:text-accent-foreground",
          defaultClassNames.day
        ),

        day_selected: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          defaultClassNames.day_selected
        ),

        day_today: cn(
          "border border-ring",
          defaultClassNames.day_today
        ),

        day_outside: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.day_outside
        ),

        day_disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.day_disabled
        ),

        day_range_start: cn(
          "bg-primary text-primary-foreground rounded-l-md",
          defaultClassNames.day_range_start
        ),
        day_range_end: cn(
          "bg-primary text-primary-foreground rounded-r-md",
          defaultClassNames.day_range_end
        ),
        day_range_middle: cn(
          "bg-accent text-accent-foreground rounded-none",
          defaultClassNames.day_range_middle
        ),

        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...p }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...p} />
        ),
        IconRight: ({ className, ...p }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...p} />
        ),
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
