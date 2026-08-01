import yfinance as yf
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from typing import List

from app.models.portfolio import Holding
from app.schemas.health import ComponentScores, HealthRecommendation, PortfolioHealthResponse
from app.services.explainability_engine import ExplainabilityService

# Import sector mapping from stocks router (with robust fallback)
try:
    from app.routers.stocks import SECTOR_MAP, get_sector
except ImportError:
    from app.routers.stocks import get_sector
    SECTOR_MAP = {}

# =====================================================================
# STEP 1 — THRESHOLD CONSTANTS
# =====================================================================

# Diversification thresholds (number of unique holdings)
MIN_HOLDINGS_POOR = 2
MIN_HOLDINGS_FAIR = 4
MIN_HOLDINGS_GOOD = 7
MIN_HOLDINGS_EXCELLENT = 12

# Concentration thresholds (max single holding % of portfolio)
CONCENTRATION_EXCELLENT = 20.0   # below this = excellent
CONCENTRATION_GOOD = 30.0        # below this = good
CONCENTRATION_FAIR = 45.0        # below this = fair
CONCENTRATION_POOR = 60.0        # below this = poor, above = very poor

# Sector balance thresholds (max single sector % of portfolio)
SECTOR_EXCELLENT = 30.0
SECTOR_GOOD = 40.0
SECTOR_FAIR = 55.0
SECTOR_POOR = 70.0

# Beta thresholds (ideal beta = 0.8 to 1.2)
BETA_IDEAL_LOW = 0.8
BETA_IDEAL_HIGH = 1.2
BETA_ACCEPTABLE_LOW = 0.5
BETA_ACCEPTABLE_HIGH = 1.8

# Volatility thresholds (annualised %)
VOLATILITY_EXCELLENT = 12.0
VOLATILITY_GOOD = 20.0
VOLATILITY_FAIR = 30.0
VOLATILITY_POOR = 45.0

# Component weights (must sum to 1.0)
WEIGHT_DIVERSIFICATION = 0.30
WEIGHT_CONCENTRATION = 0.25
WEIGHT_SECTOR_BALANCE = 0.20
WEIGHT_BETA = 0.15
WEIGHT_VOLATILITY = 0.10

# Grade thresholds
GRADE_A_THRESHOLD = 80.0
GRADE_B_THRESHOLD = 65.0
GRADE_C_THRESHOLD = 50.0
GRADE_D_THRESHOLD = 35.0

# =====================================================================
# STEP 2 — PURE STANDALONE SCORING FUNCTIONS
# =====================================================================

def score_diversification(num_holdings: int) -> float:
    """
    Calculates the diversification score based on the number of unique holdings.

    Financial Rationale: Diversification reduces idiosyncratic (stock-specific) risk.
    A portfolio with 1 or 2 assets faces massive downside if one firm defaults.
    As unique holdings increase across sectors, returns become smoother.
    12+ holdings is typical to eliminate 90%+ of stock-specific risk.
    """
    if num_holdings >= MIN_HOLDINGS_EXCELLENT:
        # Band 1 (90-100): Excellent diversification.
        # We scale from 90 at 12 holdings to 100 at 15 holdings.
        return min(100.0, 90.0 + (num_holdings - MIN_HOLDINGS_EXCELLENT) * (10.0 / 3.0))
    elif num_holdings >= MIN_HOLDINGS_GOOD:
        # Band 2 (70-89): Good diversification.
        # Scale between 7 holdings (70) and 12 holdings (90).
        return 70.0 + (num_holdings - MIN_HOLDINGS_GOOD) * (20.0 / (MIN_HOLDINGS_EXCELLENT - MIN_HOLDINGS_GOOD))
    elif num_holdings >= MIN_HOLDINGS_FAIR:
        # Band 3 (45-69): Fair diversification.
        # Scale between 4 holdings (45) and 7 holdings (70).
        return 45.0 + (num_holdings - MIN_HOLDINGS_FAIR) * (25.0 / (MIN_HOLDINGS_GOOD - MIN_HOLDINGS_FAIR))
    elif num_holdings >= MIN_HOLDINGS_POOR:
        # Band 4 (20-44): Poor diversification.
        # Scale between 2 holdings (20) and 4 holdings (45).
        return 20.0 + (num_holdings - MIN_HOLDINGS_POOR) * (25.0 / (MIN_HOLDINGS_FAIR - MIN_HOLDINGS_POOR))
    else:
        # Band 5 (0-19): Extremely poor diversification.
        # Scale between 0 holdings (0) and 2 holdings (20).
        return max(0.0, float(num_holdings) * 10.0)

