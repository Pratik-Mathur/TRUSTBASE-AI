from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from auth_routes import router as auth_router
from document_routes import router as doc_router
from questionnaire_routes import router as quest_router
from database import client

app = FastAPI(title="TrustBase AI API")
api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(doc_router, prefix="/documents", tags=["documents"])
api_router.include_router(quest_router, prefix="/questionnaires", tags=["questionnaires"])


@api_router.get("/")
async def root():
    return {"message": "TrustBase AI API v1.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
