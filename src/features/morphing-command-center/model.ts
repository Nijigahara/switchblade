export type UtilityId =
  | "quick-actions"
  | "calendar"
  | "color"
  | "theme"
  | "notes"
  | "timer"
  | "search-results"

export type CommandMode =
  | "idle"
  | "querying"
  | "predicting"
  | "bridging"
  | "morphing-in"
  | "utility-active"
  | "utility-success"
  | "morphing-out"
  | "dismissed"

export type Suggestion = {
  id: string
  utilityId: UtilityId
  title: string
  description: string
  keywords: string[]
  command: string
  shortcut?: string
  score: number
  exact: boolean
  group: "hero" | "support" | "fallback"
}

export type SessionMemory = {
  calendar: {
    selectedDate: string | null
    selectedSlot: string | null
  }
  color: {
    hue: number
    hex: string
  }
  theme: {
    value: "light" | "dark" | "system"
  }
  notes: {
    draft: string
  }
  timer: {
    duration: number
    remaining: number
    running: boolean
  }
}

export type CommandCenterState = {
  mode: CommandMode
  query: string
  confidence: number
  predictedUtility: UtilityId | null
  bridgeUtility: UtilityId | null
  activeUtility: UtilityId | null
  highlightedSuggestionId: string | null
  lastActiveUtility: UtilityId | null
  successMessage: string | null
  autoCommitted: boolean
  sessionMemory: SessionMemory
}

export type CommandCenterAction =
  | { type: "CHANGE_QUERY"; query: string }
  | {
      type: "SET_PREDICTION"
      utilityId: UtilityId | null
      confidence: number
      suggestionId: string | null
    }
  | { type: "HIGHLIGHT_SUGGESTION"; suggestionId: string | null }
  | { type: "ENTER_BRIDGE"; utilityId: UtilityId; autoCommitted?: boolean }
  | { type: "COMMIT_UTILITY"; utilityId: UtilityId }
  | { type: "ACTIVATE_UTILITY" }
  | { type: "START_MORPH_OUT" }
  | { type: "FINISH_RETURN" }
  | { type: "COMPLETE_UTILITY"; message: string }
  | { type: "CLEAR_SUCCESS" }
  | {
      type: "UPDATE_SESSION_MEMORY"
      utilityId: keyof SessionMemory
      value: Partial<SessionMemory[keyof SessionMemory]>
    }
  | { type: "SET_THEME_MEMORY"; value: "light" | "dark" | "system" }
  | { type: "DISMISS" }

type UtilityDefinition = Omit<Suggestion, "score" | "exact"> & {
  previewThreshold: number
  bridgeThreshold: number
}

const UTILITY_DEFINITIONS: UtilityDefinition[] = [
  {
    id: "quick-actions",
    utilityId: "quick-actions",
    title: "Quick Actions",
    description: "Open the command center's most memorable tools.",
    keywords: ["help", "actions", "shortcuts", "start", "open"],
    command: "help / actions",
    shortcut: "?",
    group: "hero",
    previewThreshold: 0.38,
    bridgeThreshold: 0.74,
  },
  {
    id: "calendar",
    utilityId: "calendar",
    title: "Schedule Session",
    description:
      "Morph into a lightweight scheduler with curated availability.",
    keywords: [
      "schedule",
      "calendar",
      "meeting",
      "book",
      "appointment",
      "availability",
      "plan",
    ],
    command: "schedule / calendar",
    shortcut: "S",
    group: "hero",
    previewThreshold: 0.42,
    bridgeThreshold: 0.72,
  },
  {
    id: "color",
    utilityId: "color",
    title: "Pick Accent Color",
    description: "Morph into a hue wheel and copy the resulting hex instantly.",
    keywords: ["color", "palette", "hex", "hue", "tone", "theme color"],
    command: "color / theme color",
    shortcut: "C",
    group: "hero",
    previewThreshold: 0.42,
    bridgeThreshold: 0.72,
  },
  {
    id: "theme",
    utilityId: "theme",
    title: "Appearance",
    description: "Choose between light, dark, and system modes.",
    keywords: ["theme", "appearance", "light", "dark", "system"],
    command: "theme / appearance",
    shortcut: "T",
    group: "support",
    previewThreshold: 0.48,
    bridgeThreshold: 0.8,
  },
  {
    id: "notes",
    utilityId: "notes",
    title: "New Note",
    description: "Jot a quick note without leaving the command center.",
    keywords: ["note", "notes", "jot", "memo", "draft", "write"],
    command: "new note / jot",
    shortcut: "N",
    group: "support",
    previewThreshold: 0.48,
    bridgeThreshold: 0.82,
  },
  {
    id: "timer",
    utilityId: "timer",
    title: "Start Focus Timer",
    description: "Set a short focus interval with one gesture.",
    keywords: ["timer", "focus", "pomodoro", "countdown", "sprint"],
    command: "timer / focus",
    shortcut: "F",
    group: "support",
    previewThreshold: 0.48,
    bridgeThreshold: 0.8,
  },
]

