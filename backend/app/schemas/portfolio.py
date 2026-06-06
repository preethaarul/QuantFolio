from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class HoldingCreate(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    quantity: float
    buy_price: float

class HoldingResponse(BaseModel):
    id: int
    ticker: str
    company_name: Optional[str]
    quantity: float
    buy_price: float
    added_at: datetime

    class Config:
        from_attributes = True

class PortfolioCreate(BaseModel):
    name: str

class PortfolioResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    holdings: List[HoldingResponse] = []

    class Config:
        from_attributes = True