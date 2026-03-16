import * as React from "react"
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react"
import { MeshGradient } from "@paper-design/shaders-react"
import { addDays, format, isSameDay, parseISO, startOfToday } from "date-fns"
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconCommand,
  IconCopy,
  IconHelp,
  IconMoon,
  IconNotes,
  IconPalette,
  IconPlayerPause,
  IconPlayerPlay,
  IconSearch,
  IconSparkles,
  IconSun,
  IconWaveSawTool,
} from "@tabler/icons-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  BRIDGE_DELAY_MS,
  commandCenterReducer,
  getPrediction,
  getSuggestions,
  getUtilityDefinition,
  getUtilityTitle,
  initialCommandCenterState,
  MORPH_IN_MS,
  MORPH_OUT_MS,
  PREVIEW_DELAY_MS,
  SUCCESS_DWELL_MS,
  type SessionMemory,
  type UtilityId,
} from "@/features/morphing-command-center/model"

type UtilityLaunchHandler = (utilityId: UtilityId) => void

const TODAY = startOfToday()

const SEARCH_PREVIEW_CARDS = [
  {
    title: "Schedule a crit session",
    description: "Jump into the curated scheduler with afternoon availability.",
    utilityId: "calendar" as const,
  },
  {
    title: "Pick an accent color",
    description: "Open the hue wheel and copy a production-ready hex token.",
    utilityId: "color" as const,
  },
  {
    title: "Open a focus sprint",
    description: "Launch a lightweight timer without leaving the hero object.",
    utilityId: "timer" as const,
  },
]

function createAvailability() {
  const patterns = [
    ["09:30", "11:00", "13:30", "16:00"],
    ["10:15", "12:45", "15:15"],
    ["08:45", "14:15", "17:30"],
    ["11:30", "13:00", "15:45", "18:15"],
  ]

  return Array.from({ length: 9 }, (_, index) => {
    const date = addDays(TODAY, index)
    const slots = patterns[index % patterns.length]

    return {
      date,
      key: format(date, "yyyy-MM-dd"),
      slots,
    }
  })
}

const AVAILABILITY = createAvailability()

function hslToHex(hue: number) {
  const saturation = 84
  const lightness = 58
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2

  let red = 0
  let green = 0
  let blue = 0

  if (hue < 60) {
    red = c
    green = x
  } else if (hue < 120) {
    red = x
    green = c
  } else if (hue < 180) {
    green = c
    blue = x
  } else if (hue < 240) {
    green = x
    blue = c
  } else if (hue < 300) {
    red = x
    blue = c
  } else {
    red = c
    blue = x
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "")
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : normalized

  const parsed = Number.parseInt(value, 16)

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, "0")

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixHex(colorA: string, colorB: string, weight = 0.5) {
  const left = hexToRgb(colorA)
  const right = hexToRgb(colorB)
  const ratio = Math.max(0, Math.min(1, weight))

  return rgbToHex(
    left.r * (1 - ratio) + right.r * ratio,
    left.g * (1 - ratio) + right.g * ratio,
    left.b * (1 - ratio) + right.b * ratio
  )
}

function getUtilityIcon(utilityId: UtilityId | null) {
  switch (utilityId) {
    case "calendar":
      return IconCalendarEvent
    case "color":
      return IconPalette
    case "theme":
      return IconSun
    case "notes":
      return IconNotes
    case "timer":
      return IconClockHour4
    case "search-results":
      return IconSearch
    case "quick-actions":
    default:
      return IconSparkles
  }
}

function renderUtilityIcon(utilityId: UtilityId | null, className?: string) {
  const Icon = getUtilityIcon(utilityId)
  return <Icon className={className} />
}

function getSelectionSurface(isDarkTheme: boolean) {
  return isDarkTheme
    ? "color-mix(in oklch, var(--command-accent) 24%, rgb(15 23 42))"
    : "color-mix(in oklch, var(--command-accent) 12%, white)"
}

function getIconChipSurface(isDarkTheme: boolean) {
  return isDarkTheme ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.92)"
}

function getShellWidth(utilityId: UtilityId | null, mode: string) {
  if (
    mode === "idle" ||
    mode === "querying" ||
    mode === "predicting" ||
    mode === "bridging"
  ) {
    return "max-w-[46rem]"
  }

  switch (utilityId) {
    case "calendar":
      return "max-w-[68rem]"
    case "color":
      return "max-w-[60rem]"
    case "search-results":
      return "max-w-[56rem]"
    case "notes":
      return "max-w-[54rem]"
    default:
      return "max-w-[48rem]"
  }
}

function getRingPoint(hue: number, radius: number) {
  const angle = (hue - 90) * (Math.PI / 180)

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
}

function SuccessOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute inset-x-4 top-4 z-30 rounded-[1.4rem] border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-950 shadow-[0_18px_60px_rgba(32,129,89,0.24)] backdrop-blur md:inset-x-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-800">
          <IconCheck className="size-4" />
        </span>
        <div>
          <div className="font-medium">Action complete</div>
          <div className="text-emerald-950/70">{message}</div>
        </div>
      </div>
    </motion.div>
  )
}