const SEARCH_FALLBACK: UtilityDefinition = {
  id: "search-results",
  utilityId: "search-results",
  title: "Search Results",
  description: "Fallback previews for mixed intent or exploratory queries.",
  keywords: ["find", "search", "show", "explore", "results"],
  command: "search",
  shortcut: "R",
  group: "fallback",
  previewThreshold: 0.34,
  bridgeThreshold: 0.76,
}

const DEFAULT_MEMORY: SessionMemory = {
  calendar: {
    selectedDate: null,
    selectedSlot: null,
  },
  color: {
    hue: 18,
    hex: "#e75f3f",
  },
  theme: {
    value: "system",
  },
  notes: {
    draft: "",
  },
  timer: {
    duration: 25,
    remaining: 25 * 60,
    running: false,
  },
}

export const PREVIEW_DELAY_MS = 120
export const BRIDGE_DELAY_MS = 130
export const MORPH_IN_MS = 240
export const MORPH_OUT_MS = 210
export const SUCCESS_DWELL_MS = 640

export const initialCommandCenterState: CommandCenterState = {
  mode: "idle",
  query: "",
  confidence: 0,
  predictedUtility: null,
  bridgeUtility: null,
  activeUtility: null,
  highlightedSuggestionId: "quick-actions",
  lastActiveUtility: null,
  successMessage: null,
  autoCommitted: false,
  sessionMemory: DEFAULT_MEMORY,
}

