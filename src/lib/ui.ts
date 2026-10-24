// Shared Tailwind utility bundles (kept as complete static strings so Tailwind can detect them).
export const ui = {
  shell: "min-h-dvh bg-canvas text-ink",
  main: "mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-8 lg:px-10",
  narrow: "mx-auto w-full max-w-md px-4 py-8 sm:py-12 grid gap-4",
  mainStack: "mx-auto grid w-full max-w-screen-2xl gap-4 px-4 py-5 sm:px-6 sm:py-8 lg:px-10",
  stack: "grid gap-4",
  emptyMark: "relative flex items-center justify-center text-sm font-semibold text-muted",
  row: "flex flex-wrap items-center gap-2.5",
  card: "grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm [&_h2]:text-base [&_h2]:font-bold",
  field:
    "grid gap-1.5 text-sm font-semibold text-ink [&_input:not([type=checkbox])]:min-h-10 [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-line [&_input:not([type=checkbox])]:bg-canvas [&_input:not([type=checkbox])]:px-3 [&_input:not([type=checkbox])]:py-2 [&_input:not([type=checkbox])]:text-base [&_input:not([type=checkbox])]:font-normal [&_input:not([type=checkbox])]:text-ink [&_select]:min-h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-canvas [&_select]:px-3 [&_select]:text-base [&_select]:font-normal [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-canvas [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-base [&_textarea]:font-normal [&_small]:font-normal [&_small]:text-muted",
  primary:
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-on-accent no-underline transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink no-underline transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50",
  muted: "text-sm text-muted",
  error: "text-sm font-semibold text-danger",
  ok: "text-sm font-semibold text-ok",
  danger: "font-semibold text-danger",
  code: "inline-block w-fit rounded-lg border border-dashed border-accent bg-accent-soft px-3 py-1 font-mono text-xl font-extrabold tracking-widest text-ink",
  tabs: "mb-5 flex flex-wrap gap-2",
  // セッションのタブと、右端の検索
  tabsRow: "mb-5 flex flex-wrap items-center gap-2",
  tabList: "flex flex-wrap gap-2",
  tab: "rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-semibold text-ink no-underline hover:bg-sunken",
  tabActive: "rounded-full border border-accent bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent no-underline",
  // 一覧の上の行（右寄せの並び順）
  toolbar: "mb-3 flex flex-wrap items-center gap-2 empty:hidden",
  // 一覧の並び順など、タブより控えめな切り替え
  chips: "ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted",
  chip: "rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink no-underline hover:bg-sunken",
  chipActive: "rounded-full border border-ink bg-ink px-3 py-1 text-xs font-semibold text-canvas no-underline",
  // 状態での絞り込み（開閉できる枠）
  filterBox: "mb-4 rounded-2xl border border-line bg-surface px-4 py-2.5 open:pb-4",
  filterSummary:
    "flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden",
  // カードに付く状態のバッジ
  statusBadges: "flex flex-wrap gap-1 px-3 pb-3 sm:px-4 sm:pb-4",
  statusBadge: "max-w-full truncate rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-ink",
  table:
    "w-full border-collapse text-sm [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-2 [&_td]:text-left [&_td]:whitespace-nowrap [&_td]:align-middle",
  tableWrap: "overflow-x-auto",
  pageHeader: "mb-6 flex flex-wrap items-end justify-between gap-4",
  h1: "text-2xl font-extrabold tracking-tight sm:text-3xl",
  subtitle: "mt-1 block text-sm text-muted",
  breadcrumb: "mb-1 flex flex-wrap items-center gap-1 text-sm text-muted [&_a]:font-semibold [&_a]:text-muted [&_a]:underline-offset-2 [&_a:hover]:text-ink [&_a:hover]:underline",
  controls: "flex flex-wrap items-center gap-2",
  // 画面幅に応じて列数が自動で増減する（スマホ 2 列〜ワイド画面 6 列以上）
  grid: "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] sm:gap-5 2xl:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
  detail: "grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)] 2xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]",
  hint: "mx-auto max-w-2xl p-8 leading-7",
  // project / workshop card
  cardItem:
    "group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-accent hover:shadow-md",
  cardLink: "grid gap-0 text-ink no-underline focus-visible:outline-none",
  stage:
    "relative grid aspect-[16/10] w-full place-items-center overflow-hidden bg-stage bg-[radial-gradient(circle,var(--c-line)_1px,transparent_1px)] bg-[length:16px_16px] text-muted",
  stageLarge: "overflow-hidden rounded-2xl border border-line [&>span]:aspect-[16/10]",
  thumb: "absolute inset-0 h-full w-full object-contain p-1.5 sm:p-2",
  cardTitle: "truncate px-3 pt-2.5 text-sm font-bold leading-snug sm:px-4 sm:pt-3 sm:text-base",
  cardMeta: "truncate px-3 pb-3 pt-0.5 text-xs text-muted sm:px-4 sm:pb-4 sm:pt-1 sm:text-sm",
} as const;
