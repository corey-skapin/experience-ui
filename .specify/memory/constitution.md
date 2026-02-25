<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0 (MINOR — materially expanded guidance)
  Modified principles:
    - II. Testing Standards — added local-verification-before-commit
      requirement (new bullet)
  Added sections: None (integrated into existing sections)
  Removed sections: None
  Expanded sections:
    - Development Workflow — added "Local verification gate" bullet
      requiring all checks to pass locally before commit; recommends
      pre-commit hooks (husky + lint-staged)
    - Quality Gates table — added "Local pre-commit" row
  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ aligned (Constitution
      Check section references principles generically)
    - .specify/templates/spec-template.md         ✅ aligned (Requirements
      and Success Criteria sections support all four principles)
    - .specify/templates/tasks-template.md        ✅ aligned (Phase 1 Setup
      includes "Configure linting and formatting tools" task; Phase N
      covers cross-cutting quality concerns)
    - .specify/templates/checklist-template.md    ✅ aligned (generic
      category structure accommodates principle-driven items)
  Follow-up TODOs: None
-->

# Experience UI Constitution

## Core Principles

### I. Code Quality

All code in this repository MUST be clean, maintainable, and
consistently structured. This principle is non-negotiable and applies
to every file committed.

- Every component, utility, and module MUST follow established project
  conventions for naming, file organization, and code style.
- Linting and formatting rules MUST be enforced automatically; no code
  may be merged that violates configured lint rules.
- Functions and components MUST have a single, clear responsibility.
  Files exceeding 300 lines SHOULD be refactored into smaller units.
- Shared logic MUST be extracted into reusable utilities or hooks
  rather than duplicated across components.
- All public APIs (exported functions, component props, utility
  interfaces) MUST include TypeScript types with no use of `any`
  except where explicitly justified with a code comment.
- Dead code, unused imports, and commented-out blocks MUST be removed
  before merge.
- **Rationale**: A UI codebase grows rapidly. Without strict quality
  discipline, technical debt compounds and velocity degrades. Automated
  enforcement removes subjective debate from code review.

### II. Testing Standards

Comprehensive testing is mandatory. Every feature MUST be accompanied
by tests that validate its behavior before it is considered complete.

- Unit tests MUST cover all business logic, utilities, hooks, and
  non-trivial component behavior.
- Integration tests MUST verify component composition, data flow
  between parent and child components, and user interaction workflows.
- Test-first development is the preferred approach: write failing tests
  that describe expected behavior, then implement until tests pass
  (Red-Green-Refactor).
- Code coverage MUST NOT drop below the established project baseline.
  New code SHOULD target ≥80% line coverage measured per feature
  branch.
- Tests MUST be deterministic: no reliance on network calls, timers,
  or execution order. External dependencies MUST be mocked or stubbed.
- Accessibility tests (e.g., axe-core integration) MUST be included
  for all user-facing components.
- Visual regression tests SHOULD be used for design-system components
  where pixel-level consistency matters.
- The full test suite, linter, and formatter MUST pass locally before
  any change is committed or pushed. Developers MUST NOT push commits
  that have not cleared all local quality checks. This is a hard
  requirement, not a suggestion—CI exists as a safety net, not as the
  primary quality gate.
- **Rationale**: A UI without tests is a UI that breaks silently.
  Testing is the primary mechanism for maintaining confidence during
  refactoring and feature development. Enforcing local verification
  prevents broken commits from reaching CI and blocking the team.

### III. User Experience Consistency

Every screen, component, and interaction MUST adhere to the project's
design system and accessibility standards. Consistency is a feature,
not a preference.

- All UI components MUST use the project's design-system primitives
  (tokens, spacing, typography, color) rather than hard-coded values.
- Custom styling MUST only be introduced when the design system does
  not provide a suitable primitive, and MUST be documented with
  rationale.
- Accessibility MUST meet WCAG 2.1 AA compliance as a minimum:
  semantic HTML, ARIA attributes where needed, keyboard navigability,
  and sufficient color contrast.
- Interaction patterns (modals, forms, navigation, feedback) MUST
  follow established UX conventions within the application; new
  patterns MUST be reviewed and approved before implementation.
- Responsive behavior MUST be tested across defined breakpoints.
  Components MUST NOT break or become unusable at any supported
  viewport size.
- Error states, loading states, and empty states MUST be explicitly
  designed and implemented for every data-driven component.
- **Rationale**: Inconsistent UI erodes user trust and increases
  cognitive load. Design-system adherence enables rapid development
  while preserving visual and interaction coherence.

