# SwitchPoint demo script

**Length:** about 3 minutes  
**Audience:** hackathon judges, retail or product teams

## Before recording

- Start on the home page at `/`.
- Make sure the retailer dashboard works and you can sign in at `/admin/login`.
- In the dashboard, select **Synthetic demo**. Confirm the notice says the data is generated and not real research.
- Do not complete `/experiment` against the live `v1` database during the recording. Clicking **I agree, start** creates a participant record in `v1`. To record the whole participant journey, use a staging database and seed its synthetic dashboard data there too. Otherwise, show the consent screen and stop before starting.
- Do not describe the synthetic chart results as shopper behaviour or retail evidence.

## Recording walkthrough

### 0:00–0:25 · The question

**On screen:** Home page (`/`). Point to the two coffee packs and the three study steps.

**Say:**

> Retailers often have to guess what will make someone try a different product. SwitchPoint tests a small, specific question: does price, a promotion, or a trust cue change which coffee someone chooses?

### 0:25–0:55 · The participant experience

**On screen:** Click **Take the 3-minute study**. Show the consent page at `/experiment`. Point out the time estimate, privacy explanation, and that the participant first picks a usual coffee. If you are on staging, click **I agree, start**, make the baseline choice, and show one changed offer. Do not complete the flow on the live `v1` database.

**Say:**

> Each participant first picks between two coffees at the same price. Then the app tests defined changes to price, promotion, trust, and one price-plus-promotion combination. The participant chooses a side; the server uses the saved experiment plan to determine and store what was shown. We also ask what they say would make them switch.

### 0:55–1:35 · The summary

**On screen:** Open **Retailer dashboard** from the home page, sign in if prompted, and choose **Synthetic demo** from the version selector. Pause on **Summary**. Point to the synthetic-data notice, sample count, completion figure, and horizontal bar chart.

**Say:**

> This is generated demo data, not real participant evidence. It lets us show the analysis before the study has been run with real shoppers. The bars compare the share of simulated responses that switched under each test condition. The thin marks show uncertainty, so the chart shows both the estimate and how imprecise it may be.

### 1:35–2:10 · What choices looked like

**On screen:** Select **What shoppers did**. Point to the offer comparison, then expand **See each shopper’s price answers**. Show a mixed price pattern if one is listed.

**Say:**

> We keep the full price response pattern. If someone switches for a small discount but not for a larger one, the app shows that inconsistency instead of hiding it behind one number. The switch point is an estimate, not a rule about what that person will always do.

### 2:10–2:40 · Say versus do

**On screen:** Select **Say vs do**. Point to the paired bars and the stated-versus-observed measures.

**Say:**

> Here we compare the reasons people gave with the changes that moved their choices in the experiment. In this demo those patterns are simulated. With real responses, this view could help a retailer choose which offer to test next; it would not by itself prove that the offer increases sales.

### 2:40–3:00 · Close

**On screen:** Return to **Summary**. Optionally point to **Choices CSV** and **Stated reasons CSV** at the bottom.

**Say:**

> The product connects a controlled choice experiment to an understandable results dashboard. What works today is the participant flow, server-validated responses, and analysis. The next proof point is a real pilot; until then, this synthetic view demonstrates the product, not its market impact.

## Optional notes

- The **Reasons** tab shows free-text responses and their assigned categories. In the synthetic version, both the text and categories are generated.
- The **Suggested next experiment** panel is an AI interpretation, separate from measured results. Show it only if the configured AI service is working, and keep the synthetic-data caveat visible.
- If you record a completed participant journey on a disposable staging database, say that the dashboard sample is still synthetic unless you explicitly switch to real staging responses.
