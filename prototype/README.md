# ConnectNT prototype

ConnectNT is a map-first screening layer for deciding which remote Northern
Territory communities should be investigated first for connectivity investment.
It complements the Australian Government's First Nations Connectivity Mapping
Tool; it does not reproduce or replace that source.

## Run

From the repository root:

```powershell
python prototype/serve.py --open
```

Or open `http://127.0.0.1:8000/` manually. After the first complete load, the
core application is cached by a service worker for offline reuse in the same
browser.

## Rebuild the data

```powershell
python src/build_prototype_data.py --download-cyclones
```

Omit `--download-cyclones` to reuse the cached Bureau of Meteorology file or to
work offline. The generated browser dataset is `data/communities.js`.

## Interpretation

The High / Medium / Lower classes are relative screening tiers within this
dataset. Delivery context is based on recorded infrastructure proximity and is
not a cost or feasibility estimate. The combined score is a transparent,
adjustable prototype that produces a priority for due diligence, not an
investment recommendation. Community priorities, consent, engineering
validation, cost, power and backhaul remain due-diligence requirements.

The intended decision framing is **Need → Benefit → Delivery readiness →
Sustainability → Community mandate → Due diligence priority**. Unknown evidence
should remain visible rather than being converted into false certainty.
