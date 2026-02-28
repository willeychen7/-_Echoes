from supabase import create_client, Client
from app.core.config import settings
from app.schema.models import *
from typing import List

class SupabaseRepository:
    def __init__(self):
        self.supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    # Family Members
    def get_family_members(self) -> List[dict]:
        response = self.supabase.table("family_members").select("*").execute()
        return response.data

    def get_family_member_by_id(self, member_id: int) -> dict:
        response = self.supabase.table("family_members").select("*").eq("id", member_id).execute()
        return response.data[0] if response.data else None

    def create_family_member(self, member: dict) -> dict:
        response = self.supabase.table("family_members").insert(member).execute()
        return response.data[0] if response.data else None

    def delete_family_member(self, member_id: int):
        # messages will be deleted via ON DELETE CASCADE in DB
        self.supabase.table("family_members").delete().eq("id", member_id).execute()

    # Events
    def get_events(self) -> List[dict]:
        response = self.supabase.table("events").select("*").execute()
        return response.data

    def create_event(self, event: dict) -> dict:
        response = self.supabase.table("events").insert(event).execute()
        return response.data[0] if response.data else None

    # Messages
    def get_messages_by_member_id(self, member_id: int) -> List[dict]:
        response = self.supabase.table("messages").select("*").eq("family_member_id", member_id).order("created_at", desc=True).execute()
        return response.data

    def create_message(self, message: dict) -> dict:
        response = self.supabase.table("messages").insert(message).execute()
        return response.data[0] if response.data else None

    # Users (Simple Auth placeholder)
    def create_user(self, user: dict) -> dict:
        response = self.supabase.table("users").insert(user).execute()
        return response.data[0] if response.data else None

    def get_user_by_contact(self, contact: str) -> dict:
        response = self.supabase.table("users").select("*").eq("phone_or_email", contact).execute()
        return response.data[0] if response.data else None

repo = SupabaseRepository()
