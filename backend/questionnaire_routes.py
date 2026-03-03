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
MAX_FILE_SIZE = 5 * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
    t = text.strip()
    if not t.endswith("?") and (t.isupper() or (len(t.split()) <= 6 and t.istitle())):
        return True
    heading_words = {"questionnaire", "form", "assessment", "survey", "checklist", "template", "document", "policy"}
    lower_words = set(t.lower().split())
    if not t.endswith("?") and len(t.split()) <= 8 and heading_words & lower_words:
        return True
    return False


def parse_questions(text: str) -> List[str]:
    lines = text.split("\n")

    # Pass 1: Q1/Q2/Q3 style
    q_num_pattern = re.compile(r"^\s*Q(\d+)[\.\):\s]\s*(.+)", re.IGNORECASE)
    q_style, current = [], ""
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

    # Pass 2: numbered items ending with "?"
    num_pattern = re.compile(r"^\s*\d+[\.\):\s]\s*(.+)", re.IGNORECASE)
    num_style, current = [], ""
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

    # Pass 3: any line ending with "?"
    return [l.strip() for l in lines if l.strip().endswith("?") and len(l.strip()) > 10 and not _is_title_or_heading(l.strip())][:MAX_QUESTIONS]


def _version_summary(v: dict) -> dict:
    ca = v.get("created_at")
    return {
        "version_number": v.get("version_number"),
        "created_at": ca.isoformat() if hasattr(ca, "isoformat") else ca,
        "answers_found_count": v.get("answers_found_count", 0),
        "confidence_counts": v.get("confidence_counts", {}),
        "answers": v.get("answers", []),
    }


def _conf_counts(answers: list) -> dict:
    cc = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for a in answers:
        c = (a.get("confidence") or "LOW").upper()
        if c in cc:
            cc[c] += 1
    return cc


def build_docx(q: dict) -> bytes:
    from docx import Document
    from docx.shared import Pt, RGBColor

    doc = Document()
    answers = q.get("answers", [])
    found_count = sum(1 for a in answers if a.get("found"))

    # Cover
    doc.add_heading(q.get("name", "Questionnaire Report"), 0)
    ca = q.get("completed_at")
    if ca:
        try:
            date_str = datetime.fromisoformat(str(ca)).strftime("%B %d, %Y")
        except Exception:
            date_str = str(ca)[:10]
    else:
        date_str = datetime.now().strftime("%B %d, %Y")

    doc.add_paragraph(f"Date Generated: {date_str}")
    doc.add_paragraph(f"Total Questions: {len(answers)}")
    doc.add_paragraph(f"Answered with Citations: {found_count}")
    doc.add_paragraph(f"Not Found in References: {len(answers) - found_count}")
    cc = _conf_counts(answers)
    doc.add_paragraph(f"Confidence — High: {cc['HIGH']}  Medium: {cc['MEDIUM']}  Low: {cc['LOW']}")
    doc.add_paragraph("")

    CONF_COLORS = {
        "HIGH": RGBColor(0x16, 0xA3, 0x4A),
        "MEDIUM": RGBColor(0xD9, 0x77, 0x06),
        "LOW": RGBColor(0xDC, 0x26, 0x26),
    }

    for i, ans in enumerate(answers, 1):
        doc.add_heading(f"Q{i}. {ans.get('question', '')}", level=2)

        if ans.get("found"):
            doc.add_paragraph(ans.get("answer", ""))

            conf = (ans.get("confidence") or "LOW").upper()
            cp = doc.add_paragraph()
            run = cp.add_run(f"Confidence: {conf}")
            run.bold = True
            run.font.size = Pt(10)
            run.font.color.rgb = CONF_COLORS.get(conf, CONF_COLORS["LOW"])

            src = ans.get("source_document", "")
            cit = ans.get("citation", "")
            ev = ans.get("evidence_text", "")
            if src:
                sp = doc.add_paragraph()
                sp.add_run(f"Source: {src}").italic = True
                if cit:
                    sp.add_run(f' — "{cit}"').italic = True
            if ev and ev != cit:
                ep = doc.add_paragraph(f'Evidence: "{ev}"')
                ep.runs[0].font.size = Pt(10)
                ep.runs[0].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        else:
            p = doc.add_paragraph("Not found in references.")
            p.runs[0].italic = True
            p.runs[0].font.color.rgb = RGBColor(0xD9, 0x77, 0x06)

        if ans.get("is_edited"):
            ep = doc.add_paragraph("[Manually edited]")
            ep.runs[0].font.size = Pt(9)
            ep.runs[0].font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

        doc.add_paragraph("")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class ProcessRequest(BaseModel):
    document_ids: Optional[List[str]] = None


