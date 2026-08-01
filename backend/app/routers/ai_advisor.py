from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.portfolio import Holding, Portfolio
from app.models.user import User
from app.routers.auth import get_current_user
from app.routers.stocks import get_sector

router = APIRouter()

@router.get("/advice/{portfolio_id}")
def get_ai_advice(
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

    holdings = db.query(Holding).filter(
        Holding.portfolio_id == portfolio_id
    ).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings found")

    total = sum(h.quantity * h.buy_price for h in holdings)

    # Build real analysis from actual portfolio data
    largest = max(holdings, key=lambda h: h.quantity * h.buy_price)
    largest_pct = round(largest.quantity * largest.buy_price / total * 100, 1)
    tickers = [h.ticker for h in holdings]

    recommendations = []

    # Concentration risk
    if largest_pct > 40:
        recommendations.append({
            "title": f"Reduce {largest.ticker} concentration",
            "detail": f"{largest.ticker} makes up {largest_pct}% of your portfolio. Financial advisors recommend no single stock exceed 20-25%. Consider trimming and redistributing to other sectors.",
            "type": "warning"
        })
    else:
        recommendations.append({
            "title": "Healthy position sizing",
            "detail": f"Your largest holding {largest.ticker} is {largest_pct}% of the portfolio — within the recommended range. Maintain this discipline as you add more holdings.",
            "type": "success"
        })

    # Diversification
    if len(holdings) < 5:
        recommendations.append({
            "title": "Increase diversification",
            "detail": f"You currently have {len(holdings)} holdings. A well-diversified portfolio typically has 10-15 stocks across different sectors. Consider adding exposure to FMCG, pharma, or infrastructure sectors.",
            "type": "info"
        })
    else:
        recommendations.append({
            "title": "Good diversification",
            "detail": f"With {len(holdings)} holdings your portfolio is reasonably diversified. Focus on sector balance — ensure no single sector exceeds 30% of the portfolio.",
            "type": "success"
        })

    # IT sector check
    it_stocks = [h for h in holdings if get_sector(h.ticker) == "Information Technology"]
    it_value = sum(h.quantity * h.buy_price for h in it_stocks)
    it_pct = round(it_value / total * 100, 1) if it_stocks else 0

    if it_pct > 35:
        recommendations.append({
            "title": "High IT sector exposure",
            "detail": f"IT stocks make up {it_pct}% of your portfolio. IT sector is sensitive to global macroeconomic conditions and USD/INR movements. Consider balancing with defensive sectors like FMCG or utilities.",
            "type": "warning"
        })
    else:
        recommendations.append({
            "title": "Consider adding defensive stocks",
            "detail": "Your current holdings are growth-oriented. Adding defensive stocks like HUL, Nestle, or ITC can reduce portfolio volatility during market downturns and provide stability.",
            "type": "info"
        })

    return {
        "recommendations": recommendations[:3],
        "summary": f"Portfolio of ₹{round(total):,} across {len(holdings)} holdings. {'Concentration risk detected — rebalancing recommended.' if largest_pct > 40 else 'Portfolio structure is reasonable — focus on gradual diversification.'}"
    }