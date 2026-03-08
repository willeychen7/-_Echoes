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
  spouseId?: number;     // 配偶 ID
  gender?: string;
  createdByMemberId?: number;
  userId?: number | string;
  // 以下为闽系家谱扩展字段
  generationNum?: number; // 昭穆（辈分）绝对值
  surname?: string;       // 姓氏
  ancestralHall?: string; // 房头/房份 (例如：大房、二房)
  isAdopted?: boolean;    // 是否为继嗣/祧子
  memberType?: 'human' | 'pet'; // 成员类型：人类或宠物
  logicTag?: string; // 逻辑坐标 (比如 "[F]-f,f-o大")
  logic_tag?: string; // 数据库蛇形命名兼容
  kinshipType?: string; // 亲疏类型：blood (血亲), social (社交)
  kinship_type?: string;
  member_type?: string;
  mapX?: number; // 家族树地图横坐标
  mapY?: number; // 家族树地图纵坐标
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
  memberIds?: number[];
  customMemberName?: string;
  location?: string;
  notes?: string;
}

export interface Message {
  id: number;
  familyMemberId: number;
  authorId?: number;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  duration?: number;
  createdAt: string;
  likes?: number;
  likedBy?: string[];
  isLiked?: boolean;
  eventId?: number;
}
