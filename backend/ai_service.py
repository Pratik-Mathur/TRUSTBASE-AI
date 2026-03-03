import os
import json
import re
import uuid
import logging
from typing import List

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

MAX_CHARS_PER_DOC = 45_000
BATCH_SIZE = 10


async def answer_questions_with_docs(questions: List[str], documents: List[dict]) -> List[dict]:
    """Answer questions using the full content of all reference documents."""
    if not documents:
        return [
            {"question": q, "answer": "No reference documents provided.", "found": False,
             "source_document": None, "citation": None, "confidence": "LOW", "evidence_text": None}
            for q in questions
        ]

    results = []
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i: i + BATCH_SIZE]
        batch_results = await _process_batch(batch, documents)
        results.extend(batch_results)
    return results


async def _process_batch(questions: List[str], documents: List[dict]) -> List[dict]:
    api_key = os.environ.get("EMERGENT_LLM_KEY")

    doc_context = ""
    for doc in documents:
        content = doc["content"][:MAX_CHARS_PER_DOC]
        doc_context += f"\n\n=== DOCUMENT: {doc['name']} ===\n{content}\n=== END OF {doc['name']} ==="

    numbered_qs = "\n".join([f"{i + 1}. {q}" for i, q in enumerate(questions)])

    prompt = f"""You are a compliance expert answering a vendor security questionnaire.
Search ALL provided documents thoroughly for each question.

IMPORTANT INSTRUCTIONS:
- Search for related terms, synonyms, and implied information — not just exact keyword matches.
- Only set "found": false if NO relevant information exists in ANY document after careful searching.
- For confidence: HIGH = direct explicit statement found; MEDIUM = related info requiring inference; LOW = only tangential reference found.
- evidence_text: copy the EXACT relevant passage from the document (up to 400 chars) that supports your answer.

REFERENCE DOCUMENTS:
{doc_context}

QUESTIONS:
{numbered_qs}

Respond with ONLY a valid JSON array (no markdown):
[
  {{
    "question_index": 1,
    "answer": "Detailed answer drawn from documents",
    "found": true,
    "source_document": "exact filename",
    "citation": "brief supporting quote (max 200 chars)",
    "confidence": "HIGH",
    "evidence_text": "exact passage from document that was used (max 400 chars)"
  }}
]
For not-found: "found": false, "answer": "Not found in references", "source_document": null, "citation": null, "confidence": "LOW", "evidence_text": null"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=(
                "You are a compliance expert answering vendor questionnaire questions. "
                "Search documents broadly using synonyms and related terms. "
                "Only return 'Not found' when truly nothing relevant exists. "
                "Always respond with a valid JSON array only — no markdown, no extra text."
            ),
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=prompt))

        json_match = re.search(r"\[[\s\S]*\]", response)
        raw_answers = json.loads(json_match.group() if json_match else response.strip())

        answer_map = {int(qa.get("question_index", i + 1)) - 1: qa for i, qa in enumerate(raw_answers)}

        results = []
        for idx, q in enumerate(questions):
            qa = answer_map.get(idx, {})
            conf = (qa.get("confidence") or "LOW").upper()
            if conf not in ("HIGH", "MEDIUM", "LOW"):
                conf = "LOW"
            results.append({
                "question": q,
                "answer": qa.get("answer", "Not found in references"),
                "found": bool(qa.get("found", False)),
                "source_document": qa.get("source_document"),
                "citation": qa.get("citation"),
                "confidence": conf,
                "evidence_text": qa.get("evidence_text"),
                "is_edited": False,
            })
        return results

    except Exception as e:
        logger.error(f"AI processing error: {e}")
        return [
            {"question": q, "answer": "Processing error — please try again.", "found": False,
             "source_document": None, "citation": None, "confidence": "LOW",
             "evidence_text": None, "is_edited": False}
            for q in questions
        ]
