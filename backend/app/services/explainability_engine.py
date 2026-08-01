"""
Explainability Engine for Quantfolio Portfolio Health.

This service ONLY interprets existing component scores.
It does NOT calculate anything — scores come from HealthEngineService.

Separation of concerns:
- HealthEngineService   → calculates numbers
- ExplainabilityService → interprets numbers into human language

This means you can change scoring logic without breaking explanations,
and change explanations without touching scoring logic.
"""

from app.schemas.health import HealthRecommendation


# ── Thresholds for interpretation (separate from scoring thresholds) ──────────
STRENGTH_THRESHOLD = 70.0    # score above this = strength
WEAKNESS_THRESHOLD = 45.0    # score below this = weakness


# ── Business Rules — single source of truth ───────────────────────────────────
# Each rule is a dict with:
#   component   → which score to evaluate
#   condition   → lambda that returns True when rule fires
#   strength    → explanation when score is HIGH (used by identify_strengths)
#   weakness    → explanation when score is LOW (used by identify_weaknesses)
#   priority    → "high" / "medium" / "low" for recommendations
#   title       → short recommendation title
#   action      → specific actionable step the user can take

BUSINESS_RULES = [
    {
        "component": "diversification_score",
        "condition_weakness": lambda s: s < WEAKNESS_THRESHOLD,
        "condition_strength": lambda s: s >= STRENGTH_THRESHOLD,
        "strength": "Good number of holdings — your portfolio is well spread across multiple stocks.",
        "weakness": "Too few holdings — your portfolio is concentrated in very few stocks, increasing unsystematic risk.",
        "priority": "high",
        "title": "Add more holdings to diversify",
        "action": (
            "A well-diversified Indian retail portfolio typically holds 10-15 stocks. "
            "Consider adding exposure to sectors you currently have no holdings in, "
            "such as FMCG, pharma, or infrastructure."
        ),
    },
    {
        "component": "concentration_score",
        "condition_weakness": lambda s: s < WEAKNESS_THRESHOLD,
        "condition_strength": lambda s: s >= STRENGTH_THRESHOLD,
        "strength": "No single stock dominates your portfolio — concentration risk is well managed.",
        "weakness": (
            "One or more stocks make up too large a share of your portfolio. "
            "A single bad earnings report could significantly impact your overall returns."
        ),
        "priority": "high",
        "title": "Reduce single-stock concentration",
        "action": (
            "Financial advisors recommend no single stock exceed 20-25% of your portfolio. "
            "Consider trimming your largest position and redistributing into 2-3 different stocks."
        ),
    },
    {
        "component": "sector_score",
        "condition_weakness": lambda s: s < WEAKNESS_THRESHOLD,
        "condition_strength": lambda s: s >= STRENGTH_THRESHOLD,
        "strength": "Your holdings are spread across multiple sectors — good sector diversification.",
        "weakness": (
            "Your portfolio is heavily concentrated in one sector. "
            "Sector-specific risks like regulatory changes or global headwinds could hit all your holdings simultaneously."
        ),
        "priority": "medium",
        "title": "Balance sector allocation",
        "action": (
            "Indian markets offer opportunities across IT, financials, FMCG, pharma, energy, and auto. "
            "Consider adding at least one stock from a sector you currently have no exposure to."
        ),
    },
    {
        "component": "beta_score",
        "condition_weakness": lambda s: s < WEAKNESS_THRESHOLD,
        "condition_strength": lambda s: s >= STRENGTH_THRESHOLD,
        "strength": "Your portfolio beta is near 1.0 — it moves in line with the broader market, balancing risk and return.",
        "weakness": (
            "Your portfolio beta is far from 1.0 — it either moves much more or much less than the NIFTY 50. "
            "Very high beta means amplified losses in market downturns. "
            "Very low beta may mean you are missing market upside."
        ),
        "priority": "medium",
        "title": "Rebalance portfolio beta",
        "action": (
            "To reduce beta, add defensive stocks such as FMCG or utility companies like ITC or NTPC. "
            "To increase beta, consider adding high-growth mid-cap or IT stocks. "
            "Target a portfolio beta between 0.8 and 1.2 for a balanced risk profile."
        ),
    },
    {
        "component": "volatility_score",
        "condition_weakness": lambda s: s < WEAKNESS_THRESHOLD,
        "condition_strength": lambda s: s >= STRENGTH_THRESHOLD,
        "strength": "Your portfolio has low annualised volatility — returns are relatively stable and predictable.",
        "weakness": (
            "Your portfolio has high annualised volatility — returns fluctuate significantly. "
            "This increases the risk of large short-term losses even if long-term direction is positive."
        ),
        "priority": "low",
        "title": "Reduce portfolio volatility",
        "action": (
            "High volatility is often driven by concentrated positions in volatile sectors like IT or small-caps. "
            "Adding stable dividend-paying stocks such as HINDUNILVR, ITC, or COALINDIA "
            "can significantly reduce portfolio-level volatility."
        ),
    },
]