function QuickActionsUtility({ onLaunch }: { onLaunch: UtilityLaunchHandler }) {
  const actions = [
    {
      utilityId: "calendar" as const,
      title: "Open calendar",
      description: "Curated slots for fast scheduling.",
      icon: IconCalendarEvent,
    },
    {
      utilityId: "color" as const,
      title: "Pick a color",
      description: "Hue wheel with copy-ready output.",
      icon: IconPalette,
    },
    {
      utilityId: "theme" as const,
      title: "Toggle appearance",
      description: "Switch light, dark, or system mode.",
      icon: IconSun,
    },
    {
      utilityId: "timer" as const,
      title: "Start timer",
      description: "Launch a focused sprint in one move.",
      icon: IconClockHour4,
    },
    {
      utilityId: "notes" as const,
      title: "Create note",
      description: "Capture a quick thought without context switching.",
      icon: IconNotes,
    },
    {
      utilityId: "search-results" as const,
      title: "Keyboard help",
      description: "Preview the command center's supported intents.",
      icon: IconHelp,
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {actions.map((action, index) => {
        const Icon = action.icon

        return (
          <motion.button
            key={action.title}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * index, duration: 0.24 }}
            onClick={() => onLaunch(action.utilityId)}
            className="group relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-white/60 p-4 text-left shadow-[0_18px_48px_rgba(24,35,52,0.08)] transition-colors hover:border-[color:var(--command-accent)] hover:bg-white dark:border-white/10 dark:bg-white/8 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)] dark:hover:bg-white/12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_58%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_58%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklch,var(--command-accent)_18%,white)] text-[color:var(--command-ink)] dark:bg-[color:color-mix(in_oklch,var(--command-accent)_22%,rgb(15_23_42))]">
                  <Icon className="size-5" />
                </div>
                <div className="font-medium text-[color:var(--command-ink)]">
                  {action.title}
                </div>
                <div className="mt-1 text-sm text-[color:var(--command-muted)]">
                  {action.description}
                </div>
              </div>
              <IconArrowRight className="mt-1 size-4 text-[color:var(--command-muted)] transition-transform group-hover:translate-x-1" />
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

function CalendarUtility({
  memory,
  onMemoryChange,
  onComplete,
  isCompact,
}: {
  memory: SessionMemory["calendar"]
  onMemoryChange: (value: Partial<SessionMemory["calendar"]>) => void
  onComplete: (message: string) => void
  isCompact: boolean
}) {
  const selectedDate = memory.selectedDate
    ? parseISO(memory.selectedDate)
    : TODAY
  const availability =
    AVAILABILITY.find((item) => isSameDay(item.date, selectedDate)) ??
    AVAILABILITY[0]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-5">
      <div
        className={cn(
          "rounded-[1.9rem] border border-white/12 bg-white/78 shadow-[0_20px_64px_rgba(26,36,52,0.08)] dark:border-white/10 dark:bg-white/7 dark:shadow-[0_24px_60px_rgba(0,0,0,0.34)]",
          isCompact ? "p-2.5 sm:p-4" : "p-4"
        )}
        style={{
          ["--primary" as string]: "var(--command-accent)",
          ["--primary-foreground" as string]: "#fff8f5",
          ["--muted" as string]: isSameDay(selectedDate, TODAY)
            ? "color-mix(in oklch, var(--command-accent) 14%, white)"
            : "var(--muted)",
        }}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(nextDate) => {
            if (!nextDate) {
              return
            }

            onMemoryChange({
              selectedDate: format(nextDate, "yyyy-MM-dd"),
              selectedSlot: null,
            })
          }}
          buttonVariant="outline"
          classNames={{
            root: "w-full bg-transparent",
            months: "relative flex w-full flex-col gap-4",
            month: "flex w-full min-w-0 flex-col gap-3",
            month_caption:
              "flex h-(--cell-size) w-full min-w-0 items-center justify-center px-10 text-[color:var(--command-ink)] sm:px-(--cell-size)",
            caption_label:
              "font-medium text-[color:var(--command-ink)] [&>svg]:text-[color:var(--command-muted)]",
            table: "w-full table-fixed border-collapse",
            weekday:
              "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-[color:var(--command-muted)] select-none",
            week: "mt-2 flex w-full",
            day: "group/day relative aspect-square h-full min-w-0 w-full rounded-(--cell-radius) p-0 text-center select-none",
            week_number:
              "text-[0.8rem] text-[color:var(--command-muted)] select-none",
            dropdown_root:
              "relative rounded-(--cell-radius) border border-border/70 bg-background/80 text-[color:var(--command-ink)] dark:border-white/10 dark:bg-white/8",
            button_previous:
              "border-border/70 bg-background/80 text-[color:var(--command-ink)] hover:bg-background dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12",
            button_next:
              "border-border/70 bg-background/80 text-[color:var(--command-ink)] hover:bg-background dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12",
            today:
              "rounded-(--cell-radius) bg-[color:color-mix(in_oklch,var(--command-accent)_14%,white)] text-[color:var(--command-ink)] data-[selected=true]:rounded-none dark:bg-[color:color-mix(in_oklch,var(--command-accent)_18%,rgb(15_23_42))]",
            outside:
              "text-[color:var(--command-muted)]/70 aria-selected:text-[color:var(--command-muted)]/70",
            disabled: "text-[color:var(--command-muted)] opacity-50",
          }}
          className="mx-auto w-full bg-transparent p-0"
          style={{
            ["--cell-size" as string]: isCompact ? "2.35rem" : "3rem",
          }}
        />
      </div>
      <div
        className={cn(
          "rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,236,0.78))] shadow-[0_20px_64px_rgba(26,36,52,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,28,42,0.94),rgba(11,18,30,0.9))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.34)]",
          isCompact ? "p-4" : "p-5"
        )}
      >
        <div className="text-xs font-medium tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
          Curated availability
        </div>
        <h3 className="mt-2 text-xl font-medium text-[color:var(--command-ink)]">
          {format(selectedDate, "EEEE, MMMM d")}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--command-muted)]">
          Select a slot to confirm a 45-minute design systems review.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {availability.slots.map((slot) => {
            const selected = memory.selectedSlot === slot

            return (
              <Button
                key={slot}
                variant={selected ? "default" : "outline"}
                className={cn(
                  "h-auto min-h-11 justify-between rounded-2xl px-4 py-3.5 text-sm sm:text-base",
                  selected &&
                    "bg-[color:var(--command-accent)] text-white hover:bg-[color:var(--command-accent-strong)]"
                )}
                onClick={() => onMemoryChange({ selectedSlot: slot })}
              >
                <span>{slot}</span>
                <IconClockHour4 className="size-4" />
              </Button>
            )
          })}
        </div>
        <div className="mt-5 rounded-[1.4rem] border border-black/6 bg-white/70 p-4 text-sm text-[color:var(--command-muted)] dark:border-white/10 dark:bg-white/8">
          <div className="font-medium text-[color:var(--command-ink)]">
            Selected flow
          </div>
          <div className="mt-1">
            {memory.selectedSlot
              ? `${format(selectedDate, "EEE, MMM d")} at ${memory.selectedSlot}`
              : "Choose a slot to prepare the confirmation state."}
          </div>
        </div>
        <Button
          className="mt-5 h-11 w-full rounded-2xl bg-[color:var(--command-accent)] text-white hover:bg-[color:var(--command-accent-strong)]"
          disabled={!memory.selectedSlot}
          onClick={() =>
            onComplete(
              `Booked a session for ${format(selectedDate, "MMMM d")} at ${memory.selectedSlot}.`
            )
          }
        >
          Confirm slot
        </Button>
      </div>
    </div>
  )
}

function ColorUtility({
  memory,
  onMemoryChange,
  onComplete,
  isCompact,
}: {
  memory: SessionMemory["color"]
  onMemoryChange: (value: Partial<SessionMemory["color"]>) => void
  onComplete: (message: string) => void
  isCompact: boolean
}) {
  const ringRef = React.useRef<HTMLDivElement | null>(null)
  const pointerDownRef = React.useRef(false)

  const hue = memory.hue
  const hex = memory.hex
  const ringRadius = isCompact ? 76 : 92
  const ringPoint = getRingPoint(hue, ringRadius)

  const setHueFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const element = ringRef.current
      if (!element) {
        return
      }

      const bounds = element.getBoundingClientRect()
      const centerX = bounds.left + bounds.width / 2
      const centerY = bounds.top + bounds.height / 2
      const angle = Math.atan2(clientY - centerY, clientX - centerX)
      const nextHue = (angle * 180) / Math.PI + 90
      const normalized = (nextHue + 360) % 360

      onMemoryChange({
        hue: normalized,
        hex: hslToHex(normalized),
      })
    },
    [onMemoryChange]
  )

  React.useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!pointerDownRef.current) {
        return
      }

      setHueFromPointer(event.clientX, event.clientY)
    }

    const handleUp = () => {
      pointerDownRef.current = false
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)

    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [setHueFromPointer])

  const tonalSwatches = [0.24, 0.45, 0.68, 0.88].map((alpha) => ({
    alpha,
    value: `color-mix(in oklch, ${hex} ${Math.round(alpha * 100)}%, white)`,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)] lg:gap-5">
      <div className="flex flex-col items-center justify-center rounded-[1.9rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,241,236,0.82))] p-6 shadow-[0_20px_64px_rgba(26,36,52,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,28,42,0.94),rgba(11,18,30,0.9))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
        <div
          ref={ringRef}
          role="slider"
          tabIndex={0}
          aria-label="Hue wheel"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(hue)}
          onPointerDown={(event) => {
            pointerDownRef.current = true
            ringRef.current?.setPointerCapture?.(event.pointerId)
            setHueFromPointer(event.clientX, event.clientY)
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 3
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault()
              const nextHue = (hue + step) % 360
              onMemoryChange({ hue: nextHue, hex: hslToHex(nextHue) })
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault()
              const nextHue = (hue - step + 360) % 360
              onMemoryChange({ hue: nextHue, hex: hslToHex(nextHue) })
            }
          }}
          className={cn(
            "relative flex touch-none items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--command-accent)]/20",
            isCompact ? "size-[12rem]" : "size-[15rem]"
          )}
          style={{
            background:
              "conic-gradient(#ff5b6e, #ffab4f, #e4d349, #57d17a, #43d4db, #4e79ff, #8b5cf6, #ff5b6e)",
          }}
        >
          <div className="absolute inset-[1.35rem] rounded-full border border-white/50 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.92),rgba(252,247,241,0.74))] shadow-inner dark:border-white/10 dark:bg-[radial-gradient(circle_at_50%_45%,rgba(20,30,46,0.96),rgba(10,15,26,0.96))]" />
          <div
            className="absolute h-5 w-5 rounded-full border-4 border-white shadow-lg"
            style={{
              backgroundColor: hex,
              transform: `translate(${ringPoint.x}px, ${ringPoint.y}px)`,
            }}
          />
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-full border border-black/6 bg-white/88 text-center shadow-[0_18px_32px_rgba(24,35,52,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/8 dark:shadow-[0_18px_32px_rgba(0,0,0,0.34)]",
              isCompact ? "size-24" : "size-28"
            )}
          >
            <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
              Accent
            </div>
            <div className="mt-1 font-mono text-sm font-medium text-[color:var(--command-ink)]">
              {hex}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-[1.9rem] border border-white/12 bg-white/78 p-5 shadow-[0_20px_64px_rgba(26,36,52,0.08)] dark:border-white/10 dark:bg-white/7 dark:shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
        <div className="text-xs font-medium tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
          Live output
        </div>
        <h3 className="mt-2 text-xl font-medium text-[color:var(--command-ink)]">
          Copy-ready accent
        </h3>
        <p className="mt-1 text-sm text-[color:var(--command-muted)]">
          The wheel drives a real hex value while the surrounding surfaces react
          in-place.
        </p>
        <div className="mt-5 grid gap-3 rounded-[1.6rem] border border-black/6 bg-white p-4 md:grid-cols-[1.2fr_0.8fr] dark:border-white/10 dark:bg-white/7">
          <div
            className="min-h-32 rounded-[1.2rem] p-4 text-white shadow-inner"
            style={{ backgroundColor: hex }}
          >
            <div className="text-xs tracking-[0.24em] text-white/72 uppercase">
              Preview
            </div>
            <div className="mt-3 text-lg font-medium">
              Senior Interface Accent
            </div>
            <div className="mt-1 max-w-xs text-sm text-white/82">
              Tuned for the command center's morph shell and supporting
              controls.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tonalSwatches.map((swatch) => (
              <div
                key={swatch.alpha}
                className="rounded-[1rem] border border-black/6 p-3 dark:border-white/10"
                style={{ background: swatch.value }}
              >
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--command-muted)] uppercase">
                  Tone
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            className="h-11 flex-1 rounded-2xl bg-[color:var(--command-accent)] text-white hover:bg-[color:var(--command-accent-strong)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(hex)
                onComplete(`Copied ${hex} to the clipboard.`)
              } catch {
                onComplete(`Prepared ${hex} for copying.`)
              }
            }}
          >
            <IconCopy className="size-4" />
            Copy hex
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl"
            onClick={() => {
              const nextHue = 18
              onMemoryChange({ hue: nextHue, hex: hslToHex(nextHue) })
            }}
          >
            Reset to studio accent
          </Button>
        </div>
      </div>
    </div>
  )
}

