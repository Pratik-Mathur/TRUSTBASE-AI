from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from bson import ObjectId

from database import db
from auth import hash_password, verify_password, create_token, get_current_user
from models import UserModel

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserModel(email=body.email, password_hash=hash_password(body.password), name=body.name)
    doc = user.model_dump(exclude={"id"})
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)

    return {"token": create_token(user_id), "user": {"id": user_id, "email": body.email, "name": body.name}}


@router.post("/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    return {"token": create_token(user_id), "user": {"id": user_id, "email": user["email"], "name": user["name"]}}


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": str(user["_id"]), "email": user["email"], "name": user["name"]}
