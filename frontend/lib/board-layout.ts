/**
 * The columns of a board with a sidebar beside it, as the stream chat lays it
 * out (`KoopPageClient` with `centerBoard`).
 *
 * Three bands, decided by whether the sidebar fits beside the board:
 *
 * - below `md`: one column, the sidebar sits under (or over) the board;
 * - `md` up to 70rem: board and sidebar side by side, the pair centred; the
 *   board gives up width first, the sidebar keeps its 16rem;
 * - from 70rem: the board in the middle column, exactly where the solo game
 *   puts it, and the sidebar in the right gutter.
 *
 * 70rem is the narrowest viewport where both gutters hold the sidebar:
 * 2 x 16rem gutter + 32rem board + 2 x 1.5rem gap + 2rem page padding = 69rem,
 * rounded up. 16rem is the width `LiveStatus` takes from `md` on.
 *
 * The page and the support toasts (`SupportToasts`) both use these strings, so
 * a toast stays as wide as the board and under it in every band. Each is a
 * full literal, which is what Tailwind's scanner needs to find the classes.
 */

/** The grid itself, from `md` on. Below `md` the caller decides the layout. */
export const BOARD_GRID =
  "md:grid md:items-start md:justify-center md:gap-x-6 md:grid-cols-[minmax(0,32rem)_16rem] min-[70rem]:grid-cols-[minmax(16rem,1fr)_minmax(0,32rem)_minmax(16rem,1fr)]";

/** The cell the board (and everything aligned to it) goes into. */
export const BOARD_COLUMN = "mx-auto w-full max-w-lg md:col-start-1 min-[70rem]:col-start-2";

/** The cell the sidebar goes into; hidden below `md`. */
export const SIDEBAR_COLUMN =
  "hidden md:block md:col-start-2 min-[70rem]:col-start-3 min-[70rem]:max-w-[19rem]";