class EditAnswerRequest(BaseModel):
    answer: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
async def list_questionnaires(user_id: str = Depends(get_current_user)):
    qs = await db.questionnaires.find(
        {"user_id": user_id}, {"answers": 0, "questions": 0, "versions": 0}
    ).sort("created_at", -1).to_list(200)
    return [
        {
            "id": str(q["_id"]),
            "name": q["name"],
            "status": q["status"],
            "question_count": q.get("question_count", 0),
            "created_at": q["created_at"].isoformat() if hasattr(q["created_at"], "isoformat") else q["created_at"],
            "completed_at": (q["completed_at"].isoformat() if q.get("completed_at") and hasattr(q["completed_at"], "isoformat") else q.get("completed_at")),
            "error_message": q.get("error_message"),
        }
        for q in qs
    ]


@router.post("")
async def upload_questionnaire(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
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
        "user_id": user_id, "name": q_name, "status": "pending",
        "questions": questions, "question_count": len(questions),
        "answers": [], "versions": [], "document_ids": [],
        "created_at": datetime.now(timezone.utc),
        "completed_at": None, "error_message": None,
    }
    result = await db.questionnaires.insert_one(doc)
    return {"id": str(result.inserted_id), "name": q_name, "status": "pending",
            "questions": questions, "question_count": len(questions)}


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
        "versions": [_version_summary(v) for v in q.get("versions", [])],
        "document_ids": q.get("document_ids", []),
        "question_count": q.get("question_count", len(q.get("questions", []))),
        "created_at": q["created_at"].isoformat() if hasattr(q["created_at"], "isoformat") else q["created_at"],
        "completed_at": (q["completed_at"].isoformat() if q.get("completed_at") and hasattr(q["completed_at"], "isoformat") else q.get("completed_at")),
        "error_message": q.get("error_message"),
    }


