from pydantic import BaseModel, Field
from typing import Optional, List, Annotated
from datetime import datetime, timezone
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]


class UserModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: str
    password_hash: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_config = {"populate_by_name": True}


class DocumentModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str
    name: str
    file_type: str
    content: str
    size_chars: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_config = {"populate_by_name": True}


class QuestionnaireAnswer(BaseModel):
    question: str
    answer: str
    found: bool
    source_document: Optional[str] = None
    citation: Optional[str] = None


class QuestionnaireModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str
    name: str
    status: str = "pending"
    questions: List[str] = []
    answers: List[QuestionnaireAnswer] = []
    document_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    model_config = {"populate_by_name": True}