class ExplainabilityService:
    """
    Interprets component scores from HealthEngineService into
    human-readable strengths, weaknesses, and recommendations.

    This service receives already-computed scores — it never calculates anything.
    All business rules are stored in BUSINESS_RULES above — one location,
    no duplicated if-statements.

    Usage:
        service = ExplainabilityService(component_scores)
        strengths = service.identify_strengths()
        weaknesses = service.identify_weaknesses()
        recommendations = service.generate_recommendations()
    """

    def __init__(self, component_scores):
        """
        Args:
            component_scores: ComponentScores Pydantic model instance
                              from HealthEngineService.calculate_component_scores()
        """
        self.scores = {
            "diversification_score": component_scores.diversification_score,
            "concentration_score": component_scores.concentration_score,
            "sector_score": component_scores.sector_score,
            "beta_score": component_scores.beta_score,
            "volatility_score": component_scores.volatility_score,
        }

    def identify_strengths(self) -> list[str]:
        """
        Returns a list of human-readable strength statements.
        A component is a strength if its score >= STRENGTH_THRESHOLD (70).

        Each strength explains WHY this score is good in plain English
        so a retail investor with no finance background can understand it.
        """
        strengths = []
        for rule in BUSINESS_RULES:
            score = self.scores.get(rule["component"], 0.0)
            if rule["condition_strength"](score):
                strengths.append(rule["strength"])
        return strengths

    def identify_weaknesses(self) -> list[str]:
        """
        Returns a list of human-readable weakness statements.
        A component is a weakness if its score < WEAKNESS_THRESHOLD (45).

        Each weakness explains the RISK this creates for the investor,
        not just that the score is low.
        """
        weaknesses = []
        for rule in BUSINESS_RULES:
            score = self.scores.get(rule["component"], 0.0)
            if rule["condition_weakness"](score):
                weaknesses.append(rule["weakness"])
        return weaknesses

    def generate_recommendations(self) -> list[HealthRecommendation]:
        """
        Returns a list of HealthRecommendation objects for every weakness.
        Recommendations are ordered by priority: high → medium → low.

        Each recommendation is:
        - Specific (mentions actual stocks/sectors where possible)
        - Actionable (tells the user exactly what to do)
        - Prioritised (high priority issues come first)

        Only weaknesses generate recommendations — strengths don't need action.
        """
        raw = []
        for rule in BUSINESS_RULES:
            score = self.scores.get(rule["component"], 0.0)
            if rule["condition_weakness"](score):
                raw.append({
                    "priority": rule["priority"],
                    "title": rule["title"],
                    "action": rule["action"],
                    "score": score,
                })

        # Sort by priority: high first, then medium, then low
        priority_order = {"high": 0, "medium": 1, "low": 2}
        raw.sort(key=lambda x: priority_order.get(x["priority"], 99))

        return [
            HealthRecommendation(
                priority=r["priority"],
                title=r["title"],
                detail=f"Current score: {r['score']:.1f}/100",
                action=r["action"],
            )
            for r in raw
        ]