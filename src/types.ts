export enum MessageType {
  TEXT = "text",
  AUDIO = "audio",
  IMAGE = "image",
  VIDEO = "video"
}

export interface User {
  id: number;
  phoneOrEmail: string;
  name: string;
  relationship?: string;
}

export interface FamilyMember {
  id: number;
  name: string;
  relationship: string;
  avatarUrl: string;
  bio?: string;
  birthDate?: string;
  inviteCode?: string;
  isRegistered?: boolean;
  standardRole?: string;
  fatherId?: number;
  motherId?: number;
  gender?: string;
  createdByMemberId?: number;
}

export interface FamilyEvent {
  id: number;
  title: string;
  date: string;
  type: string;
  description?: string;
  daysRemaining?: number;
  isRecurring?: boolean;
  memberId?: number;
  customMemberName?: string;
  location?: string;
  notes?: string;
}

export interface Message {
  id: number;
  familyMemberId: number;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  duration?: number;
  createdAt: string;
  likes?: number;
  isLiked?: boolean;
  eventId?: number;
}
