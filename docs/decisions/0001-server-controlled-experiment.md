# 0001. The server controls the experiment

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

SwitchPoint's results are only worth anything if the experiment is valid. Three things could quietly break it:

1. A participant (or a modified browser) influencing which product, price or position was shown.
2. Someone editing a scenario mid-event, mixing two different experiments under one label.
3. Interventions applied to a product the participant already preferred, so "choosing" it says nothing about switching.

## Decision

**Randomise on the server, and trust the browser with nothing but a side.**
On consent, `createPlan()` ([src/domain/experiment/plan.ts](../../src/domain/experiment/plan.ts)) builds and stores a plan using `node:crypto`: shuffled scenario order, left/right positions, and say-first or do-first. When a choice is recorded, the browser sends only the scenario ID and `left` or `right`. The server rebuilds the screen from the stored plan and records the product, price and positions itself ([recordChoice.ts](../../src/application/participant/recordChoice.ts)).

**Lock each experiment version.**
Experiments are typed config files with a `version` ([src/config/experiments/](../../src/config/experiments/)). On first use, the config and its SHA-256 fingerprint are stored in the `experiments` table. If the code's config later differs from the stored fingerprint, the server refuses to run until the version is bumped ([experiments.ts](../../src/application/experiments.ts)). Every response row stores `experiment_version`.

**Measure switching against the participant's own baseline.**
Each participant first picks between two identical-condition products. In every controlled scenario, only the product they *didn't* pick gets the discount, promotion or trust badge. So `switched` always means the same thing: they moved away from what they preferred.

## Consequences

- A tampered client cannot record a choice that wasn't shown.
- Any change to an experiment, including wording, requires a new version. Old versions stay registered so in-flight participants can finish.
- Controlled choices are rejected until a baseline exists.
- Plans are pure functions of a random source, so they are unit-tested with a seeded generator.
