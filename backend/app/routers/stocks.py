from fastapi import APIRouter, HTTPException, Depends
import yfinance as yf
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.portfolio import Holding, Portfolio
from app.routers.auth import get_current_user
from app.models.user import User
import requests
from app.config import settings

yf.set_tz_cache_location("/tmp/yfinance_cache")

router = APIRouter()

# --- Dynamic Sector Mapping with Cache ---
# We use a simple in-memory cache to avoid redundant and slow API calls.
# Ideally, this would be stored in a database or Redis in production.
_sector_cache = {
    # Pre-populate some common mappings to save time
    "INFY": "Information Technology", "TCS": "Information Technology",
    "HDFCBANK": "Financial Services", "RELIANCE": "Energy",
    "ITC": "FMCG", "TATAMOTORS": "Automobile"
}

def get_sector(ticker: str) -> str:
    """Fetch sector dynamically from yfinance API with local caching."""
    ticker_upper = ticker.upper().strip()
    
    # Check cache first
    if ticker_upper in _sector_cache:
        return _sector_cache[ticker_upper]
    
    try:
        # Fetch from yfinance
        # Try NSE symbol first as it's the primary market for this app
        stock = yf.Ticker(ticker_upper + ".NS")
        info = stock.info
        
        # If no sector (e.g. not an NSE stock), try without suffix
        sector = info.get("sector")
        if not sector:
            stock = yf.Ticker(ticker_upper)
            info = stock.info
            sector = info.get("sector")
            
        if sector:
            _sector_cache[ticker_upper] = sector
            return sector
            
        return "Others"
    except Exception as e:
        print(f"Error fetching sector for {ticker_upper}: {e}")
        return "Others"


# --- Endpoint Routes ---