def score_concentration(holdings_values: List[float]) -> float:
    """
    Calculates the concentration score based on the maximum single holding percentage.

    Financial Rationale: Concentration risk happens when a single stock occupies a large
    portion of the portfolio's value. If that specific stock experiences severe drawdowns,
    the aggregate portfolio suffers significantly. Keeping maximum single stock weight
    below 20-30% limits the downside exposure to any single company.
    """
    if not holdings_values or len(holdings_values) <= 1:
        return 100.0

    total_val = sum(holdings_values)
    if total_val == 0:
        return 100.0

    max_pct = (max(holdings_values) / total_val) * 100.0

    if max_pct <= CONCENTRATION_EXCELLENT:
        # Band 1 (90-100): Excellent concentration control.
        # Perfect (theoretical minimum weight) to 20% weight.
        return 100.0 - (max_pct / CONCENTRATION_EXCELLENT) * 10.0
    elif max_pct <= CONCENTRATION_GOOD:
        # Band 2 (70-89): Good control.
        # Scale from 20% weight (90.0) down to 30% weight (70.0).
        return 90.0 - (max_pct - CONCENTRATION_EXCELLENT) * (20.0 / (CONCENTRATION_GOOD - CONCENTRATION_EXCELLENT))
    elif max_pct <= CONCENTRATION_FAIR:
        # Band 3 (45-69): Fair control.
        # Scale from 30% weight (70.0) down to 45% weight (45.0).
        return 70.0 - (max_pct - CONCENTRATION_GOOD) * (25.0 / (CONCENTRATION_FAIR - CONCENTRATION_GOOD))
    elif max_pct <= CONCENTRATION_POOR:
        # Band 4 (20-44): Poor control.
        # Scale from 45% weight (45.0) down to 60% weight (20.0).
        return 45.0 - (max_pct - CONCENTRATION_FAIR) * (25.0 / (CONCENTRATION_POOR - CONCENTRATION_FAIR))
    else:
        # Band 5 (0-19): Very high concentration.
        # Scale from 60% weight (20.0) down to 100% weight (0.0).
        return max(0.0, 20.0 - (max_pct - CONCENTRATION_POOR) * (20.0 / (100.0 - CONCENTRATION_POOR)))

def score_sector_balance(sector_allocations: dict[str, float]) -> float:
    """
    Calculates the sector balance score based on maximum single sector allocation.

    Financial Rationale for Indian Markets: The Indian stock market is highly cyclical.
    Sectors like Financial Services, IT, and Commodities make up massive chunks of indexes.
    However, regulatory shifts (RBI policy changes, foreign exchange fluctuations) can trigger
    sector-wide downswings. Balanced exposure (<30% in any sector) protects the investor.
    """
    if not sector_allocations:
        return 50.0

    max_sector_pct = max(sector_allocations.values())

    if max_sector_pct <= SECTOR_EXCELLENT:
        # Band 1 (90-100): Excellent sector balance.
        return 100.0 - (max_sector_pct / SECTOR_EXCELLENT) * 10.0
    elif max_sector_pct <= SECTOR_GOOD:
        # Band 2 (70-89): Good balance.
        return 90.0 - (max_sector_pct - SECTOR_EXCELLENT) * (20.0 / (SECTOR_GOOD - SECTOR_EXCELLENT))
    elif max_sector_pct <= SECTOR_FAIR:
        # Band 3 (45-69): Fair balance.
        return 70.0 - (max_sector_pct - SECTOR_GOOD) * (25.0 / (SECTOR_FAIR - SECTOR_GOOD))
    elif max_sector_pct <= SECTOR_POOR:
        # Band 4 (20-44): Poor balance.
        return 45.0 - (max_sector_pct - SECTOR_FAIR) * (25.0 / (SECTOR_POOR - SECTOR_FAIR))
    else:
        # Band 5 (0-19): Critical sector overexposure.
        return max(0.0, 20.0 - (max_sector_pct - SECTOR_POOR) * (20.0 / (100.0 - SECTOR_POOR)))

