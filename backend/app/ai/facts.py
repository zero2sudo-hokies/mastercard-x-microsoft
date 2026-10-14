"""Flat facts for one pilot plan. These are the ONLY numbers the model may use."""
TOPIC_LABEL = {"fees": "fees", "fraud_scams": "fraud and scams", "transfers": "transfers", "account_closed": "account closures",
               "customer_service": "customer service", "distrust": "distrust"}


def build_facts(profile: dict, roi: dict, partner_name: str, notes: str, bank: dict | None = None) -> dict:
    a, fr, b = profile["area"], profile.get("frustration") or {}, profile.get("benefit") or {}
    pain = fr.get("pain_scores") or {}
    top, second = fr.get("top_topic"), fr.get("second_topic")
    u, p, i = roi["unit"], roi["program"], roi["inputs"]
    state_scale = next((s for s in roi.get("scale", []) if s["level"] == "State"), None)
    st = (roi.get("context") or {}).get("state") or {}
    us_scale = next((s for s in roi.get("scale", []) if s["level"] == "United States"), None)
    facts = {
        "area_name": f"{a['name']}, {a['state_abbr']}" if a["level"] == "county" else a["name"],
        "level": a["level"],
        "exclusion_index": a["exclusion_index"], "exclusion_rank": a["exclusion_rank"],
        "households": a["households"], "est_underserved_households_modeled": a["est_underserved_hh"],
        "underserved_rate_modeled": a.get("underserved_rate"),
        "poverty_rate": a.get("poverty_rate"), "no_internet_rate": a.get("no_internet_rate"),
        "branches_per_10k_households": a.get("branches_per_10k_hh"), "median_household_income": a.get("median_income"),
        "state_fdic_unbanked_rate": a.get("unbanked_rate"), "state_fdic_underbanked_rate": a.get("underbanked_rate"),
        "complaints": fr.get("complaints"), "complaints_per_100k": fr.get("complaints_per_100k"),
        "frustration_score": fr.get("frustration_score"),
        "top_topic": TOPIC_LABEL.get(top), "top_topic_pain": pain.get(top),
        "second_topic": TOPIC_LABEL.get(second), "second_topic_pain": pain.get(second),
        "clear_lead": fr.get("clear_lead"),
        "mean_intensity_1_to_5": fr.get("mean_intensity"), "intensity_source": fr.get("intensity_source"),
        "benefit_title": b.get("title"), "benefit_description": b.get("description"), "benefit_pain_measure": b.get("pain_measure"),
        "issuer_type": i["issuer_type"], "adoption_rate_placeholder": i["adoption_rate"], "yearly_churn": i["churn"],
        "acquisition_cost_per_account": i["cac"], "fixed_program_cost_placeholder": i["fixed_program_cost"],
        "network_yield_placeholder": i["network_yield"],
        "benchmark_transactions_per_month": roi.get("benchmarks", {}).get("transactions_per_month"),
        "benchmark_avg_ticket": roi.get("benchmarks", {}).get("avg_ticket"),
        "annual_spend_per_account": u["annual_spend"], "swipe_revenue_per_account": u["swipe_revenue"],
        "deposit_earnings_per_account": u["deposit_earnings"], "fraud_loss_per_account": u["fraud_loss"],
        "servicing_cost_per_account": u["servicing"], "annual_margin_per_account": u["annual_margin"],
        "lifetime_value_per_account": u["ltv"], "net_per_account": u["net_per_account"], "breakeven_churn": u["breakeven_churn"],
        "pilot_audience_basis": i.get("audience_basis"),
        "pilot_audience": (roi.get("audience") or {}).get("label"),
        "state_fdic_unbanked_households": st.get("unbanked_households"),
        "state_fdic_share_of_unbanked_interested_in_account": st.get("interested_share_of_unbanked"),
        "state_fdic_interested_unbanked_households": st.get("interested_unbanked_households"),
        "state_fdic_unbanked_respondents": st.get("n_unbanked_surveyed") if st else None,
        "state_fdic_small_sample": st.get("small_sample") if st else None,
        "pilot_audience_households": (roi.get("audience") or {}).get("area_households"),
        "pilot_accounts_modeled": p["accounts"], "issuer_net_lifetime_modeled": p["issuer_net_lifetime"],
        "network_volume_year1_modeled": p["network_volume_y1"], "network_revenue_year1_placeholder": p["network_revenue_y1_est"],
        "state_scale_accounts": state_scale and state_scale["accounts"], "us_scale_accounts": us_scale and us_scale["accounts"],
        "lookalikes": [{"name": f"{l['name']}, {l['state_abbr']}", "similarity": l["similarity"]} for l in profile.get("lookalikes", [])[:5]],
        "data_labels": profile.get("labels", []),
        "partner_name": partner_name, "notes": notes[:1000],
    }
    if bank:
        facts.update({
            "target_bank": bank["name"], "target_bank_rank_by_local_deposits": bank["rank"],
            "target_bank_local_deposit_share": bank["deposit_share"], "target_bank_local_deposits": bank["deposits"],
            "target_bank_local_branches": bank["branches"], "target_bank_total_assets": bank["total_assets"],
            "target_bank_pricing_tier": "exempt (under $10B assets)" if bank["issuer_type"] == "community" else "covered ($10B+ assets)",
            "target_bank_fdic_community_bank": bank["fdic_community_bank"],
            "target_bank_holding_company": bank.get("holding_company"),
            "target_bank_headquarters": ", ".join(x for x in (bank.get("hq_city"), bank.get("hq_state")) if x) or None,
            "target_bank_net_interest_margin_whole_bank": bank.get("net_interest_margin"),
            "target_bank_efficiency_ratio_whole_bank": bank.get("efficiency_ratio"),
        })
    return {k: v for k, v in facts.items() if v is not None and v != []}
