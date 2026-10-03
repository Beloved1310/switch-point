#!/usr/bin/env python3
"""Generate explicitly synthetic SwitchPoint demo data. Not research evidence."""

import csv
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path


SEED = 20261003
COUNT = 64
VERSION = "v1-synthetic-demo"
OUTPUT = Path(__file__).resolve().parents[1] / "demo-data"
RNG = random.Random(SEED)

PRODUCTS = {
    "A": {"name": "Hearth Roast", "description": "Medium roast ground coffee, 227g", "price": 4.0},
    "B": {"name": "Ridgeline", "description": "Medium roast ground coffee, 227g", "price": 4.0},
}
SCENARIOS = [
    ("price_020", ["price"], 0.20, None, None),
    ("price_050", ["price"], 0.50, None, None),
    ("price_100", ["price"], 1.00, None, None),
    ("price_150", ["price"], 1.50, None, None),
    ("promo_extra", ["promotion"], 0, "20% extra free", None),
    ("trust_rating", ["trust"], 0, None, "Rated 4.8/5 by shoppers"),
    ("price_020_promo", ["price", "promotion"], 0.20, "20% extra free", None),
]
REASONS = {
    "price": ["I would switch if the other bag was at least 50p cheaper.", "Price matters most; around £1 off would make me try it.", "A small saving would be enough if the coffees are similar."],
    "promotion": ["A little extra coffee would make it feel like better value.", "I would try it if there was an offer or extra quantity.", "A promotion would catch my attention."],
    "trust": ["A strong rating would help me trust an unfamiliar brand.", "I look for reviews before trying another coffee.", "Knowing other shoppers rate it would reassure me."],
    "quality": ["I would switch if the taste and quality seemed better.", "The roast quality matters more than a small price difference."],
    "habit": ["I usually buy the coffee I know already.", "I am used to my current brand, so it would take a good reason."],
    "other": ["I would compare the packaging and ingredients first.", "Availability in my usual shop would influence me."],
}


def build_people():
    people = []
    for index in range(COUNT):
        participant_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"switchpoint-synthetic-v1-{SEED}-{index}"))
        # A mix of price-sensitive, promotion/trust responsive, and loyal profiles.
        profile = RNG.choices(["price", "promo", "trust", "loyal"], [0.42, 0.22, 0.18, 0.18])[0]
        threshold = {"price": RNG.choice([0.2, 0.5, 0.5, 1.0, 1.5]), "promo": RNG.choice([0.5, 1.0, 1.5]), "trust": RNG.choice([0.5, 1.0, 1.5]), "loyal": RNG.choice([1.0, 1.5, None])}[profile]
        category = RNG.choices([profile if profile in REASONS else "habit", "price", "promotion", "trust", "quality", "other"], [0.50, 0.12, 0.10, 0.10, 0.10, 0.08])[0]
        if profile == "loyal" and category == "loyal":
            category = "habit"
        say_first = RNG.random() < 0.5
        baseline = RNG.choices(["A", "B"], [0.53, 0.47])[0]
        # Keep a few intentionally non-monotonic patterns visible in the sample.
        non_monotonic = index in {7, 18, 29, 41, 55}
        if threshold is None:
            switched_at = None
        else:
            switched_at = [0.2, 0.5, 1.0, 1.5].index(threshold)
        choices = {}
        for i, discount in enumerate([0.2, 0.5, 1.0, 1.5]):
            switched = switched_at is not None and i >= switched_at
            if non_monotonic and i == 3:
                switched = False
            choices[f"price_{int(discount*100):03d}"] = switched
        choices["promo_extra"] = profile == "promo" and RNG.random() < 0.74 or RNG.random() < 0.19
        choices["trust_rating"] = profile == "trust" and RNG.random() < 0.72 or RNG.random() < 0.16
        choices["price_020_promo"] = (profile == "promo" or profile == "price") and RNG.random() < 0.65 or RNG.random() < 0.18
        people.append({
            "id": participant_id,
            "profile": profile,
            "baseline": baseline,
            "say_first": say_first,
            "threshold": threshold,
            "category": category,
            "choices": choices,
            "started_at": datetime(2026, 10, 3, 9, tzinfo=timezone.utc) + timedelta(seconds=index * RNG.randint(19, 67)),
        })
    return people


def product_view(product_id, discount=0, promotion=None, trust=None):
    product = PRODUCTS[product_id]
    return {
        "productId": product_id,
        "name": product["name"],
        "description": product["description"],
        "price": round(product["price"] - discount, 2),
        "promotion": promotion,
        "trustBadge": trust,
    }


