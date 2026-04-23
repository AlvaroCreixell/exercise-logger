# First-run onboarding & routine-questionnaire feature

Replaces the "cold ChatGPT conversation" routine-creation flow with a guided 2-minute in-app questionnaire that produces a pastable GPT prompt and round-trips a YAML routine back into Dexie. Feature spec at [docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md](../docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md).

## Summary

- New route `/onboarding` (welcome + name input), `/onboarding/questionnaire` (11-step wizard), `/onboarding/handoff` (Stage 1 → Stage 2 state machine).
- First-run gate in `AppRoutes` redirects fresh installs to `/onboarding`. Guards also redirect completed or skipped users away from `/onboarding`, and redirect `/onboarding/handoff` back to the questionnaire when there's nothing to hand off.
- Existing testers silently migrated (Decision D3 — `onboardingSkippedAt` backfilled on Dexie v2→v3 upgrade).
- Settings gets a Profile section + "✨ Create a personalized routine" row + `LastPromptCard`.
- Today screen shows `Hi, {name}.` greeting when set, otherwise `Hello.`, plus a recovery banner when a prompt is saved and not dismissed.
- Pure `buildPrompt(answers)` module with a byte-for-byte spec example test + D10 regression lock.
- Co-ships updated custom-GPT instructions dropping the 12th intake topic (`docs/custom-gpt/workout-routine-gpt.instructions.md`). **Post-merge: paste those instructions into the ace-logger-routine-maker custom-GPT admin UI.**

## Decisions honored (D1–D12)

- **D1** Soft first-run gate — welcome is skippable via "Maybe later". ✓
- **D2** Questionnaire re-runnable from Settings → "Create a personalized routine". ✓
- **D3** Existing users silently marked onboarded via Dexie v3 migration backfilling `onboardingSkippedAt = nowISO()`. ✓
- **D4** Answers not persisted between runs — sessionStorage is cleared on Stage-2 success. ✓
- **D5** Generated prompt persisted to `lastGeneratedPrompt`. ✓
- **D6** One-at-a-time wizard (Option A). ✓
- **D7** Auto-advance on single-select chips; Back is safety net. ✓
- **D8** Combined "Copy prompt & open GPT" + Stage 2 paste on the same screen. ✓
- **D9** Today banner recovers users who close mid-flow. ✓
- **D10** Step 6 captures only the number; prompt rendering has a test lock asserting "Distinct training days desired: 3" and NOT "... 3 (Push/Pull/Legs)". ✓
- **D11** Design language inherits from the paper+sage handoff — no new tokens. ✓
- **D12** sessionStorage-based mid-wizard resume. ✓

## Test plan

- [x] Unit + integration suite: 742 → 873 tests (+131). Full `cd web && npm test --run` green.
- [x] Acceptance suite (16 scenarios) still green — no behavior change to sessions / sets / progression.
- [x] E2E (Playwright): 17 existing + 3 new onboarding flow + 3 a11y scans = 20 tests. `cd web && npm run test:e2e` green.
- [x] `npm run lint` clean.
- [x] `npm run build` clean.
- [x] axe-core (critical + serious) clean on `/onboarding`, `/onboarding/questionnaire`, `/onboarding/handoff`. Bottom-nav's pre-existing app-wide `text-ink-3` contrast failure is excluded from the scan and tracked separately — it predates this feature.

## A11y fixes that landed with this feature

- Added `aria-label="Questionnaire progress"` to the `role="progressbar"` in `WizardShell` (was missing an accessible name).
- Swapped every onboarding-feature use of `text-ink-3` to `text-ink-2` (passes WCAG AA + AAA against `--paper`). The app-wide `text-ink-3` bottom-nav labels still fail AA at 4.15:1 — deferred to a future a11y sprint.

## Manual QA

Attach device screenshots below. If a device wasn't available, note so explicitly.

| Device | Welcome | Mid-wizard step | Handoff Stage 1 | Handoff Stage 2 | Today greeting | Settings |
|---|---|---|---|---|---|---|
| iOS Safari (real) | _screenshot or "not available"_ | _…_ | _…_ | _…_ | _…_ | _…_ |
| Android Chrome (real) | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ |
| Desktop Chrome | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ |

**Risks validated:**
- Clipboard: Playwright stubs cover the write path (D8 Stage 1). Real-device verification on iOS Safari and Android Chrome — note any failures above.
- Popup blocker: the handoff screen falls back to an inline `<a href={GPT_URL}>` when `window.open` returns null. E2E-covered. Verify on an installed PWA.
- sessionStorage quota: the answers blob is < 1 KB; no real risk.
- GPT URL: single source of truth at `web/src/shared/lib/gpt-url.ts`.
- `useLiveQuery` race after "Maybe later": fixed by extending the `/onboarding` guard to redirect when `onboardingSkippedAt !== null`. Verified by `AppRoutes` unit test + skip E2E.

## Post-merge action items

**REQUIRED — do not skip:**

1. **Paste the updated instructions into the custom-GPT admin UI.** The file to paste is [docs/custom-gpt/workout-routine-gpt.instructions.md](../docs/custom-gpt/workout-routine-gpt.instructions.md). Without this, the GPT still thinks there are 12 intake topics and may ask the user to re-enumerate equipment preferences after the app already gave them all 11 answers. Confirm in a new ChatGPT chat that pasting the app's generated prompt produces YAML on the first turn without any follow-up questions.
2. **Smoke-test the deployed site.** After GitHub Pages redeploys from `main`: fresh-install a clean browser profile, go through the flow end-to-end (welcome → wizard → handoff → paste real GPT YAML → train one set). This catches anything the E2E suite missed (e.g., real clipboard, real window.open, real iOS Safari focus handling).
3. **Delete the feature branch.** After merge: `git branch -d feat/onboarding-questionnaire && git push origin --delete feat/onboarding-questionnaire`.

## Scope summary

- Sprint A (Foundation): Dexie v3 migration + `onboarding-service` + `setUserName` + `GPT_URL` extraction + `buildPrompt` pure function + Answer types.
- Sprint B (Wizard mechanics): pure reducer + sessionStorage utility + 5 shared components (`WizardShell`, `ChipRow`, `ChipMulti`, `ChipWithDescription`, `StepTextArea`).
- Sprint C (Wizard content): `OnboardingWelcomeScreen` + `QuestionnaireScreen` orchestrator + 11 step components + walkthrough integration test.
- Sprint D (Integration): `HandoffScreen` (Stage 1 + Stage 2) + `LastPromptCard` + `OnboardingBanner` + Settings Profile section + Today greeting/banner + first-run gate + 2 route guards.
- Sprint E (this PR): 4 Playwright E2E tests + axe-core a11y audit + targeted a11y fixes + PR prep.