@router.delete("/{q_id}")
async def delete_questionnaire(q_id: str, user_id: str = Depends(get_current_user)):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.questionnaires.delete_one({"_id": obj_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True}


@router.post("/{q_id}/process")
async def process_questionnaire(
    q_id: str, body: ProcessRequest, background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q["status"] == "processing":
        raise HTTPException(status_code=400, detail="Already processing")

    doc_ids = body.document_ids or []
    if not doc_ids:
        all_docs = await db.documents.find({"user_id": user_id}, {"_id": 1}).to_list(200)
        doc_ids = [str(d["_id"]) for d in all_docs]
    if not doc_ids:
        raise HTTPException(status_code=400, detail="No reference documents available. Please upload documents first.")

    await db.questionnaires.update_one({"_id": obj_id}, {"$set": {"status": "processing", "document_ids": doc_ids}})
    background_tasks.add_task(_bg_process, q_id, doc_ids)
    return {"status": "processing"}


@router.post("/{q_id}/regenerate")
async def regenerate_questionnaire(
    q_id: str, background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q["status"] == "processing":
        raise HTTPException(status_code=400, detail="Already processing")

    all_docs = await db.documents.find({"user_id": user_id}, {"_id": 1}).to_list(200)
    doc_ids = [str(d["_id"]) for d in all_docs]
    if not doc_ids:
        raise HTTPException(status_code=400, detail="No reference documents available. Please upload documents first.")

    # Save current answers as a version before clearing
    current_answers = q.get("answers", [])
    if current_answers:
        versions = q.get("versions", [])
        version_num = len(versions) + 1
        found_ct = sum(1 for a in current_answers if a.get("found"))
        await db.questionnaires.update_one(
            {"_id": obj_id},
            {"$push": {"versions": {
                "version_number": version_num,
                "created_at": datetime.now(timezone.utc),
                "answers": current_answers,
                "answers_found_count": found_ct,
                "confidence_counts": _conf_counts(current_answers),
            }}},
        )

    await db.questionnaires.update_one(
        {"_id": obj_id},
        {"$set": {"status": "processing", "document_ids": doc_ids, "answers": [], "error_message": None}},
    )
    background_tasks.add_task(_bg_process, q_id, doc_ids)
    return {"status": "processing", "message": "Regeneration started"}


@router.patch("/{q_id}/answers/{idx}")
async def edit_answer(
    q_id: str, idx: int, body: EditAnswerRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    answers = q.get("answers", [])
    if idx < 0 or idx >= len(answers):
        raise HTTPException(status_code=400, detail="Invalid answer index")

    await db.questionnaires.update_one(
        {"_id": obj_id},
        {"$set": {f"answers.{idx}.answer": body.answer, f"answers.{idx}.is_edited": True}},
    )
    updated = dict(answers[idx])
    updated["answer"] = body.answer
    updated["is_edited"] = True
    return updated


@router.post("/{q_id}/answers/{idx}/regenerate")
async def regenerate_single_answer(
    q_id: str, idx: int,
    user_id: str = Depends(get_current_user),
):
    """Re-run AI for a single question only (synchronous)."""
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    questions = q.get("questions", [])
    if idx < 0 or idx >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    all_docs = await db.documents.find({"user_id": user_id}).to_list(200)
    if not all_docs:
        raise HTTPException(status_code=400, detail="No reference documents available")

    docs = [{"name": d["name"], "content": d["content"]} for d in all_docs]
    answers = await answer_questions_with_docs([questions[idx]], docs)
    new_answer = answers[0] if answers else {
        "question": questions[idx], "answer": "Processing error", "found": False,
        "source_document": None, "citation": None, "confidence": "LOW",
        "evidence_text": None, "is_edited": False,
    }

    await db.questionnaires.update_one(
        {"_id": obj_id}, {"$set": {f"answers.{idx}": new_answer}}
    )
    return new_answer


@router.get("/{q_id}/download-docx")
async def download_docx(q_id: str, user_id: str = Depends(get_current_user)):
    try:
        obj_id = ObjectId(q_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    q = await db.questionnaires.find_one({"_id": obj_id, "user_id": user_id})
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q["status"] != "completed":
        raise HTTPException(status_code=400, detail="Questionnaire not yet completed")

    docx_bytes = build_docx(q)
    safe_name = re.sub(r"[^\w\-]", "_", q["name"])
    return StreamingResponse(
        iter([docx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_report.docx"'},
    )


@router.get("/{q_id}/download")
async def download_csv(q_id: str, user_id: str = Depends(get_current_user)):
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
    writer.writerow(["#", "Question", "Answer", "Found", "Confidence", "Source Document", "Citation"])
    for i, ans in enumerate(q.get("answers", []), 1):
        writer.writerow([
            i, ans.get("question", ""), ans.get("answer", ""),
            "Yes" if ans.get("found") else "No",
            ans.get("confidence", ""),
            ans.get("source_document") or "",
            ans.get("citation") or "",
        ])
    safe_name = re.sub(r"[^\w\-]", "_", q["name"])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_answers.csv"'},
    )


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

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
            {"$set": {
                "status": "completed", "answers": answers,
                "completed_at": datetime.now(timezone.utc), "error_message": None,
            }},
        )
    except Exception as e:
        logger.error(f"Background processing error for {q_id}: {e}")
        await db.questionnaires.update_one(
            {"_id": ObjectId(q_id)},
            {"$set": {"status": "failed", "error_message": str(e)}},
        )