def score_beta(beta: float) -> float:
    """
    Calculates the beta score. A beta close to 1.0 is ideal for a balanced retail investor.

    Financial Rationale for Indian Retail Investors: Beta represents market sensitivity.
    A beta of 1.0 matches the NIFTY 50 index benchmark. High beta (>1.2) means the portfolio is
    aggressive and volatile during standard market corrections, whereas low beta (<0.8) is defensive
    and may underperform during bull runs. A balanced target range of 0.8 to 1.2 is ideal.
    """
    if beta is None or beta == 0.0:
        return 50.0

    d = abs(beta - 1.0)

    # Symmetric distance scoring based on maximum boundaries:
    # d = 0.2 (beta 0.8 or 1.2) -> score 90
    # d = 0.8 (beta 0.2 or 1.8) -> score 70
    # d = 1.5 (beta -0.5 or 2.5) -> score 40
    if d <= 0.2:
        # Band 1 (90-100): Ideal beta
        return 100.0 - (d / 0.2) * 10.0
    elif d <= 0.8:
        # Band 2 (70-89): Acceptable beta
        return 89.0 - ((d - 0.2) / 0.6) * 19.0
    elif d <= 1.5:
        # Band 3 (40-69): Slightly high/low beta sensitivity
        return 69.0 - ((d - 0.8) / 0.7) * 29.0
    else:
        # Band 4 (0-39): Extreme beta sensitivity (aggressive or negative correlation)
        return max(0.0, 39.0 - ((d - 1.5) / 1.5) * 39.0)

def score_volatility(annualised_volatility_pct: float) -> float:
    """
    Calculates the volatility score based on annualized volatility percentage.

    Financial Rationale: Volatility is the annualized standard deviation of daily returns.
    While institutional managers use derivatives to hedge volatility, retail investors
    primarily feel its psychological pressure, leading to panic-selling. Lower volatility
    (<12-20%) represents a stable, stress-free portfolio structure for general retail investors.
    """
    if annualised_volatility_pct is None or annualised_volatility_pct <= 0.0:
        return 50.0

    if annualised_volatility_pct <= VOLATILITY_EXCELLENT:
        # Band 1 (90-100): Extremely stable portfolio
        return 100.0 - (annualised_volatility_pct / VOLATILITY_EXCELLENT) * 10.0
    elif annualised_volatility_pct <= VOLATILITY_GOOD:
        # Band 2 (70-89): Good stability
        return 89.0 - (annualised_volatility_pct - VOLATILITY_EXCELLENT) * (19.0 / (VOLATILITY_GOOD - VOLATILITY_EXCELLENT))
    elif annualised_volatility_pct <= VOLATILITY_FAIR:
        # Band 3 (45-69): Moderate volatility swings
        return 69.0 - (annualised_volatility_pct - VOLATILITY_GOOD) * (24.0 / (VOLATILITY_FAIR - VOLATILITY_GOOD))
    elif annualised_volatility_pct <= VOLATILITY_POOR:
        # Band 4 (20-44): High volatility swings
        return 44.0 - (annualised_volatility_pct - VOLATILITY_FAIR) * (24.0 / (VOLATILITY_POOR - VOLATILITY_FAIR))
    else:
        # Band 5 (0-19): Extreme volatility risk
        return max(0.0, 19.0 - (annualised_volatility_pct - VOLATILITY_POOR) * (19.0 / (100.0 - VOLATILITY_POOR)))

# =====================================================================
# STEP 3 — GRADE COMPUTATION FUNCTION
# =====================================================================