function SearchResultsUtility({
  query,
  onLaunch,
}: {
  query: string
  onLaunch: UtilityLaunchHandler
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {SEARCH_PREVIEW_CARDS.map((card) => (
        <button
          key={card.title}
          type="button"
          onClick={() => onLaunch(card.utilityId)}
          className="rounded-[1.6rem] border border-white/12 bg-white/72 p-4 text-left shadow-[0_18px_48px_rgba(24,35,52,0.08)] transition-colors hover:bg-white dark:border-white/10 dark:bg-white/8 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)] dark:hover:bg-white/12"
        >
          <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
            Search fallback
          </div>
          <div className="mt-2 font-medium text-[color:var(--command-ink)]">
            {card.title}
          </div>
          <div className="mt-2 text-sm text-[color:var(--command-muted)]">
            {card.description}
          </div>
          <div className="mt-4 text-xs font-medium break-words text-[color:var(--command-accent-strong)]">
            Routed from “{query}”
          </div>
        </button>
      ))}
    </div>
  )
}

function ThemeUtility({
  currentTheme,
  onApply,
  isCompact,
}: {
  currentTheme: "light" | "dark" | "system"
  onApply: (value: "light" | "dark" | "system") => void
  isCompact: boolean
}) {
  const options = [
    { value: "light" as const, title: "Light", icon: IconSun },
    { value: "dark" as const, title: "Dark", icon: IconMoon },
    { value: "system" as const, title: "System", icon: IconWaveSawTool },
  ]

  return (
    <div
      className={cn(
        "grid gap-3",
        isCompact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      )}
    >
      {options.map((option) => {
        const Icon = option.icon

        return (
          <Button
            key={option.value}
            variant={currentTheme === option.value ? "default" : "outline"}
            className={cn(
              "h-auto min-h-12 flex-col gap-3 rounded-[1.6rem] border-border/70 bg-background/80 px-4 py-4 text-[color:var(--command-ink)] shadow-[0_18px_40px_rgba(25,35,52,0.08)] hover:bg-background md:h-28 dark:border-white/10 dark:bg-white/8 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)] dark:hover:bg-white/12",
              currentTheme === option.value &&
                "bg-[color:var(--command-accent)] text-white hover:bg-[color:var(--command-accent-strong)] dark:bg-[color:var(--command-accent)] dark:text-white dark:hover:bg-[color:var(--command-accent-strong)]"
            )}
            onClick={() => onApply(option.value)}
          >
            <Icon className="size-5" />
            {option.title}
          </Button>
        )
      })}
      <div className="rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-3 text-sm text-[color:var(--command-muted)] md:col-span-3 dark:border-white/10 dark:bg-white/8">
        Theme changes apply immediately. Use Back or Esc to return.
      </div>
    </div>
  )
}

