from fastapi import APIRouter, HTTPException, Depends, Response
from app.schema.models import *
from app.repository.supabase_repo import repo
from app.service.almanac_service import AlmanacService
from typing import List, Optional
import random
import httpx
import logging

router = APIRouter(prefix="/api")

# Fish Audio Configurations
# df1e48bd79b24888a70081d0543669ca is a common high-quality "Cai Xukun" reference ID on Fish Audio
FISH_API_KEY = "4c7d31cb1b154cbdba9cafcd47752a5c"
DEFAULT_REF_ID = "df1e48bd79b24888a70081d0543669ca"

@router.post("/tts/fish")
async def fish_tts_proxy(payload: dict):
    """
    Fish Audio TTS Proxy - 蔡徐坤语音生成
    """
    text = payload.get("text", "")
    ref_id = payload.get("reference_id", DEFAULT_REF_ID)
    
    if not text:
        raise HTTPException(status_code=400, detail="Missing text for TTS")

    url = "https://api.fish.audio/v1/tts"
    headers = {
        "Authorization": f"Bearer {FISH_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 🚀 v1 API standard payload for cloned models
    api_payload = {
        "text": text,
        "chunk_length": 200,
        "format": "mp3",
        "mp3_bitrate": 128,
        "reference_id": ref_id,
        "normalize": True
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            logging.info(f"Requesting Fish Audio TTS for text: {text[:30]}...")
            resp = await client.post(url, headers=headers, json=api_payload)
            
            if resp.status_code != 200:
                error_detail = resp.text
                logging.error(f"Fish Audio API Error ({resp.status_code}): {error_detail}")
                # Fallback or specific error
                raise HTTPException(status_code=resp.status_code, detail=f"Fish Audio Error: {error_detail}")
            
            logging.info(f"Successfully synthesized audio, size: {len(resp.content)} bytes")
            return Response(content=resp.content, media_type="audio/mpeg")
        except httpx.TimeoutException:
            logging.error("Fish Audio API Timeout")
            raise HTTPException(status_code=504, detail="Fish Audio API Timeout")
        except Exception as e:
            logging.error(f"TTS Proxy Exception: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

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

@router.get("/almanac", response_model=AlmanacResponse)
async def read_almanac(date_str: Optional[str] = None, familyId: Optional[str] = None):
    """
    获取由 lunar-python 驱动的真实黄历数据
    """
    if not date_str:
        from datetime import datetime
        date_str = datetime.now().strftime("%Y-%m-%d")
        
    return await AlmanacService.get_almanac(date_str, familyId)
