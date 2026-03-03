import io
import re
import csv
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from bson import ObjectId
from pydantic import BaseModel

from database import db
from auth import get_current_user
from models import QuestionnaireModel
from ai_service import answer_questions_with_docs

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_QUESTIONS = 100
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def extract_text(file_bytes: bytes, ext: str) -> str:
    if ext == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += (page.extract_text() or "") + "\n"
        return text.strip()
    return file_bytes.decode("utf-8", errors="ignore").strip()


def _is_title_or_heading(text: str) -> bool:
    """Return True for lines that look like titles/headings, not questions."""
    t = text.strip()
    # All-caps or title-case short lines with no "?"
    if not t.endswith("?") and (t.isupper() or (len(t.split()) <= 6 and t.istitle())):
        return True
    # Lines that are clearly document titles (contain "Questionnaire", "Form", "Policy", etc. as standalone labels)
    heading_words = {"questionnaire", "form", "assessment", "survey", "checklist", "template", "document", "policy"}
    lower_words = set(t.lower().split())
    if not t.endswith("?") and len(t.split()) <= 8 and heading_words & lower_words:
        return True
    return False


def parse_questions(text: str) -> List[str]:
    """
    Extract questions with strict filtering:
    Pass 1 — Q1/Q2/Q3 style (e.g. "Q1. Does your company...?")
    Pass 2 — Numbered items (1. 2.) that end with "?"
    Pass 3 — Any standalone line ending with "?"
    Titles, headings, and plain sentences are always skipped.
    """
    lines = text.split("\n")

    # Pass 1: Q-numbered style — Q1, Q2, Q3...
    q_num_pattern = re.compile(r"^\s*Q(\d+)[\.\):\s]\s*(.+)", re.IGNORECASE)
    q_style = []
    current = ""
    current_idx = -1
    for line in lines:
        stripped = line.strip()
        m = q_num_pattern.match(stripped)
        if m:
            if current:
                q_style.append(current.strip())
            current = m.group(2).strip()
        elif current and stripped:
            current += " " + stripped
        elif not stripped and current:
            q_style.append(current.strip())
            current = ""
    if current:
        q_style.append(current.strip())

    if q_style:
        return [q for q in q_style if len(q) > 5][:MAX_QUESTIONS]

    # Pass 2: Numbered items (1. 2.) that end with "?"
    num_pattern = re.compile(r"^\s*\d+[\.\):\s]\s*(.+)", re.IGNORECASE)
    num_style = []
    current = ""
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                full = current.strip()
                if full.endswith("?") and not _is_title_or_heading(full):
                    num_style.append(full)
                current = ""
            continue
        m = num_pattern.match(stripped)
        if m:
            if current:
                full = current.strip()
                if full.endswith("?") and not _is_title_or_heading(full):
                    num_style.append(full)
            current = m.group(1).strip()
        elif current:
            current += " " + stripped
    if current:
        full = current.strip()
        if full.endswith("?") and not _is_title_or_heading(full):
            num_style.append(full)

    if num_style:
        return num_style[:MAX_QUESTIONS]

    # Pass 3: Any line ending with "?" (skip titles/headings)
    fallback = []
    for line in lines:
        stripped = line.strip()
        if stripped.endswith("?") and len(stripped) > 10 and not _is_title_or_heading(stripped):
            fallback.append(stripped)

    return fallback[:MAX_QUESTIONS]


class ProcessRequest(BaseModel):
    document_ids: Optional[List[str]] = None


@router.get("")
async def list_questionnaires(user_id: str = Depends(get_current_user)):
    qs = await db.questionnaires.find(
        {"user_id": user_id}, {"answers": 0, "questions": 0, "content": 0}
    ).sort("created_at", -1).to_list(200)
    return [
        {
            "id": str(q["_id"]),
            "name": q["name"],
            "status": q["status"],
            "question_count": q.get("question_count", 0),
            "created_at": q["created_at"].isoformat() if hasattr(q["created_at"], "isoformat") else q["created_at"],
            "completed_at": (
                q["completed_at"].isoformat()
                if q.get("completed_at") and hasattr(q["completed_at"], "isoformat")
                else q.get("completed_at")
            ),
            "error_message": q.get("error_message"),
        }
        for q in qs
    ]