function NotesUtility({
  draft,
  onDraftChange,
  onComplete,
  isCompact,
}: {
  draft: string
  onDraftChange: (value: string) => void
  onComplete: (message: string) => void
  isCompact: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-[1.8rem] border border-white/12 bg-white/78 p-4 shadow-[0_18px_48px_rgba(24,35,52,0.08)] dark:border-white/10 dark:bg-white/7 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
        <Textarea
          aria-label="Quick note"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Capture a thought, a task, or a launch note..."
          className={cn(
            "rounded-[1.4rem] border-none bg-transparent px-0 py-0 shadow-none focus-visible:ring-0",
            isCompact ? "min-h-32" : "min-h-44"
          )}
        />
      </div>
      <div className="rounded-[1.8rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,236,0.82))] p-4 shadow-[0_18px_48px_rgba(24,35,52,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,28,42,0.94),rgba(11,18,30,0.9))] dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
        <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
          Note utility
        </div>
        <p className="mt-2 text-sm text-[color:var(--command-muted)]">
          Lightweight by design so the hero morphs stay focused on the stronger
          visual utilities.
        </p>
        <Button
          className="mt-6 h-11 w-full rounded-2xl bg-[color:var(--command-accent)] text-white hover:bg-[color:var(--command-accent-strong)]"
          disabled={!draft.trim()}
          onClick={() =>
            onComplete("Saved the note and returned to command mode.")
          }
        >
          Save note
        </Button>
      </div>
    </div>
  )
}

