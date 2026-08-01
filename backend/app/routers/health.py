from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.portfolio import Portfolio, Holding
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.health import PortfolioHealthResponse
from app.services.health_engine import HealthEngineService

router = APIRouter()

@router.get("/portfolio/{portfolio_id}/health", response_model=PortfolioHealthResponse)
def get_portfolio_health(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates and retrieves the health analytics report for a specific portfolio.

    This endpoint performs ownership verification, queries the current asset holdings
    for the given portfolio ID, instantiates the HealthEngineService, and executes
    the evaluation workflow.

    Args:
        portfolio_id (int): The ID of the portfolio to analyze.
        db (Session): The SQLAlchemy database session.
        current_user (User): The authenticated user querying the health report.

    Raises:
        HTTPException (404): If the portfolio does not exist or does not belong to the user.
        HTTPException (400): If the portfolio has no holdings to evaluate.

    Returns:
        PortfolioHealthResponse: The detailed portfolio health report.
    """
    # Query portfolio and verify ownership
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Query all holdings belonging to the portfolio
    holdings = db.query(Holding).filter(
        Holding.portfolio_id == portfolio_id
    ).all()

    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings in portfolio")

    # Instantiate HealthEngineService and perform evaluation
    service = HealthEngineService(holdings=holdings, db=db)
    return service.evaluate()
