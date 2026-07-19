# Final Review Fix Report

## Files Changed

- `app/components/activity-calendar.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/users/[userId]/page.tsx`
- `lib/format.ts`
- `tests/build-progress.test.ts`
- `tests/format.test.ts`

## Fixes

- Added `formatDateKey` to render Seoul date keys with an explicit `Asia/Seoul` timezone.
- Used the date-key formatter for activity-calendar labels, tooltips, and last-activity summaries.
- Made calendars named groups and rendered each cell as a `time` element with visually hidden text.
- Covered negative-timezone date rendering, skipped-submission exclusion, and solved meta-only activity fallback.

## Verification

- `npm run typecheck` - passed.
- `npm test` - passed (4 files, 10 tests).
- `npm run build` - passed.

## Concerns

- None.
