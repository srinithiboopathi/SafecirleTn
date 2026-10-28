"""
SafeCircle AI - Pydantic Request & Response Validation Schemas
"""

from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str
    emergency_notes: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    emergency_notes: Optional[str] = None
    password: Optional[str] = None

class TrustedContactCreate(BaseModel):
    name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=7)
    email: Optional[EmailStr] = None
    relationship_type: Optional[str] = "Friend"
    receive_sos: bool = True
    receive_journey: bool = True

class SafetyReportCreate(BaseModel):
    category: str
    severity: str = "medium"
    lat: float
    lng: float
    location_name: str
    description: str = Field(..., min_length=10)

class EmergencyTrigger(BaseModel):
    lat: float
    lng: float

class EmergencyCancel(BaseModel):
    reason: Optional[str] = "False alarm or user safely reached destination"

class AssistantQuery(BaseModel):
    query: str
    context: Optional[dict] = None
