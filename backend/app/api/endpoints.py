from fastapi import APIRouter, HTTPException, Depends
from app.schema.models import *
from app.repository.supabase_repo import repo
from typing import List
import random

router = APIRouter(prefix="/api")

@router.get("/family-members", response_model=List[FamilyMemberResponse])
async def read_members():
    return repo.get_family_members()

@router.get("/family-members/{member_id}", response_model=FamilyMemberResponse)
async def read_member(member_id: int):
    member = repo.get_family_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@router.post("/family-members")
async def create_member(member: FamilyMemberCreate):
    data = member.model_dump()
    if not data.get("invite_code"):
        data["invite_code"] = f"FA-{random.randint(1000, 9999)}"
    
    # Check if exists (mocking server.ts behavior)
    existing = repo.get_family_members() # Should technically search in DB
    for m in existing:
        if m["name"] == data["name"]:
             return {"id": m["id"], "linked": True}
             
    new_member = repo.create_family_member(data)
    return {"id": new_member["id"], "linked": False, "inviteCode": data["invite_code"]}

@router.delete("/family-members/{member_id}")
async def delete_member(member_id: int):
    repo.delete_family_member(member_id)
    return {"success": True}

@router.get("/events", response_model=List[EventResponse])
async def read_events():
    return repo.get_events()

@router.post("/events")
async def create_event(event: EventCreate):
    new_event = repo.create_event(event.model_dump())
    return {"id": new_event["id"]}

@router.get("/messages/{member_id}", response_model=List[MessageResponse])
async def read_messages(member_id: int):
    return repo.get_messages_by_member_id(member_id)

@router.post("/messages")
async def create_message(message: MessageCreate):
    new_msg = repo.create_message(message.model_dump())
    return {"id": new_msg["id"]}
