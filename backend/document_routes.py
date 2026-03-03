import io
import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId

from database import db
from auth import get_current_user
from models import DocumentModel

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
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
async def list_documents(user_id: str = Depends(get_current_user)):
    docs = await db.documents.find(
        {"user_id": user_id}, {"content": 0}
    ).sort("created_at", -1).to_list(200)
    return [
        {
            "id": str(d["_id"]),
            "user_id": d["user_id"],
            "name": d["name"],
            "file_type": d["file_type"],
            "size_chars": d["size_chars"],
            "created_at": d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else d["created_at"],
        }
        for d in docs
    ]


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
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
    doc = DocumentModel(
        user_id=user_id,
        name=fname,
        file_type=ext,
        content=content,
        size_chars=len(content),
    )
    rec = doc.model_dump(exclude={"id"})
    result = await db.documents.insert_one(rec)
    return {
        "id": str(result.inserted_id),
        "name": fname,
        "file_type": ext,
        "size_chars": len(content),
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user_id: str = Depends(get_current_user)):
    result = await db.documents.delete_one({"_id": ObjectId(doc_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}