def compute_grade(score: float) -> str:
    """
    Determines the portfolio health letter grade based on composite score thresholds.

    Args:
        score (float): The final weighted composite score.

    Returns:
        str: Grade letter ('A', 'B', 'C', 'D', 'F').
    """
    if score >= GRADE_A_THRESHOLD:
        return "A"
    elif score >= GRADE_B_THRESHOLD:
        return "B"
    elif score >= GRADE_C_THRESHOLD:
        return "C"
    elif score >= GRADE_D_THRESHOLD:
        return "D"
    else:
        return "F"

# =====================================================================
# HEALTH ENGINE SERVICE
# =====================================================================

class HealthEngineService:
    """
    Service responsible for analyzing a portfolio's holdings and calculating health metrics.

    This service evaluates portfolio risk, diversification, volatility, and sector balance
    using various quantitative models and outputs a composite health score, component scores,
    and prioritised actionable rebalancing recommendations.
    """

    def __init__(self, holdings: List[Holding], db: Session):
        """
        Initializes the HealthEngineService with portfolio holdings and database session.

        Args:
            holdings (List[Holding]): The list of current holdings in the portfolio.
            db (Session): The SQLAlchemy database session.
        """
        self.holdings = holdings
        self.db = db

        # Attributes storing intermediate scores for weights calculation
        self._div_score = 0.0
        self._conc_score = 0.0
        self._sector_score = 0.0
        self._beta_score = 0.0
        self._vol_score = 0.0

    def calculate_health_score(self) -> float:
        """
        Computes the weighted composite health score for the portfolio.

        This calculation combines individual score components (Sharpe/Concentration,
        Volatility, Diversification, Sector Balance, Beta) weighted by standard risk factors.

        Returns:
            float: Composite health score on a scale from 0.0 to 100.0.
        """
        weighted_sum = (
            self._div_score * WEIGHT_DIVERSIFICATION +
            self._conc_score * WEIGHT_CONCENTRATION +
            self._sector_score * WEIGHT_SECTOR_BALANCE +
            self._beta_score * WEIGHT_BETA +
            self._vol_score * WEIGHT_VOLATILITY
        )
        return round(weighted_sum, 1)

    def calculate_component_scores(self) -> ComponentScores:
        """
        Calculates individual component metrics for the portfolio.

        Calculates distinct sub-scores based on specific quantitative methodologies:
        - Volatility: measures historical standard deviation of returns.
        - Diversification: calculated using index of concentration.
        - Sharpe (Concentration): risk-adjusted concentration profile.
        - Sector Balance: assesses overexposure in single industries.
        - Beta: risk relative to NIFTY 50 index benchmark.

        Returns:
            ComponentScores: Model containing all sub-scores.
        """
        total_value = sum(h.quantity * h.buy_price for h in self.holdings)
        holding_values = [h.quantity * h.buy_price for h in self.holdings]

        # Calculate static indicators
        diversification_score = score_diversification(len(self.holdings))
        concentration_score = score_concentration(holding_values)

        # Calculate sector allocations
        sector_totals: dict[str, float] = {}
        for h in self.holdings:
            sector = get_sector(h.ticker)
            sector_totals[sector] = sector_totals.get(sector, 0) + (h.quantity * h.buy_price)

        sector_pct = (
            {s: round(v / total_value * 100, 1) for s, v in sector_totals.items()}
            if total_value > 0 else {}
        )
        sector_score = score_sector_balance(sector_pct)

        # Download market metrics using yfinance with standard NSE suffixes (.NS)
        try:
            tickers = [h.ticker + ".NS" for h in self.holdings]
            all_tickers = tickers + ["^NSEI"]
            data = yf.download(all_tickers, period="1y", auto_adjust=True, progress=False)['Close']

            if isinstance(data, pd.Series):
                data = data.to_frame()

            # Align timeseries and compute daily percent changes
            returns = data.pct_change().dropna()

            # Safeguard: Verify download returned data for our holding tickers
            present_tickers = [t for t in tickers if t in returns.columns]

            if present_tickers and total_value > 0:
                # Map active tickers to their respective values to re-normalize weights
                ticker_vals = {h.ticker + ".NS": h.quantity * h.buy_price for h in self.holdings}
                active_vals = [ticker_vals[t] for t in present_tickers]
                active_total = sum(active_vals)

                if active_total > 0:
                    active_weights = np.array([v / active_total for v in active_vals])
                    
                    # Compute weighted daily portfolio returns
                    portfolio_returns = returns[present_tickers].values @ active_weights

                    # Volatility calculation: daily returns standard deviation annualized
                    annualised_vol = float(np.std(portfolio_returns) * np.sqrt(252) * 100)
                    volatility_score = score_volatility(annualised_vol)

                    # Beta calculation: Covariance(Portfolio, Nifty) / Variance(Nifty)
                    computed_beta = 1.0
                    if "^NSEI" in returns.columns:
                        nifty_returns = returns["^NSEI"].values
                        min_len = min(len(portfolio_returns), len(nifty_returns))
                        port_r = portfolio_returns[-min_len:]
                        nifty_r = nifty_returns[-min_len:]
                        
                        covariance = np.cov(port_r, nifty_r)[0][1]
                        nifty_variance = np.var(nifty_r)
                        computed_beta = float(covariance / nifty_variance) if nifty_variance != 0 else 1.0

                    beta_score = score_beta(computed_beta)
                else:
                    volatility_score = 50.0
                    beta_score = 50.0
            else:
                volatility_score = 50.0
                beta_score = 50.0

        except Exception as e:
            # Graceful error handling prevents yfinance download failures from crashing the app
            print(f"Error downloading market health metrics: {e}")
            volatility_score = 50.0
            beta_score = 50.0

        # Store intermediate scores internally on self
        self._div_score = diversification_score
        self._conc_score = concentration_score
        self._sector_score = sector_score
        self._beta_score = beta_score
        self._vol_score = volatility_score

        # Return ComponentScores rounding to 1 decimal place.
        # Note: Sharpe score slot is used for concentration scoring in this schema iteration.
        return ComponentScores(
            volatility_score=round(self._vol_score, 1),
            diversification_score=round(self._div_score, 1),
            sharpe_score=round(self._conc_score, 1),
            sector_score=round(self._sector_score, 1),
            beta_score=round(self._beta_score, 1)
        )

    def identify_strengths(self) -> List[str]:
        """
        Identifies positive aspects of the portfolio.

        Returns:
            List[str]: List of key portfolio strengths.
        """
        return []

    def identify_weaknesses(self) -> List[str]:
        """
        Identifies vulnerabilities or areas of concern in the portfolio.

        Returns:
            List[str]: List of identified vulnerabilities.
        """
        return []

    def generate_recommendations(self) -> List[HealthRecommendation]:
        """
        Generates prioritised actionable recommendations to resolve portfolio weaknesses.

        Returns:
            List[HealthRecommendation]: List of prioritized recommendations.
        """
        return []

    def evaluate(self) -> PortfolioHealthResponse:
    """
    Orchestrates the full health evaluation pipeline:
    1. Calculate component scores (numbers)
    2. Calculate weighted health score (number)
    3. Compute grade (letter)
    4. Interpret scores into strengths/weaknesses/recommendations (language)
    """
    # Step 1 — scores
    component_scores = self.calculate_component_scores()

    # Step 2 — weighted score
    health_score = self.calculate_health_score()

    # Step 3 — grade
    grade = compute_grade(health_score)

    # Step 4 — explainability
    explainer = ExplainabilityService(component_scores)
    strengths = explainer.identify_strengths()
    weaknesses = explainer.identify_weaknesses()
    recommendations = explainer.generate_recommendations()

    total_invested = sum(h.quantity * h.buy_price for h in self.holdings)

    return PortfolioHealthResponse(
        portfolio_id=self.holdings[0].portfolio_id,
        health_score=health_score,
        grade=grade,
        component_scores=component_scores,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=recommendations,
        holdings_count=len(self.holdings),
        total_invested=round(total_invested, 2),
    )