@router.get("/risk/{portfolio_id}")
def get_risk_metrics(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings in portfolio")

    try:
        tickers = [h.ticker + ".NS" for h in holdings]

        # Download holdings + NIFTY 50 benchmark
        all_tickers = tickers + ["^NSEI"]
        data = yf.download(all_tickers, period="1y", auto_adjust=True)['Close']

        if isinstance(data, pd.Series):
            data = data.to_frame()

        returns = data.pct_change().dropna()

        total = sum(h.quantity * h.buy_price for h in holdings)
        weights = np.array([(h.quantity * h.buy_price) / total for h in holdings])

        # Portfolio returns (excluding NIFTY)
        holding_returns = returns[[t for t in tickers if t in returns.columns]]
        portfolio_returns = holding_returns.values @ weights

        # Risk-free rate (India 6%)
        risk_free = 0.06 / 252
        excess_returns = portfolio_returns - risk_free

        # Sharpe ratio
        sharpe = round(float(np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)), 2)

        # Volatility
        volatility = round(float(np.std(portfolio_returns) * np.sqrt(252) * 100), 2)

        # VaR
        var_95 = round(float(np.percentile(portfolio_returns, 5) * total), 2)

        # Beta against NIFTY 50
        beta = 1.0
        if "^NSEI" in returns.columns:
            nifty_returns = returns["^NSEI"].values
            min_len = min(len(portfolio_returns), len(nifty_returns))
            port_r = portfolio_returns[-min_len:]
            nifty_r = nifty_returns[-min_len:]
            covariance = np.cov(port_r, nifty_r)[0][1]
            nifty_variance = np.var(nifty_r)
            beta = round(float(covariance / nifty_variance), 2) if nifty_variance != 0 else 1.0

        # Diversification score
        if len(tickers) > 1:
            holding_rets = returns[[t for t in tickers if t in returns.columns]]
            corr_matrix = holding_rets.corr()
            n = len(corr_matrix)
            avg_corr = (corr_matrix.sum().sum() - n) / (n * (n - 1)) if n > 1 else 0
            diversification = round((1 - avg_corr) * 100, 1)
        else:
            diversification = 0

        # Sector breakdown
        sector_allocation = {}
        for h in holdings:
            sector = get_sector(h.ticker)
            value = h.quantity * h.buy_price
            sector_allocation[sector] = sector_allocation.get(sector, 0) + value

        sector_pct = {
            s: round(v / total * 100, 1)
            for s, v in sector_allocation.items()
        }

        # Sector concentration risk
        max_sector_pct = max(sector_pct.values()) if sector_pct else 0
        sector_concentrated = max_sector_pct > 40

        return {
            "sharpe_ratio": sharpe,
            "volatility_pct": volatility,
            "var_95": var_95,
            "beta": beta,
            "diversification_score": diversification,
            "total_invested": round(total, 2),
            "holdings_count": len(holdings),
            "sector_allocation": sector_pct,
            "sector_concentrated": sector_concentrated,
            "interpretation": {
                "sharpe": "Good" if sharpe > 1 else "Average" if sharpe > 0 else "Poor",
                "volatility": "Low" if volatility < 15 else "Moderate" if volatility < 25 else "High",
                "diversification": "Well diversified" if diversification > 60 else "Moderately diversified" if diversification > 40 else "Concentrated",
                "beta": "Defensive" if beta < 0.8 else "Market-neutral" if beta < 1.2 else "Aggressive"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk calculation failed: {str(e)}")


@router.post("/prices")
@router.post("/prices")
def get_multiple_prices(tickers: list[str]):
    try:
        ns_tickers = [t + ".NS" for t in tickers]
        data = yf.download(
            ns_tickers,
            period="2d",
            auto_adjust=True,
            progress=False
        )['Close']

        if isinstance(data, pd.Series):
            data = data.to_frame()
            data.columns = [tickers[0]]
        else:
            # Rename columns from TICKER.NS back to TICKER
            data.columns = [col.replace(".NS", "") for col in data.columns]

        results = {}
        for ticker in tickers:
            try:
                if ticker in data.columns:
                    last_price = data[ticker].dropna().iloc[-1]
                    results[ticker] = round(float(last_price), 2)
                else:
                    results[ticker] = None
            except:
                results[ticker] = None

        return results

    except Exception as e:
        # Fallback — return None for all tickers gracefully
        return {ticker: None for ticker in tickers}


@router.get("/news/{ticker}")
def get_news_sentiment(ticker: str):
    news_api_key = settings.NEWS_API_KEY
    try:
        # Search for news about this stock
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": ticker,
            "apiKey": news_api_key,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 5
        }
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if data.get("status") != "ok":
            return {"ticker": ticker, "articles": [], "sentiment": "neutral"}

        articles = []
        negative_keywords = ["fall", "drop", "crash", "loss", "decline", "down", "weak",
                           "sell", "concern", "risk", "fraud", "penalty", "fine", "lawsuit"]
        positive_keywords = ["rise", "gain", "up", "growth", "profit", "strong", "buy",
                           "upgrade", "beat", "record", "high", "surge", "rally"]

        negative_count = 0
        positive_count = 0

        for article in data.get("articles", [])[:5]:
            title = article.get("title", "")
            description = article.get("description", "") or ""
            text = (title + " " + description).lower()

            neg = sum(1 for kw in negative_keywords if kw in text)
            pos = sum(1 for kw in positive_keywords if kw in text)
            negative_count += neg
            positive_count += pos

            sentiment = "negative" if neg > pos else "positive" if pos > neg else "neutral"
            articles.append({
                "title": title,
                "source": article.get("source", {}).get("name", ""),
                "published": article.get("publishedAt", "")[:10],
                "url": article.get("url", ""),
                "sentiment": sentiment
            })

        overall = "negative" if negative_count > positive_count else "positive" if positive_count > negative_count else "neutral"

        return {
            "ticker": ticker,
            "articles": articles,
            "sentiment": overall,
            "positive_signals": positive_count,
            "negative_signals": negative_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatif/{portfolio_id}")
def whatif_simulation(
    portfolio_id: int,
    adjustments: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    adjustments: {"INFY": -10, "RELIANCE": +10} — percentage shifts
    """
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    total = sum(h.quantity * h.buy_price for h in holdings)

    # Current allocations
    current = {h.ticker: round(h.quantity * h.buy_price / total * 100, 1) for h in holdings}

    # Apply adjustments
    new_alloc = current.copy()
    for ticker, change in adjustments.items():
        if ticker in new_alloc:
            new_alloc[ticker] = max(0, new_alloc[ticker] + change)

    # Normalize to 100%
    total_pct = sum(new_alloc.values())
    if total_pct > 0:
        new_alloc = {k: round(v / total_pct * 100, 1) for k, v in new_alloc.items()}

    try:
        tickers = [h.ticker + ".NS" for h in holdings]
        data = yf.download(tickers, period="1y", auto_adjust=True)['Close']
        if isinstance(data, pd.Series):
            data = data.to_frame()

        returns = data.pct_change().dropna()

        # Current Sharpe
        current_weights = np.array([current.get(h.ticker, 0) / 100 for h in holdings])
        current_port_returns = returns.values @ current_weights
        risk_free = 0.06 / 252
        current_sharpe = round(float(
            np.mean(current_port_returns - risk_free) /
            np.std(current_port_returns) * np.sqrt(252)
        ), 2)

        # New Sharpe
        new_weights = np.array([new_alloc.get(h.ticker, 0) / 100 for h in holdings])
        new_port_returns = returns.values @ new_weights
        new_sharpe = round(float(
            np.mean(new_port_returns - risk_free) /
            np.std(new_port_returns) * np.sqrt(252)
        ), 2)

        # New volatility
        new_vol = round(float(np.std(new_port_returns) * np.sqrt(252) * 100), 2)
        current_vol = round(float(np.std(current_port_returns) * np.sqrt(252) * 100), 2)

        return {
            "current_allocation": current,
            "new_allocation": new_alloc,
            "current_sharpe": current_sharpe,
            "new_sharpe": new_sharpe,
            "current_volatility": current_vol,
            "new_volatility": new_vol,
            "sharpe_change": round(new_sharpe - current_sharpe, 2),
            "volatility_change": round(new_vol - current_vol, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/{query}")
def search_stocks(query: str):
    """Search for stocks by name or ticker"""
    try:
        ticker = yf.Ticker(query + ".NS")
        info = ticker.info
        if info.get("longName"):
            return [{
                "ticker": query.upper(),
                "name": info.get("longName", query.upper()),
                "exchange": "NSE",
                "type": "stock"
            }]
        # Try without .NS
        ticker = yf.Ticker(query)
        info = ticker.info
        if info.get("longName"):
            return [{
                "ticker": query.upper(),
                "name": info.get("longName", query.upper()),
                "exchange": info.get("exchange", ""),
                "type": "stock"
            }]
        return []
    except:
        return []


@router.get("/history/{portfolio_id}")
def get_portfolio_history(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    try:
        tickers = [h.ticker + ".NS" for h in holdings]
        data = yf.download(tickers, period="6mo", auto_adjust=True)['Close']

        if isinstance(data, pd.Series):
            data = data.to_frame()
            data.columns = [holdings[0].ticker + ".NS"]

        # Fill missing values
        data = data.ffill().dropna()

        # Compute portfolio value over time
        history = []
        for date, row in data.iterrows():
            total_value = 0
            for h in holdings:
                ticker_ns = h.ticker + ".NS"
                if ticker_ns in row.index:
                    price = float(row[ticker_ns])
                    total_value += h.quantity * price
            history.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": round(total_value, 2)
            })

        # Also compute invested value (constant)
        invested = sum(h.quantity * h.buy_price for h in holdings)

        return {
            "history": history,
            "invested": round(invested, 2),
            "current": history[-1]["value"] if history else invested
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/riskscore/{portfolio_id}")
def get_risk_score(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    try:
        tickers = [h.ticker + ".NS" for h in holdings]
        all_tickers = tickers + ["^NSEI"]
        data = yf.download(all_tickers, period="1y", auto_adjust=True)['Close']

        if isinstance(data, pd.Series):
            data = data.to_frame()

        returns = data.pct_change().dropna()
        total = sum(h.quantity * h.buy_price for h in holdings)
        weights = np.array([(h.quantity * h.buy_price) / total for h in holdings])

        holding_returns = returns[[t for t in tickers if t in returns.columns]]
        portfolio_returns = holding_returns.values @ weights

        risk_free = 0.06 / 252

        # Component scores (each 0-100, lower = riskier)
        scores = {}

        # 1. Sharpe ratio score (range -3 to 3, normalize)
        sharpe = float(np.mean(portfolio_returns - risk_free) / np.std(portfolio_returns) * np.sqrt(252))
        sharpe_score = min(100, max(0, (sharpe + 2) / 4 * 100))
        scores['sharpe'] = round(sharpe_score, 1)

        # 2. Volatility score (0-50% annualized, lower is better)
        vol = float(np.std(portfolio_returns) * np.sqrt(252) * 100)
        vol_score = min(100, max(0, (1 - vol / 50) * 100))
        scores['volatility'] = round(vol_score, 1)

        # 3. Diversification score (number of holdings)
        n = len(holdings)
        div_score = min(100, n / 15 * 100)
        scores['diversification'] = round(div_score, 1)

        # 4. Sector concentration score
        sector_alloc: dict = {}
        for h in holdings:
            sector = get_sector(h.ticker)
            sector_alloc[sector] = sector_alloc.get(sector, 0) + (h.quantity * h.buy_price)
        max_sector_pct = max(v / total * 100 for v in sector_alloc.values())
        concentration_score = min(100, max(0, (1 - max_sector_pct / 100) * 100))
        scores['concentration'] = round(concentration_score, 1)

        # 5. Beta score (ideal beta = 0.8-1.2)
        beta_score = 100.0
        if "^NSEI" in returns.columns:
            nifty_r = returns["^NSEI"].values
            min_len = min(len(portfolio_returns), len(nifty_r))
            cov = np.cov(portfolio_returns[-min_len:], nifty_r[-min_len:])[0][1]
            var = np.var(nifty_r[-min_len:])
            beta = float(cov / var) if var != 0 else 1.0
            beta_score = max(0, 100 - abs(beta - 1.0) * 50)
        scores['beta'] = round(beta_score, 1)

        # Weighted composite score
        weights_score = {
            'sharpe': 0.30,
            'volatility': 0.25,
            'diversification': 0.20,
            'concentration': 0.15,
            'beta': 0.10,
        }
        composite = sum(scores[k] * weights_score[k] for k in scores)
        composite = round(composite, 1)

        # Risk level
        if composite >= 70:
            level = "Low Risk"
            color = "green"
            description = "Your portfolio is well-structured with good risk-adjusted returns."
        elif composite >= 45:
            level = "Moderate Risk"
            color = "amber"
            description = "Your portfolio has moderate risk. Consider diversifying further."
        else:
            level = "High Risk"
            color = "red"
            description = "Your portfolio carries significant risk. Rebalancing recommended."

        return {
            "score": composite,
            "level": level,
            "color": color,
            "description": description,
            "components": {
                "Sharpe Ratio Quality": scores['sharpe'],
                "Volatility": scores['volatility'],
                "Diversification": scores['diversification'],
                "Sector Balance": scores['concentration'],
                "Market Sensitivity": scores['beta'],
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health/{portfolio_id}")
def get_portfolio_health(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    holdings = db.query(Holding).filter(
        Holding.portfolio_id == portfolio_id
    ).all()

    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    total = sum(h.quantity * h.buy_price for h in holdings)

    tickers = [h.ticker + ".NS" for h in holdings]

    data = yf.download(
        tickers + ["^NSEI"],
        period="1y",
        auto_adjust=True
    )["Close"]

    if isinstance(data, pd.Series):
        data = data.to_frame()

    returns = data.pct_change().dropna()

    weights = np.array([
        (h.quantity * h.buy_price) / total
        for h in holdings
    ])

    holding_returns = returns[[t for t in tickers if t in returns.columns]]
    portfolio_returns = holding_returns.values @ weights

    # --------------------------
    # Diversification
    # --------------------------

    diversification = min(len(holdings) / 12 * 100, 100)

    # --------------------------
    # Concentration
    # --------------------------

    allocations = [
        h.quantity * h.buy_price / total * 100
        for h in holdings
    ]

    max_alloc = max(allocations)

    concentration_score = max(0, 100 - max_alloc)

    # --------------------------
    # Sector Balance
    # --------------------------

    sectors = {}

    for h in holdings:
        s = get_sector(h.ticker)
        sectors[s] = sectors.get(s, 0) + h.quantity * h.buy_price

    largest_sector = max(sectors.values()) / total * 100

    sector_score = max(0, 100 - largest_sector)

    # --------------------------
    # Volatility
    # --------------------------

    annual_vol = np.std(portfolio_returns) * np.sqrt(252) * 100

    volatility_score = max(
        0,
        min(100, 100 - annual_vol)
    )

    # --------------------------
    # Beta
    # --------------------------

    beta = 1

    if "^NSEI" in returns.columns:

        nifty = returns["^NSEI"].values

        m = min(len(nifty), len(portfolio_returns))

        cov = np.cov(
            portfolio_returns[-m:],
            nifty[-m:]
        )[0][1]

        var = np.var(nifty[-m:])

        beta = cov / var if var else 1

    beta_score = max(
        0,
        100 - abs(beta - 1) * 50
    )

    component_scores = {
        "diversification_score": round(diversification),
        "concentration_score": round(concentration_score),
        "sector_balance_score": round(sector_score),
        "beta_score": round(beta_score),
        "volatility_score": round(volatility_score)
    }

    health_score = round(
        sum(component_scores.values()) / len(component_scores)
    )

    if health_score >= 90:
        grade = "A"
    elif health_score >= 75:
        grade = "B"
    elif health_score >= 60:
        grade = "C"
    elif health_score >= 45:
        grade = "D"
    else:
        grade = "F"

    strengths = []

    weaknesses = []

    recommendations = []

    if diversification >= 70:
        strengths.append("Well diversified portfolio")

    else:
        weaknesses.append("Portfolio has limited diversification")

        recommendations.append({
            "priority": "high",
            "title": "Increase diversification",
            "detail": "Too few stocks increase concentration risk.",
            "action": "Add holdings from different sectors."
        })

    if largest_sector <= 35:
        strengths.append("Good sector balance")

    else:
        weaknesses.append("Sector concentration is high")

        recommendations.append({
            "priority": "medium",
            "title": "Reduce sector concentration",
            "detail": f"{largest_sector:.1f}% invested in one sector.",
            "action": "Reduce overweight positions."
        })

    if beta_score < 50:

        recommendations.append({
            "priority": "low",
            "title": "Improve market balance",
            "detail": "Portfolio beta is far from market average.",
            "action": "Blend defensive and growth stocks."
        })

    return {
        "health_score": health_score,
        "grade": grade,
        "holdings_count": len(holdings),
        "total_invested": round(total, 2),
        "component_scores": component_scores,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations
    }

@router.get("/benchmark/{portfolio_id}")
def get_benchmark_comparison(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    try:
        # 1. Strip and clean tickers to absolutely prevent "TICKER.NS.NS"
        tickers = []
        cleaned_holdings = []
        
        for h in holdings:
            if not h.ticker:
                continue
            ticker_str = str(h.ticker).strip()
            # If it already ends with .NS, leave it; otherwise append it
            ticker_ns = ticker_str if ticker_str.upper().endswith(".NS") else f"{ticker_str}.NS"
            tickers.append(ticker_ns)
            cleaned_holdings.append((h, ticker_ns))

        if not tickers:
            raise HTTPException(status_code=400, detail="No valid tickers found in portfolio")

        all_tickers = list(set(tickers + ["^NSEI"]))
        
        # 2. Download from Yahoo Finance
        df = yf.download(all_tickers, period="6mo", auto_adjust=True)
        if df.empty:
            raise HTTPException(status_code=400, detail="No data received from Yahoo Finance")

        # Safely isolate the close prices
        data = df['Close'] if 'Close' in df else df
        if isinstance(data, pd.Series):
            data = data.to_frame()

        # 3. Modern Pandas filling: forward fill gaps, then backfill remaining gaps
        data = data.ffill().bfill()

        # Compute portfolio value over time
        result = []
        for date, row in data.iterrows():
            portfolio_value = 0.0
            
            for h, ticker_ns in cleaned_holdings:
                qty = float(h.quantity or 0)
                bp = float(h.buy_price or 0)
                
                # Check row column availability safely
                if ticker_ns in row.index and not pd.isna(row[ticker_ns]):
                    portfolio_value += qty * float(row[ticker_ns])
                else:
                    portfolio_value += qty * bp # Fallback gracefully to buy price if market data missing

            nifty_value = float(row["^NSEI"]) if "^NSEI" in row.index and not pd.isna(row["^NSEI"]) else None

            if nifty_value is not None:
                result.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "portfolio": round(portfolio_value, 2),
                    "nifty_raw": round(nifty_value, 2),
                })

        if not result:
            raise HTTPException(status_code=400, detail="Could not align timeline data data points")

        # 4. Normalize both assets to 100 base index value
        first_portfolio = result[0]["portfolio"] if result[0]["portfolio"] > 0 else 1
        first_nifty = result[0]["nifty_raw"] if result[0]["nifty_raw"] > 0 else 1

        normalized = []
        for r in result:
            normalized.append({
                "date": r["date"],
                "portfolio": round((r["portfolio"] / first_portfolio) * 100, 2),
                "nifty": round((r["nifty_raw"] / first_nifty) * 100, 2),
            })

        # Calculate historical alpha spread
        final_portfolio_return = normalized[-1]["portfolio"] - 100
        final_nifty_return = normalized[-1]["nifty"] - 100
        alpha = round(final_portfolio_return - final_nifty_return, 2)

        return {
            "data": normalized,
            "portfolio_return": round(final_portfolio_return, 2),
            "nifty_return": round(final_nifty_return, 2),
            "alpha": alpha,
            "outperformed": alpha > 0
        }
        
    except Exception as e:
        # This will output the exact failing traceback line to your terminal console logs
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ticker}")
def get_stock(ticker: str):
    clean_ticker = ticker.strip().upper()
    
    try:
        # Try Indian Exchange ticker (.NS) first
        search_symbol = f"{clean_ticker}.NS" if not clean_ticker.endswith((".NS", ".BO")) else clean_ticker
        
        data = yf.download(
            search_symbol,
            period="2d",
            auto_adjust=True,
            progress=False
        )

        # Fallback to direct ticker (e.g. US stocks like AAPL, MSFT) if .NS returned nothing
        if data.empty and search_symbol != clean_ticker:
            search_symbol = clean_ticker
            data = yf.download(
                search_symbol,
                period="2d",
                auto_adjust=True,
                progress=False
            )

        if data.empty or 'Close' not in data:
            raise HTTPException(
                status_code=404,
                detail=f"No pricing data found for ticker '{clean_ticker}'"
            )

        # Extract the 'Close' column safely
        close_data = data['Close'].dropna()

        if close_data.empty:
            current_price = 0.0
        else:
            # Get the last row (which may be a Series or scalar DataFrame)
            last_val = close_data.iloc[-1]
            
            # If last_val is still a Series/DataFrame (due to MultiIndex), flatten it down to a scalar
            if hasattr(last_val, 'values'):
                last_val = last_val.values[0]

            current_price = round(float(last_val), 2)

        return {
            "ticker": clean_ticker,
            "current_price": current_price,
            "company_name": clean_ticker,
            "sector": _sector_cache.get(clean_ticker, "Unknown"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch data for {clean_ticker}: {str(e)}"
        )