def write_csv(path, columns, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main():
    OUTPUT.mkdir(exist_ok=True)
    people = build_people()
    choice_rows = []
    reason_rows = []
    for person in people:
        baseline = person["baseline"]
        alternative = "B" if baseline == "A" else "A"
        screen_specs = [("baseline", [], 0, None, None)] + SCENARIOS[:]
        RNG.shuffle(screen_specs)
        # Baseline is always first in the actual participant flow; randomize only controlled order.
        screen_specs.remove(next(spec for spec in screen_specs if spec[0] == "baseline"))
        screen_specs.insert(0, ("baseline", [], 0, None, None))
        for round_index, (scenario_id, levers, discount, promotion, trust) in enumerate(screen_specs):
            left_is_baseline = RNG.random() < 0.5
            left_id = baseline if left_is_baseline else alternative
            right_id = alternative if left_is_baseline else baseline
            left_view = product_view(left_id, 0 if left_id == baseline else discount, promotion if left_id == alternative else None, trust if left_id == alternative else None)
            right_view = product_view(right_id, 0 if right_id == baseline else discount, promotion if right_id == alternative else None, trust if right_id == alternative else None)
            if scenario_id == "baseline":
                # Simulated baseline preference is the participant's selected product.
                chosen_product = baseline
                chosen_side = "left" if left_id == baseline else "right"
                stored_baseline = ""
                switched = ""
            else:
                switched = person["choices"][scenario_id]
                chosen_product = alternative if switched else baseline
                chosen_side = "left" if left_id == chosen_product else "right"
                stored_baseline = baseline
            choice_rows.append({
                "synthetic": "true",
                "experiment_version": VERSION,
                "participant_id": person["id"],
                "scenario_id": scenario_id,
                "levers": json.dumps(levers, separators=(",", ":")),
                "condition": "" if scenario_id == "baseline" else json.dumps({"priceDiscount": discount, "promotion": promotion, "trustBadge": trust}, separators=(",", ":")),
                "left_product": left_id,
                "right_product": right_id,
                "left_view": json.dumps(left_view, separators=(",", ":")),
                "right_view": json.dumps(right_view, separators=(",", ":")),
                "chosen_side": chosen_side,
                "chosen_product": chosen_product,
                "baseline_product": stored_baseline,
                "switched": str(switched).lower() if switched != "" else "",
                "created_at": (person["started_at"] + timedelta(seconds=round_index * RNG.randint(8, 25))).isoformat(),
            })
        reason = RNG.choice(REASONS[person["category"]])
        reason_rows.append({
            "synthetic": "true",
            "experiment_version": VERSION,
            "participant_id": person["id"],
            "phase": "before" if person["say_first"] else "after",
            "reason_text": reason,
            "stated_price_threshold": "" if person["threshold"] is None else f"{person['threshold']:.2f}",
            "ai_status": "done",
            "ai_category": person["category"],
            "ai_confidence": RNG.choice(["high", "medium"]),
            "override_category": "",
            "created_at": (person["started_at"] + timedelta(seconds=5)).isoformat(),
        })

    write_csv(OUTPUT / "synthetic-v1-pilot-choices.csv", list(choice_rows[0]), choice_rows)
    write_csv(OUTPUT / "synthetic-v1-pilot-stated-reasons.csv", list(reason_rows[0]), reason_rows)
    (OUTPUT / "README.md").write_text(
        """# Synthetic demo data

These files contain generated data for SwitchPoint's `v1-synthetic-demo` ground-coffee study. They are not real participant responses, not Prolific data, and must not be presented as research evidence. The fixed seed makes regeneration reproducible.

- `synthetic-v1-pilot-choices.csv`: 64 synthetic participants × 8 responses (baseline plus seven controlled scenarios).
- `synthetic-v1-pilot-stated-reasons.csv`: one synthetic stated response per participant.
- `../scripts/generate-synthetic-demo-data.py`: generator.

The response patterns are illustrative assumptions chosen to demonstrate varied price sensitivity, promotion and trust responses, non-monotonic price choices, and say/do comparisons. Do not mix these rows into a live study or describe their distributions as measured consumer behaviour.
""",
        encoding="utf-8",
    )
    print(f"Wrote {len(choice_rows)} choice rows and {len(reason_rows)} stated rows to {OUTPUT}")


if __name__ == "__main__":
    main()
