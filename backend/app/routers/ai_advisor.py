import os
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app.database import get_db
from app.models.portfolio import Holding, Portfolio
from app.models.user import User
from app.routers.auth import get_current_user
from app.routers.stocks import get_sector

# Note: Prefix is handled in main.py (e.g. app.include_router(ai_advisor.router, prefix="/api/ai"))
router = APIRouter(tags=["AI Portfolio Chatbot"])

# System prompt forcing the AI to strictly act as a Portfolio Analyst
SYSTEM_INSTRUCTION = """
You are Quantfolio Assistant, an intelligent, conversational financial advisor.

Strict Formatting & Tone Rules:
1. **Be Short, Brief, and Concise:** Always keep your answers short and to the point. NEVER provide long reports, full audits, or walls of text UNLESS the user explicitly asks you to elaborate, analyze deeply, or provide a full report.
2. **Natural Conversationalist:** Reply naturally to small talk, greetings, or quick questions without dumping unsolicited portfolio data.
3. **Use Portfolio Context Judiciously:** Reference live portfolio numbers only when relevant to the specific question asked.
4. **Clean Markdown:** Use clean formatting (bold key terms, quick bullets) for maximum scannability.
5. **No Direct Commands:** Provide clear insights and pros/cons without issuing direct financial buy/sell commands.
"""
@router.post("/chat")
def portfolio_chat(
    payload: dict,
    portfolio_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check for API key dynamically so server startup doesn't fail
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in your environment or .env file."
        )

    # 2. Validate incoming user message
    user_message = payload.get("message", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # 3. Verify portfolio ownership
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # 4. Fetch portfolio holdings
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        return {
            "response": "Your portfolio is currently empty! Add some stocks or assets to your portfolio first so I can analyze them for you."
        }

    # 5. Build a structured summary of the portfolio for the AI
    total_invested = sum(h.quantity * h.buy_price for h in holdings)
    
    holdings_lines = []
    for h in holdings:
        value = h.quantity * h.buy_price
        percentage = round((value / total_invested) * 100, 1) if total_invested > 0 else 0
        sector = get_sector(h.ticker) or "General/Unassigned"
        
        company = getattr(h, "company_name", None) or "N/A"
        holdings_lines.append(
            f"- {h.ticker} ({company}): {h.quantity} shares purchased at ₹{h.buy_price:,.2f} | Total Value: ₹{value:,.2f} ({percentage}% of portfolio) | Sector: {sector}"
        )

    portfolio_context = f"""
    === USER PORTFOLIO SUMMARY ===
    Portfolio Name: {portfolio.name}
    Total Capital Invested: ₹{total_invested:,.2f}
    Total Holdings Count: {len(holdings)}

    Individual Positions:
    """ + "\n".join(holdings_lines)

    # 6. Construct full prompt for Gemini
    full_prompt = f"""
    [User Portfolio Data]
    {portfolio_context}

    [User Question]
    {user_message}
    """

    # 7. Generate AI response using Gemini 2.5 Flash
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.6,
            )
        )
        return {"response": response.text}

    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate AI response: {str(e)}"
        )