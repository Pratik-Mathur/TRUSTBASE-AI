import os
import json
import re
import uuid
import logging
from typing import List

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

# GPT-4o has 128k token context (~500k chars).
# Pass up to 45k chars per doc so full content is available.
MAX_CHARS_PER_DOC = 45_000
# Smaller batch keeps the per-request payload manageable
BATCH_SIZE = 10


async def answer_questions_with_docs(questions: List[str], documents: List[dict]) -> List[dict]:
    """Answer questions using the full content of all reference documents."""
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

    # Pass the FULL content of every document (capped at MAX_CHARS_PER_DOC each).
    # GPT-4o's 128k context handles this comfortably.
    doc_context = ""
    for doc in documents:
        content = doc["content"][:MAX_CHARS_PER_DOC]
        doc_context += f"\n\n=== DOCUMENT: {doc['name']} ===\n{content}\n=== END OF {doc['name']} ==="

    numbered_qs = "\n".join([f"{i + 1}. {q}" for i, q in enumerate(questions)])

    prompt = f"""You are a compliance expert answering a vendor security questionnaire.
The reference documents below contain all the policies, procedures, and technical details needed to answer the questions.

IMPORTANT INSTRUCTIONS:
- Read ALL provided documents THOROUGHLY before answering each question.
- Search for related terms, synonyms, and implied information — not just exact keyword matches.
  Example: "Do you encrypt stored data?" can be answered by text saying "All data at rest is protected with AES-256".
- If a document addresses the topic indirectly or partially, use that to form an answer.
- Only set "found": false if NO relevant information exists across ALL documents after careful searching.
- Cite the exact document name and a brief supporting quote for every found answer.

REFERENCE DOCUMENTS:
{doc_context}

QUESTIONS TO ANSWER:
{numbered_qs}

Respond with ONLY a valid JSON array (no markdown, no explanation):
[
  {{
    "question_index": 1,
    "answer": "Detailed, specific answer drawn from the documents",
    "found": true,
    "source_document": "exact document filename",
    "citation": "brief supporting quote or section reference (max 200 chars)"
  }}
]

Set "found": false and "answer": "Not found in references" ONLY when the topic is truly absent from every document."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=(
                "You are a compliance expert answering vendor questionnaire questions. "
                "Search the provided documents broadly and thoroughly — look for related terms and implied answers. "
                "Be liberal in finding relevant content; only return 'Not found' when truly nothing relevant exists. "
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