export function commandCenterReducer(
  state: CommandCenterState,
  action: CommandCenterAction
): CommandCenterState {
  switch (action.type) {
    case "CHANGE_QUERY": {
      const trimmed = action.query.trim()

      return {
        ...state,
        query: action.query,
        confidence: trimmed ? state.confidence : 0,
        predictedUtility: trimmed ? state.predictedUtility : null,
        bridgeUtility: trimmed ? state.bridgeUtility : null,
        activeUtility:
          state.mode === "utility-active" ||
          state.mode === "morphing-in" ||
          state.mode === "utility-success"
            ? state.activeUtility
            : null,
        highlightedSuggestionId: trimmed
          ? state.highlightedSuggestionId
          : "quick-actions",
        mode:
          state.mode === "utility-active" ||
          state.mode === "morphing-in" ||
          state.mode === "utility-success"
            ? state.mode
            : trimmed
              ? "querying"
              : "idle",
      }
    }
    case "SET_PREDICTION":
      return {
        ...state,
        predictedUtility: action.utilityId,
        confidence: action.confidence,
        mode:
          state.activeUtility ||
          state.mode === "bridging" ||
          state.mode === "morphing-in" ||
          state.mode === "utility-success"
            ? state.mode
            : action.utilityId
              ? "predicting"
              : state.query.trim()
                ? "querying"
                : "idle",
      }
    case "HIGHLIGHT_SUGGESTION":
      return {
        ...state,
        highlightedSuggestionId: action.suggestionId,
      }
    case "ENTER_BRIDGE":
      return {
        ...state,
        mode: "bridging",
        bridgeUtility: action.utilityId,
        autoCommitted: action.autoCommitted ?? false,
      }
    case "COMMIT_UTILITY":
      return {
        ...state,
        activeUtility: action.utilityId,
        bridgeUtility: action.utilityId,
        predictedUtility: action.utilityId,
        lastActiveUtility: action.utilityId,
        successMessage: null,
        mode: "morphing-in",
        autoCommitted: false,
      }
    case "ACTIVATE_UTILITY":
      return {
        ...state,
        mode: "utility-active",
      }
    case "START_MORPH_OUT":
      return {
        ...state,
        mode: "morphing-out",
      }
    case "FINISH_RETURN": {
      const nextQuery = state.query.trim()

      return {
        ...state,
        mode: nextQuery ? "querying" : "idle",
        bridgeUtility: null,
        activeUtility: null,
        successMessage: null,
        autoCommitted: false,
      }
    }
    case "COMPLETE_UTILITY":
      return {
        ...state,
        successMessage: action.message,
        mode: "utility-success",
      }
    case "CLEAR_SUCCESS":
      return {
        ...state,
        successMessage: null,
      }
    case "UPDATE_SESSION_MEMORY":
      return {
        ...state,
        sessionMemory: {
          ...state.sessionMemory,
          [action.utilityId]: {
            ...state.sessionMemory[action.utilityId],
            ...action.value,
          },
        },
      }
    case "SET_THEME_MEMORY":
      return {
        ...state,
        sessionMemory: {
          ...state.sessionMemory,
          theme: {
            value: action.value,
          },
        },
      }
    case "DISMISS":
      return {
        ...state,
        mode: "dismissed",
      }
    default:
      return state
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().trim()
}

function scoreUtility(query: string, utility: UtilityDefinition) {
  const normalizedQuery = normalizeText(query)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const keywordMatches = utility.keywords.map((keyword) =>
    normalizeText(keyword)
  )

  let score = 0
  let exact = false

  for (const keyword of keywordMatches) {
    if (normalizedQuery === keyword) {
      score = Math.max(score, 1)
      exact = true
      continue
    }

    if (normalizedQuery && keyword.startsWith(normalizedQuery)) {
      score = Math.max(score, 0.78)
    }

    if (normalizedQuery && keyword.includes(normalizedQuery)) {
      score = Math.max(score, 0.7)
    }

    const keywordTokens = keyword.split(/\s+/)
    const overlappingTokens = queryTokens.filter((token) =>
      keywordTokens.some(
        (keywordToken) =>
          keywordToken.startsWith(token) || token.startsWith(keywordToken)
      )
    )

    if (overlappingTokens.length) {
      const tokenScore = Math.min(0.66, overlappingTokens.length * 0.22)
      score = Math.max(score, tokenScore)
    }
  }

  if (
    normalizedQuery &&
    normalizeText(utility.title).includes(normalizedQuery)
  ) {
    score = Math.max(score, 0.72)
  }

  if (!normalizedQuery) {
    return { score: 0, exact: false }
  }

  return { score, exact }
}

export function getSuggestionCatalog() {
  return [...UTILITY_DEFINITIONS, SEARCH_FALLBACK]
}

export function getSuggestions(query: string) {
  const normalizedQuery = normalizeText(query)

  const ranked = UTILITY_DEFINITIONS.map((utility) => {
    const { score, exact } = scoreUtility(normalizedQuery, utility)

    return {
      ...utility,
      score,
      exact,
    }
  })
    .filter((utility) => normalizedQuery.length === 0 || utility.score > 0.16)
    .sort((left, right) => right.score - left.score)

  if (
    normalizedQuery.length >= 2 &&
    (!ranked.length || ranked[0].score < 0.52)
  ) {
    ranked.push({
      ...SEARCH_FALLBACK,
      score: Math.max(0.38, ranked[0]?.score ?? 0.38),
      exact: false,
    })

    ranked.sort((left, right) => right.score - left.score)
  }

  if (normalizedQuery.length === 0) {
    return UTILITY_DEFINITIONS.map((utility, index) => ({
      ...utility,
      score: 1 - index * 0.08,
      exact: index === 0,
    }))
  }

  return ranked
}

export function getPrediction(query: string) {
  if (!normalizeText(query)) {
    return {
      utilityId: null,
      confidence: 0,
      suggestionId: null,
      shouldPreview: false,
      shouldBridge: false,
      exact: false,
    }
  }

  const suggestions = getSuggestions(query)
  const best = suggestions[0] ?? null

  if (!best) {
    return {
      utilityId: null,
      confidence: 0,
      suggestionId: null,
      shouldPreview: false,
      shouldBridge: false,
      exact: false,
    }
  }

  const definition = getUtilityDefinition(best.utilityId)
  const shouldPreview = best.score >= definition.previewThreshold
  const shouldBridge = best.score >= definition.bridgeThreshold || best.exact

  return {
    utilityId: shouldPreview ? best.utilityId : null,
    confidence: best.score,
    suggestionId: best.id,
    shouldPreview,
    shouldBridge,
    exact: best.exact,
  }
}

export function getUtilityDefinition(utilityId: UtilityId) {
  return (
    getSuggestionCatalog().find((utility) => utility.utilityId === utilityId) ??
    SEARCH_FALLBACK
  )
}

export function getUtilityTitle(utilityId: UtilityId | null) {
  if (!utilityId) {
    return "Command Center"
  }

  return getUtilityDefinition(utilityId).title
}