@router.post("")
async def upload_questionnaire(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    fname = file.filename or "questionnaire"
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "txt"

    if ext not in ("pdf", "txt", "text", "md"):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")

    try:
        text = extract_text(file_bytes, ext)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {e}")

    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    questions = parse_questions(text)
    if not questions:
        raise HTTPException(status_code=400, detail="No questions found in file")

    q_name = fname.rsplit(".", 1)[0] if "." in fname else fname
    doc = {
        "user_id": user_id,
        "name": q_name,
        "status": "pending",
        "questions": questions,
        "question_count": len(questions),
        "answers": [],
        "document_ids": [],
        "created_at": datetime.now(timezone.utc),
        "completed_at": None,
        "error_message": None,
    }
    result = await db.questionnaires.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "name": q_name,
        "status": "pending",
        "questions": questions,
        "question_count": len(questions),
    }


@router.get("/{q_id}")
async def get_questionnaire(q_id: str, user_id: str = Depends(get_current_user)):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": str(q["_id"]),
        "name": q["name"],
        "status": q["status"],
        "questions": q.get("questions", []),
        "answers": q.get("answers", []),
        "document_ids": q.get("document_ids", []),
        "question_count": q.get("question_count", len(q.get("questions", []))),
        "created_at": q["created_at"].isoformat() if hasattr(q["created_at"], "isoformat") else q["created_at"],
        "completed_at": (
            q["completed_at"].isoformat()
            if q.get("completed_at") and hasattr(q["completed_at"], "isoformat")
            else q.get("completed_at")
        ),
        "error_message": q.get("error_message"),
    }


@router.post("/{q_id}/process")
async def process_questionnaire(
    q_id: str,
    body: ProcessRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q["status"] in ("processing",):
        raise HTTPException(status_code=400, detail="Already processing")

    # Resolve document IDs
    doc_ids = body.document_ids or []
    if not doc_ids:
        all_docs = await db.documents.find({"user_id": user_id}, {"_id": 1}).to_list(200)
        doc_ids = [str(d["_id"]) for d in all_docs]

    if not doc_ids:
        raise HTTPException(status_code=400, detail="No reference documents available. Please upload documents first.")

    await db.questionnaires.update_one(
        {"_id": obj_id}, {"$set": {"status": "processing", "document_ids": doc_ids}}
    )

    background_tasks.add_task(_bg_process, q_id, doc_ids)
    return {"status": "processing", "message": "Processing started"}


async def _bg_process(q_id: str, doc_ids: List[str]):
    try:
        q = await db.questionnaires.find_one({"_id": ObjectId(q_id)})
        questions = q.get("questions", [])

        docs = []
        for did in doc_ids:
            try:
                d = await db.documents.find_one({"_id": ObjectId(did)})
                if d:
                    docs.append({"name": d["name"], "content": d["content"]})
            except Exception:
                pass

        if not docs:
            await db.questionnaires.update_one(
                {"_id": ObjectId(q_id)},
                {"$set": {"status": "failed", "error_message": "Reference documents not found"}},
            )
            return

        answers = await answer_questions_with_docs(questions, docs)
        await db.questionnaires.update_one(
            {"_id": ObjectId(q_id)},
            {
                "$set": {
                    "status": "completed",
                    "answers": answers,
                    "completed_at": datetime.now(timezone.utc),
                    "error_message": None,
                }
            },
        )
    except Exception as e:
        logger.error(f"Background processing error for {q_id}: {e}")
        await db.questionnaires.update_one(
            {"_id": ObjectId(q_id)},
            {"$set": {"status": "failed", "error_message": str(e)}},
        )


@router.get("/{q_id}/download")
async def download_answers(q_id: str, user_id: str = Depends(get_current_user)):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q["status"] != "completed":
        raise HTTPException(status_code=400, detail="Questionnaire not yet completed")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["#", "Question", "Answer", "Found", "Source Document", "Citation"])
    for i, ans in enumerate(q.get("answers", []), 1):
        writer.writerow([
            i,
            ans.get("question", ""),
            ans.get("answer", ""),
            "Yes" if ans.get("found") else "No",
            ans.get("source_document") or "",
            ans.get("citation") or "",
        ])

    csv_content = output.getvalue()
    safe_name = re.sub(r"[^\w\-]", "_", q["name"])
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_answers.csv"'},
    )
