import io
import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from auth import get_current_user
from orm_models import Document

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_CONTENT_CHARS = 50_000


def extract_text_from_pdf(file_bytes: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += (page.extract_text() or "") + "\n"
    return text.strip()


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore").strip()


@router.get("")
async def list_documents(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "user_id": d.user_id,
            "name": d.name,
            "file_type": d.file_type,
            "size_chars": d.size_chars,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    fname = file.filename or "document"
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""

    if ext == "pdf":
        try:
            content = extract_text_from_pdf(file_bytes)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract PDF text: {e}")
    elif ext in ("txt", "text", "md"):
        content = extract_text_from_txt(file_bytes)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")

    if not content:
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    content = content[:MAX_CONTENT_CHARS]
    doc = Document(
        user_id=user_id,
        name=fname,
        file_type=ext,
        content=content,
        size_chars=len(content),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "name": doc.name,
        "file_type": doc.file_type,
        "size_chars": doc.size_chars,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"success": True}