function TimerUtility({
  memory,
  onMemoryChange,
  onComplete,
  isCompact,
}: {
  memory: SessionMemory["timer"]
  onMemoryChange: (value: Partial<SessionMemory["timer"]>) => void
  onComplete: (message: string) => void
  isCompact: boolean
}) {
  React.useEffect(() => {
    if (!memory.running || memory.remaining <= 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      onMemoryChange({ remaining: Math.max(0, memory.remaining - 1) })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [memory.remaining, memory.running, onMemoryChange])

  React.useEffect(() => {
    if (memory.running && memory.remaining === 0) {
      onMemoryChange({ running: false })
      onComplete("Completed the focus sprint.")
    }
  }, [memory.remaining, memory.running, onComplete, onMemoryChange])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-[1.8rem] border border-white/12 bg-white/78 p-5 shadow-[0_18px_48px_rgba(24,35,52,0.08)] dark:border-white/10 dark:bg-white/7 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
              Focus sprint
            </div>
            <div className="mt-2 text-4xl font-medium text-[color:var(--command-ink)]">
              {formatDuration(memory.remaining)}
            </div>
          </div>
          <div className="rounded-full border border-black/6 bg-white px-3 py-1 text-sm text-[color:var(--command-muted)] dark:border-white/10 dark:bg-white/8">
            {memory.duration} min target
          </div>
        </div>
        <div className="mt-8">
          <div
            style={{
              ["--primary" as string]: "var(--command-accent)",
              ["--primary-foreground" as string]: "#fff8f5",
            }}
          >
            <Slider
              className={cn(
                isCompact &&
                  "[&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-4"
              )}
              value={[memory.duration]}
              min={5}
              max={60}
              step={5}
              onValueChange={(nextValue) => {
                const nextDuration = Array.isArray(nextValue)
                  ? (nextValue[0] ?? memory.duration)
                  : nextValue

                onMemoryChange({
                  duration: nextDuration,
                  remaining: nextDuration * 60,
                  running: false,
                })
              }}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            className="h-11 flex-1 rounded-2xl bg-[color:var(--command-accent)] text-sm whitespace-nowrap text-white hover:bg-[color:var(--command-accent-strong)] sm:text-base"
            onClick={() => onMemoryChange({ running: !memory.running })}
          >
            {memory.running ? (
              <IconPlayerPause className="size-4" />
            ) : (
              <IconPlayerPlay className="size-4" />
            )}
            {memory.running
              ? isCompact
                ? "Pause timer"
                : "Pause sprint"
              : isCompact
                ? "Start timer"
                : "Start sprint"}
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl"
            onClick={() =>
              onMemoryChange({
                remaining: memory.duration * 60,
                running: false,
              })
            }
          >
            Reset
          </Button>
        </div>
      </div>
      <div className="rounded-[1.8rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,236,0.82))] p-4 shadow-[0_18px_48px_rgba(24,35,52,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,28,42,0.94),rgba(11,18,30,0.9))] dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
        <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
          Gesture-ready
        </div>
        <p className="mt-2 text-sm text-[color:var(--command-muted)]">
          This lighter v1 version keeps the tactile shell and supporting timing
          states while we reserve deeper physics for the dashboard demo.
        </p>
      </div>
    </div>
  )
}

function UtilityStage({
  utilityId,
  query,
  memory,
  onLaunch,
  onComplete,
  onUpdateMemory,
  isCompact,
}: {
  utilityId: UtilityId
  query: string
  memory: SessionMemory
  onLaunch: UtilityLaunchHandler
  onComplete: (message: string) => void
  onUpdateMemory: <T extends keyof SessionMemory>(
    utility: T,
    value: Partial<SessionMemory[T]>
  ) => void
  isCompact: boolean
}) {
  const { theme, setTheme } = useTheme()

  switch (utilityId) {
    case "calendar":
      return (
        <CalendarUtility
          memory={memory.calendar}
          onMemoryChange={(value) => onUpdateMemory("calendar", value)}
          onComplete={onComplete}
          isCompact={isCompact}
        />
      )
    case "color":
      return (
        <ColorUtility
          memory={memory.color}
          onMemoryChange={(value) => onUpdateMemory("color", value)}
          onComplete={onComplete}
          isCompact={isCompact}
        />
      )
    case "theme":
      return (
        <ThemeUtility
          currentTheme={theme}
          isCompact={isCompact}
          onApply={(value) => {
            setTheme(value)
            onUpdateMemory("theme", { value })
          }}
        />
      )
    case "notes":
      return (
        <NotesUtility
          draft={memory.notes.draft}
          onDraftChange={(value) => onUpdateMemory("notes", { draft: value })}
          onComplete={onComplete}
          isCompact={isCompact}
        />
      )
    case "timer":
      return (
        <TimerUtility
          memory={memory.timer}
          onMemoryChange={(value) => onUpdateMemory("timer", value)}
          onComplete={onComplete}
          isCompact={isCompact}
        />
      )
    case "search-results":
      return <SearchResultsUtility query={query} onLaunch={onLaunch} />
    case "quick-actions":
    default:
      return <QuickActionsUtility onLaunch={onLaunch} />
  }
}

export function MorphingCommandCenter() {
  const { theme } = useTheme()
  const [state, dispatch] = React.useReducer(
    commandCenterReducer,
    initialCommandCenterState
  )
  const reducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listboxId = React.useId()
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light"
  )
  const [isCompactHeight, setIsCompactHeight] = React.useState(false)

  const suggestions = React.useMemo(
    () => getSuggestions(state.query),
    [state.query]
  )
  const prediction = React.useMemo(
    () => getPrediction(state.query),
    [state.query]
  )
  const highlightedSuggestion =
    suggestions.find((item) => item.id === state.highlightedSuggestionId) ??
    suggestions[0] ??
    null
  const currentUtility =
    state.activeUtility ??
    state.bridgeUtility ??
    state.predictedUtility ??
    "quick-actions"
  const isDefaultCommandState = !state.query.trim()
  const isDarkTheme = resolvedTheme === "dark"
  const isCompact = isMobile || isCompactHeight
  const shaderColors = React.useMemo(() => {
    const accent = state.sessionMemory.color.hex

    if (isDarkTheme) {
      return [
        "#0b1320",
        "#162033",
        mixHex(accent, "#0f172a", 0.38),
        mixHex(accent, "#6b7280", 0.16),
      ]
    }

    return [
      "#f7efe4",
      "#efe3d0",
      mixHex(accent, "#fff7f2", 0.36),
      mixHex(accent, "#f1e6da", 0.2),
    ]
  }, [isDarkTheme, state.sessionMemory.color.hex])

  React.useEffect(() => {
    const handleViewport = () => {
      setIsCompactHeight(window.innerHeight < 780)
    }

    handleViewport()
    window.addEventListener("resize", handleViewport)

    return () => {
      window.removeEventListener("resize", handleViewport)
    }
  }, [])

  React.useEffect(() => {
    const resolveTheme = () => {
      if (theme === "system") {
        setResolvedTheme(
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
        )
        return
      }

      setResolvedTheme(theme)
    }

    resolveTheme()

    if (theme !== "system") {
      return undefined
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", resolveTheme)

    return () => mediaQuery.removeEventListener("change", resolveTheme)
  }, [theme])

  React.useEffect(() => {
    if (
      state.mode === "utility-active" ||
      state.mode === "utility-success" ||
      state.mode === "morphing-in" ||
      state.mode === "morphing-out"
    ) {
      return
    }

    if (
      state.predictedUtility === prediction.utilityId &&
      state.confidence === prediction.confidence
    ) {
      return
    }

    dispatch({
      type: "SET_PREDICTION",
      utilityId: prediction.utilityId,
      confidence: prediction.confidence,
      suggestionId: prediction.suggestionId,
    })
  }, [prediction, state.confidence, state.mode, state.predictedUtility])

  React.useEffect(() => {
    if (!suggestions.length) {
      return
    }

    const stillExists = suggestions.some(
      (suggestion) => suggestion.id === state.highlightedSuggestionId
    )

    if (!stillExists) {
      dispatch({
        type: "HIGHLIGHT_SUGGESTION",
        suggestionId: suggestions[0]?.id ?? null,
      })
    }
  }, [state.highlightedSuggestionId, suggestions])

  React.useEffect(() => {
    if (
      state.mode !== "predicting" ||
      !prediction.utilityId ||
      !prediction.shouldBridge
    ) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      dispatch({
        type: "ENTER_BRIDGE",
        utilityId: prediction.utilityId!,
        autoCommitted: prediction.exact,
      })
    }, PREVIEW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [prediction, state.mode])

  React.useEffect(() => {
    if (state.mode !== "bridging" || !state.bridgeUtility) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      dispatch({ type: "COMMIT_UTILITY", utilityId: state.bridgeUtility! })
    }, BRIDGE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [state.bridgeUtility, state.mode])

  React.useEffect(() => {
    if (state.mode !== "morphing-in") {
      return undefined
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "ACTIVATE_UTILITY" }),
      reducedMotion ? 120 : MORPH_IN_MS
    )

    return () => window.clearTimeout(timer)
  }, [reducedMotion, state.mode])

  React.useEffect(() => {
    if (state.mode !== "utility-success") {
      return undefined
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "START_MORPH_OUT" }),
      SUCCESS_DWELL_MS
    )

    return () => window.clearTimeout(timer)
  }, [state.mode])

  React.useEffect(() => {
    if (state.mode !== "morphing-out") {
      return undefined
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "FINISH_RETURN" }),
      reducedMotion ? 100 : MORPH_OUT_MS
    )

    return () => window.clearTimeout(timer)
  }, [reducedMotion, state.mode])

  React.useEffect(() => {
    if (!isCompact) {
      inputRef.current?.focus()
    }
  }, [isCompact])

  const launchUtility = React.useCallback((utilityId: UtilityId) => {
    dispatch({ type: "COMMIT_UTILITY", utilityId })
  }, [])

  const updateMemory = React.useCallback(
    <T extends keyof SessionMemory>(
      utilityId: T,
      value: Partial<SessionMemory[T]>
    ) => {
      dispatch({ type: "UPDATE_SESSION_MEMORY", utilityId, value })
    },
    []
  )

  const handleCommandKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      state.mode === "utility-active" ||
      state.mode === "morphing-in" ||
      state.mode === "utility-success"
    ) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      dispatch({ type: "CHANGE_QUERY", query: "" })
      return
    }

    if (!suggestions.length) {
      return
    }

    const currentIndex = suggestions.findIndex(
      (suggestion) => suggestion.id === state.highlightedSuggestionId
    )

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const nextSuggestion =
        suggestions[
          (currentIndex + 1 + suggestions.length) % suggestions.length
        ]
      dispatch({
        type: "HIGHLIGHT_SUGGESTION",
        suggestionId: nextSuggestion?.id ?? null,
      })
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      const nextSuggestion =
        suggestions[
          (currentIndex - 1 + suggestions.length) % suggestions.length
        ]
      dispatch({
        type: "HIGHLIGHT_SUGGESTION",
        suggestionId: nextSuggestion?.id ?? null,
      })
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (highlightedSuggestion) {
        launchUtility(highlightedSuggestion.utilityId)
      }
    }
  }

  React.useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }

      if (
        state.mode === "utility-active" ||
        state.mode === "morphing-in" ||
        state.mode === "utility-success"
      ) {
        event.preventDefault()
        dispatch({ type: "START_MORPH_OUT" })
        if (!isCompact) {
          window.setTimeout(() => inputRef.current?.focus(), MORPH_OUT_MS + 40)
        }
        return
      }

      if (state.query) {
        event.preventDefault()
        dispatch({ type: "CHANGE_QUERY", query: "" })
      }
    }

    window.addEventListener("keydown", handleGlobalEscape)

    return () => {
      window.removeEventListener("keydown", handleGlobalEscape)
    }
  }, [isCompact, state.mode, state.query])

  const activeDefinition = getUtilityDefinition(currentUtility)
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <div
      className="relative min-h-svh overflow-x-hidden overflow-y-auto bg-background text-foreground transition-colors"
      style={{
        ["--command-accent" as string]: state.sessionMemory.color.hex,
        ["--command-accent-strong" as string]: `color-mix(in oklch, ${state.sessionMemory.color.hex} 82%, black)`,
        ["--command-ink" as string]: isDarkTheme ? "#eef2ff" : "#172133",
        ["--command-muted" as string]: isDarkTheme
          ? "rgba(226,232,240,0.68)"
          : "rgba(23,33,51,0.64)",
      }}
    >
      <MeshGradient
        className="pointer-events-none absolute inset-0 h-full w-full"
        width="100%"
        height="100%"
        colors={shaderColors}
        distortion={isDarkTheme ? 0.5 : 0.58}
        swirl={isDarkTheme ? 0.08 : 0.1}
        grainMixer={0}
        grainOverlay={0}
        speed={isDarkTheme ? 0.42 : 0.5}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDarkTheme
            ? "linear-gradient(180deg, rgba(7,10,18,0.26), rgba(7,10,18,0.34))"
            : "linear-gradient(180deg, rgba(255,249,243,0.28), rgba(248,239,229,0.3))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background: isDarkTheme
            ? "radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 72%)"
            : "radial-gradient(circle at center, rgba(255,255,255,0.55), transparent 70%)",
        }}
      />

      <main className="relative mx-auto flex min-h-svh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div
          className={cn(
            "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 lg:gap-10",
            isCompact ? "justify-start pt-2 sm:pt-4" : "justify-center"
          )}
        >
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-[11px] font-medium tracking-[0.28em] text-[color:var(--command-muted)] uppercase shadow-[0_12px_28px_rgba(25,35,52,0.06)] backdrop-blur dark:shadow-[0_18px_42px_rgba(0,0,0,0.32)]">
              <IconCommand className="size-3.5" />
              Morphing Command Center
            </div>
            <h1 className="mx-auto max-w-3xl text-[clamp(2.2rem,6vw,5.4rem)] leading-[0.92] font-medium tracking-[-0.04em] text-[color:var(--command-ink)] sm:text-[clamp(2.6rem,6vw,5.4rem)]">
              Switchblade
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[0.9375rem] leading-5 text-[color:var(--command-muted)] sm:mt-4 sm:text-lg sm:leading-7">
              A command object that predicts intent, bridges search into action,
              and morphs into the right utility without losing spatial
              continuity.
            </p>
          </div>

          <LayoutGroup>
            <motion.section
              layout
              transition={{ duration: reducedMotion ? 0.12 : 0.48, ease }}
              className={cn(
                "relative mx-auto w-full rounded-[2.2rem] border border-white/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(251,247,241,0.72))] p-3 shadow-[0_36px_120px_rgba(27,37,54,0.14)] backdrop-blur-xl",
                "dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.86),rgba(13,19,32,0.8))] dark:shadow-[0_36px_120px_rgba(0,0,0,0.38)]",
                getShellWidth(currentUtility, state.mode),
                isMobile && "rounded-[1.8rem]"
              )}
            >
              <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.22))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
              <div className="absolute inset-x-12 top-0 h-px bg-white/60 dark:bg-white/12" />

              <div className="relative overflow-hidden rounded-[1.8rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,243,237,0.82))] p-4 shadow-inner sm:p-5 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(15,23,35,0.88),rgba(10,16,28,0.92))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <AnimatePresence>
                  {state.successMessage ? (
                    <SuccessOverlay message={state.successMessage} />
                  ) : null}
                </AnimatePresence>

                <motion.div
                  layout
                  className="flex items-center justify-between gap-3 pb-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <motion.div
                      layout
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-[color:var(--command-ink)] shadow-[0_14px_26px_rgba(25,35,52,0.08)] dark:shadow-[0_18px_34px_rgba(0,0,0,0.34)]"
                      style={{
                        background: isDarkTheme
                          ? "color-mix(in oklch, var(--command-accent) 22%, rgb(15 23 42))"
                          : "color-mix(in oklch, var(--command-accent) 16%, white)",
                      }}
                    >
                      {renderUtilityIcon(currentUtility, "size-5")}
                    </motion.div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
                        {state.mode === "utility-active" ||
                        state.mode === "morphing-in" ||
                        state.mode === "utility-success"
                          ? "Utility active"
                          : state.mode === "bridging"
                            ? "Bridge state"
                            : state.mode === "predicting"
                              ? "Intent detected"
                              : "Command mode"}
                      </div>
                      <div className="truncate text-base font-medium text-[color:var(--command-ink)] sm:text-lg">
                        {getUtilityTitle(currentUtility)}
                      </div>
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 text-xs text-[color:var(--command-muted)] md:flex">
                    <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/8">
                      <KbdGroup>
                        <Kbd>Esc</Kbd>
                        <span>to return</span>
                      </KbdGroup>
                    </div>
                    <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/8">
                      <KbdGroup>
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd>
                        <span>to navigate</span>
                      </KbdGroup>
                    </div>
                  </div>
                </motion.div>

                <motion.div layout className="mb-4">
                  <motion.div
                    layoutId="command-shell-input"
                    transition={{ duration: reducedMotion ? 0.12 : 0.4, ease }}
                    className="overflow-hidden rounded-[1.7rem] border border-border/70 bg-background/80 shadow-[0_18px_40px_rgba(25,35,52,0.08)] dark:border-white/10 dark:bg-white/8 dark:shadow-[0_22px_48px_rgba(0,0,0,0.32)]"
                  >
                    {state.mode === "utility-active" ||
                    state.mode === "morphing-in" ||
                    state.mode === "utility-success" ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <Button
                          variant="ghost"
                          size={isCompact ? "default" : "sm"}
                          className="h-11 rounded-full"
                          onClick={() => dispatch({ type: "START_MORPH_OUT" })}
                        >
                          Back
                        </Button>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
                            Active command
                          </div>
                          <div className="truncate font-medium text-[color:var(--command-ink)]">
                            {state.query || activeDefinition.command}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <InputGroup className="h-16 rounded-[1.7rem] border-none bg-transparent px-1 shadow-none dark:bg-transparent">
                        <InputGroupAddon className="pl-4 text-[color:var(--command-muted)]">
                          <IconSearch className="size-4.5" />
                        </InputGroupAddon>
                        <InputGroupInput
                          ref={inputRef}
                          value={state.query}
                          onChange={(event) =>
                            dispatch({
                              type: "CHANGE_QUERY",
                              query: event.target.value,
                            })
                          }
                          onKeyDown={handleCommandKeyDown}
                          role="combobox"
                          aria-expanded={suggestions.length > 0}
                          aria-controls={listboxId}
                          aria-activedescendant={
                            highlightedSuggestion
                              ? `${listboxId}-${highlightedSuggestion.id}`
                              : undefined
                          }
                          aria-autocomplete="list"
                          placeholder="Try: schedule a session, color, new note, timer, help"
                          className="h-16 text-[0.95rem] text-[color:var(--command-ink)] placeholder:text-[color:var(--command-muted)] sm:text-base md:text-lg dark:placeholder:text-white/45"
                        />
                        <InputGroupAddon align="inline-end" className="pr-4">
                          <div className="hidden items-center gap-2 text-xs text-[color:var(--command-muted)] md:flex">
                            <Kbd>Enter</Kbd>
                            <span>commit</span>
                          </div>
                        </InputGroupAddon>
                      </InputGroup>
                    )}
                  </motion.div>
                </motion.div>

                <motion.div
                  layout
                  className={cn("min-h-0", isCompact ? "" : "sm:min-h-[24rem]")}
                >
                  <AnimatePresence mode="wait">
                    {state.mode === "utility-active" ||
                    state.mode === "morphing-in" ||
                    state.mode === "utility-success" ? (
                      <motion.div
                        key={`utility-${currentUtility}`}
                        initial={{
                          opacity: 0,
                          y: reducedMotion ? 0 : 18,
                          scale: reducedMotion ? 1 : 0.98,
                        }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          y: reducedMotion ? 0 : -10,
                          scale: reducedMotion ? 1 : 0.98,
                        }}
                        transition={{
                          duration: reducedMotion ? 0.12 : 0.32,
                          ease,
                        }}
                        className="pt-2"
                      >
                        <UtilityStage
                          utilityId={currentUtility}
                          query={state.query}
                          memory={state.sessionMemory}
                          onLaunch={launchUtility}
                          onComplete={(message) =>
                            dispatch({ type: "COMPLETE_UTILITY", message })
                          }
                          onUpdateMemory={updateMemory}
                          isCompact={isCompact}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="command-mode"
                        initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }}
                        transition={{
                          duration: reducedMotion ? 0.12 : 0.26,
                          ease,
                        }}
                        className="mx-auto w-full max-w-3xl"
                      >
                        <div className="rounded-[1.7rem] border border-white/12 bg-white/66 p-3 shadow-[0_20px_56px_rgba(25,35,52,0.08)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_26px_64px_rgba(0,0,0,0.34)]">
                          <div className="mb-3 flex flex-col gap-3 px-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-xs tracking-[0.24em] text-[color:var(--command-muted)] uppercase">
                                Suggested routes
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--command-muted)] sm:text-sm">
                                Ranked by intent confidence and keyboard-ready
                                from the first keystroke.
                              </div>
                            </div>
                            <div className="self-start rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-[color:var(--command-muted)] sm:self-auto dark:border-white/10 dark:bg-white/10">
                              {state.query.trim()
                                ? `${Math.round(state.confidence * 100)}% confidence`
                                : "Ready for intent"}
                            </div>
                          </div>
                          <div
                            id={listboxId}
                            role="listbox"
                            className={cn(
                              "mt-2 gap-2",
                              isDefaultCommandState
                                ? "grid grid-cols-2 lg:grid-cols-3"
                                : "flex flex-col"
                            )}
                          >
                            {suggestions.map((suggestion) => {
                              const selected =
                                suggestion.id === highlightedSuggestion?.id
                              const Icon = getUtilityIcon(suggestion.utilityId)

                              return (
                                <motion.button
                                  key={suggestion.id}
                                  id={`${listboxId}-${suggestion.id}`}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onMouseEnter={() =>
                                    dispatch({
                                      type: "HIGHLIGHT_SUGGESTION",
                                      suggestionId: suggestion.id,
                                    })
                                  }
                                  onClick={() =>
                                    launchUtility(suggestion.utilityId)
                                  }
                                  className={cn(
                                    "group rounded-[1.35rem] border px-3 py-3 text-left transition-all",
                                    isDefaultCommandState
                                      ? "flex min-h-28 flex-col items-start justify-between gap-3 lg:min-h-34 lg:gap-4"
                                      : "flex items-center gap-3",
                                    selected
                                      ? "border-[color:var(--command-accent)] shadow-[0_14px_30px_rgba(24,35,52,0.08)] dark:shadow-[0_18px_36px_rgba(0,0,0,0.34)]"
                                      : "border-transparent bg-white/56 hover:border-black/8 hover:bg-white dark:bg-white/10 dark:hover:border-white/14 dark:hover:bg-white/14"
                                  )}
                                  style={
                                    selected
                                      ? {
                                          background:
                                            getSelectionSurface(isDarkTheme),
                                        }
                                      : undefined
                                  }
                                >
                                  <span
                                    className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-[color:var(--command-ink)] shadow-[0_10px_20px_rgba(24,35,52,0.05)] dark:shadow-[0_14px_24px_rgba(0,0,0,0.3)]"
                                    style={{
                                      background:
                                        getIconChipSurface(isDarkTheme),
                                    }}
                                  >
                                    <Icon className="size-4.5" />
                                  </span>
                                  <span
                                    className={cn(
                                      "min-w-0",
                                      isDefaultCommandState
                                        ? "block w-full"
                                        : "flex-1"
                                    )}
                                  >
                                    <span className="block text-sm font-medium text-[color:var(--command-ink)] sm:text-base">
                                      {suggestion.title}
                                    </span>
                                    <span
                                      className={cn(
                                        "mt-1 text-xs text-[color:var(--command-muted)] sm:text-sm",
                                        isDefaultCommandState
                                          ? "hidden lg:block"
                                          : "block"
                                      )}
                                    >
                                      {suggestion.description}
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs text-[color:var(--command-muted)]",
                                      isDefaultCommandState
                                        ? "inline-flex"
                                        : "hidden sm:inline-flex"
                                    )}
                                  >
                                    <Kbd>{suggestion.shortcut ?? "Go"}</Kbd>
                                  </span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.section>
          </LayoutGroup>
        </div>
      </main>
    </div>
  )
}

export default MorphingCommandCenter
