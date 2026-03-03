import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    name = Column(String(255), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False, default="")
    content = Column(Text, nullable=False)
    size_chars = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    questions = Column(JSONB, nullable=False, default=list)
    question_count = Column(Integer, nullable=False, default=0)
    answers = Column(JSONB, nullable=False, default=list)
    versions = Column(JSONB, nullable=False, default=list)
    document_ids = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
