import logging
logging.basicConfig(level=logging.DEBUG)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, portfolio, stocks, ai_advisor
from app.database import Base, engine
from app.models import user, portfolio as portfolio_model

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Quantfolio API",
    description="AI-powered portfolio intelligence platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://quantfolio-qf.vercel.app",
        "https://quantfolio-qf-git-main-preethaarul.vercel.app",
        "https://quantfolio-qf-preethaarul.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stocks"])
app.include_router(ai_advisor.router, prefix="/api/ai", tags=["AI Advisor"])

@app.get("/")
def root():
    return {"app": "Quantfolio", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}