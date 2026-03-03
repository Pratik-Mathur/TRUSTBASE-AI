import os
import json
import re
import uuid
import logging
from typing import List

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)
BATCH_SIZE = 20


async def answer_questions_with_docs(questions: List[str], documents: List[dict]) -> List[dict]:
    """Answer a list of questions using reference documents."""
    if not documents:
        return [
            {"question": q, "answer": "No reference documents provided.", "found": False,
             "source_document": None, "citation": None}
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

    # Build document context, cap per-doc to fit context window
    max_chars_per_doc = max(3000, 15000 // max(len(documents), 1))
    doc_context = ""
    for doc in documents:
        content = doc["content"][:max_chars_per_doc]
        doc_context += f"\n\n=== DOCUMENT: {doc['name']} ===\n{content}"

    numbered_qs = "\n".join([f"{i + 1}. {q}" for i, q in enumerate(questions)])

    prompt = f"""You are answering vendor compliance questionnaire questions from reference documents.

REFERENCE DOCUMENTS:
{doc_context}

QUESTIONS:
{numbered_qs}

Respond with ONLY a valid JSON array (no markdown, no explanation):
[
  {{
    "question_index": 1,
    "answer": "Detailed answer here",
    "found": true,
    "source_document": "Document Name.pdf",
    "citation": "Supporting quote max 150 chars"
  }}
]
If information is not found, set "found": false, "answer": "Not found in references", "source_document": null, "citation": null."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=(
                "You are a compliance expert answering vendor questionnaire questions. "
                "Use only the provided reference documents. "
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
            results.append({
                "question": q,
                "answer": qa.get("answer", "Not found in references"),
                "found": bool(qa.get("found", False)),
                "source_document": qa.get("source_document"),
                "citation": qa.get("citation"),
            })
        return results

    except Exception as e:
        logger.error(f"AI processing error: {e}")
        return [
            {"question": q, "answer": "Processing error — please try again.", "found": False,
             "source_document": None, "citation": None}
            for q in questions
        ]
