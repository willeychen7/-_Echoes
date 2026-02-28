from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import date, datetime

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"

class UserBase(BaseModel):
    phone_or_email: str
    name: str
    relationship: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

class FamilyMemberBase(BaseModel):
    name: str
    relationship: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    birth_date: Optional[date] = None
    is_registered: bool = False
    familyId: Optional[int] = None
    createdByMemberId: Optional[int] = None

class FamilyMemberCreate(FamilyMemberBase):
    invite_code: Optional[str] = None

class FamilyMemberResponse(FamilyMemberBase):
    id: int
    invite_code: str
    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    date: date
    type: str
    description: Optional[str] = None
    is_recurring: bool = True
    member_id: Optional[int] = None
    custom_member_name: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    family_member_id: int
    author_name: str
    author_role: str
    author_avatar: Optional[str] = None
    content: str
    type: MessageType
    media_url: Optional[str] = None
    duration: Optional[int] = None

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
