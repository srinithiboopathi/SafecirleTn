"""
SafeCircle AI - SQLAlchemy Database Models & PostGIS Schemas
Defines schema entities for users, trusted contacts, routes, safety incidents,
safety reports, emergency events, and audit logs.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum as SqlEnum
)
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"

class IncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(32), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SqlEnum(UserRole), default=UserRole.USER, nullable=False)
    emergency_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    contacts = relationship("TrustedContact", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("SafetyReport", back_populates="user")
    saved_routes = relationship("SavedRoute", back_populates="user")
    emergency_events = relationship("EmergencyEvent", back_populates="user")

class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    phone = Column(String(32), nullable=False)
    email = Column(String(255), nullable=True)
    relationship_type = Column(String(64), default="Friend")
    receive_sos = Column(Boolean, default=True, nullable=False)
    receive_journey = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="contacts")

class SafetyIncident(Base):
    __tablename__ = "safety_incidents"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False, index=True)
    severity = Column(SqlEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM, nullable=False)
    lat = Column(Float, nullable=False, index=True)
    lng = Column(Float, nullable=False, index=True)
    description = Column(Text, nullable=False)
    reported_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    source = Column(String(128), nullable=False)
    verification_status = Column(String(32), default="verified", nullable=False)
    confidence_score = Column(Integer, default=85)
    address = Column(String(255), nullable=True)

class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False)
    reporter_name = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False)
    severity = Column(SqlEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(SqlEnum(ReportStatus), default=ReportStatus.UNDER_REVIEW, nullable=False)
    admin_notes = Column(Text, nullable=True)

    user = relationship("User", back_populates="reports")

class SavedRoute(Base):
    __tablename__ = "saved_routes"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    from_name = Column(String(255), nullable=False)
    to_name = Column(String(255), nullable=False)
    from_lat = Column(Float, nullable=False)
    from_lng = Column(Float, nullable=False)
    to_lat = Column(Float, nullable=False)
    to_lng = Column(Float, nullable=False)
    preferred_mode = Column(String(32), default="walking")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="saved_routes")

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False)
    user_name = Column(String(128), nullable=False)
    user_phone = Column(String(32), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(32), default="active", nullable=False)
    cancellation_reason = Column(Text, nullable=True)

    user = relationship("User", back_populates="emergency_events")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    actor_id = Column(String(64), nullable=False)
    actor_name = Column(String(128), nullable=False)
    action = Column(String(64), nullable=False)
    details = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