### IV. Performance Requirements

Performance is a feature. Every change MUST be evaluated against
defined budgets and MUST NOT degrade the user experience.

- Initial page load (Largest Contentful Paint) MUST remain under
  2.5 seconds on a simulated mid-tier mobile device over 4G.
- Total JavaScript bundle size for initial load MUST NOT exceed the
  project-defined budget. Any increase exceeding 5 KB MUST be
  justified in the PR description.
- Components MUST avoid unnecessary re-renders. React components
  SHOULD use memoization (`React.memo`, `useMemo`, `useCallback`)
  when profiling demonstrates a measurable benefit.
- Images and media MUST use lazy loading and appropriate modern
  formats (WebP/AVIF with fallbacks).
- Third-party dependencies MUST be evaluated for bundle-size impact
  before adoption. Alternatives with smaller footprints MUST be
  preferred when functionality is equivalent.
- Performance regressions MUST be caught in CI via automated
  lighthouse audits or equivalent tooling; PRs that exceed budget
  thresholds MUST NOT be merged without explicit justification.
- **Rationale**: Users abandon slow interfaces. Performance budgets
  create accountability and prevent the gradual accumulation of
  bloat that degrades experience over time.

## Development Workflow

The following workflow governs how changes move from idea to
production in this repository.

- **Branch strategy**: All work MUST occur on feature branches
  created from the main branch. Branch names MUST follow the
  convention `<issue-number>-<short-description>`.
- **Commit discipline**: Commits MUST be atomic and descriptive.
  Use conventional commit format (`feat:`, `fix:`, `refactor:`,
  `test:`, `docs:`, `perf:`, `chore:`).
- **Local verification gate**: All automated checks (test suite, lint,
  type-check, formatting) MUST pass on the developer's local machine
  before a commit is created. No commit may be pushed to a remote
  branch without passing all local quality checks first. Projects
  SHOULD configure pre-commit hooks (e.g., husky + lint-staged) to
  enforce this automatically; manual verification is acceptable only
  when hook tooling is impractical for the change type.
- **Pull requests**: Every PR MUST reference the originating issue
  or spec. PRs MUST include a description of what changed, why, and
  how to verify. Screenshots or recordings MUST accompany visual
  changes.
- **Code review**: At least one approving review is required before
  merge. Reviewers MUST verify compliance with all four Core
  Principles.
- **CI gates**: All automated checks (lint, type-check, test suite,
  build, performance audit) MUST pass before a PR is eligible for
  merge.

## Quality Gates

Quality gates define the minimum bar that every change MUST clear.

| Gate | Requirement | Enforcement |
|------|-------------|-------------|
| Local pre-commit | Tests, lint, type-check, format all pass locally | Pre-commit hooks (husky + lint-staged) |
| Lint | Zero errors, zero warnings | CI — auto-block |
| Type check | Strict mode, no suppressions without justification | CI — auto-block |
| Unit tests | All pass, coverage ≥ baseline | CI — auto-block |
| Integration tests | All pass | CI — auto-block |
| Accessibility | axe-core: zero critical/serious violations | CI — auto-block |
| Bundle size | Within defined budget | CI — warning/block |
| Performance | LCP < 2.5 s, no regressions | CI — warning |
| Review | ≥ 1 approval | GitHub branch protection |

## Governance

This constitution is the supreme governance document for the
experience-ui repository. It supersedes any conflicting practices,
conventions, or ad-hoc agreements.

- **Supremacy**: In any conflict between this constitution and other
  project documentation, this constitution prevails.
- **Compliance verification**: All pull request reviews MUST include
  an explicit check against the Core Principles. Reviewers SHOULD
  reference the specific principle when requesting changes.
- **Amendment procedure**: Amendments to this constitution require:
  1. A written proposal describing the change and its rationale.
  2. Review and approval by at least two maintainers.
  3. A version bump following semantic versioning (see below).
  4. A migration plan if the amendment changes existing constraints.
- **Versioning policy**: Constitution versions follow MAJOR.MINOR.PATCH:
  - MAJOR: Principle removal, redefinition, or backward-incompatible
    governance change.
  - MINOR: New principle or section added, or material expansion of
    existing guidance.
  - PATCH: Clarifications, wording fixes, non-semantic refinements.
- **Compliance review**: At least once per quarter, the team SHOULD
  audit recent PRs against this constitution to identify drift and
  propose amendments if needed.
- **Complexity justification**: Any deviation from these principles
  MUST be documented with rationale in the relevant PR or spec and
  tracked in the plan's Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-02-26
