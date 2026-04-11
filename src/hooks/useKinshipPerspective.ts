import { useMemo } from 'react';
import { FamilyMember } from '../types';
import { getRigorousRelationship, getRelationType } from '../lib/relationships';

/**
 * useKinshipPerspective
 * 核心 Hook：计算当前登录用户相对于目标成员的称谓视角。
 * 解决 ArchivePage.tsx 中变量声明冲突及 ID 类型匹配问题。
 */
export function useKinshipPerspective(
  targetMember: FamilyMember | null,
  allMembers: FamilyMember[]
) {
  // 1. 获取当前登录用户
  const currentUser = useMemo(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  }, []);

  // 2. 在成员列表中找到“我”对应的节点
  const meNode = useMemo(() => {
    if (!allMembers.length || !currentUser) return currentUser;
    
    return allMembers.find(m => 
      // 优先匹配 UUID 字符串，确保类型健壮性
      (m.userId && currentUser.id && String(m.userId) === String(currentUser.id)) ||
      (m.id && currentUser.memberId && String(m.id) === String(currentUser.memberId))
    ) || currentUser;
  }, [allMembers, currentUser]);

  // 3. 计算我与目标成员的关系
  const relationship = useMemo(() => {
    if (!targetMember || !meNode) return "";
    return getRigorousRelationship(meNode, targetMember, allMembers);
  }, [meNode, targetMember, allMembers]);

  // 4. 判断关系类型 (blood/affinal/social)
  const relType = useMemo(() => {
    return getRelationType(relationship);
  }, [relationship]);

  // 5. 判断目标是否为“我”本人
  const isMe = useMemo(() => {
    if (!targetMember || !currentUser) return false;
    return (
      (targetMember.id && currentUser.memberId && String(targetMember.id) === String(currentUser.memberId)) ||
      (targetMember.userId && currentUser.id && String(targetMember.userId) === String(currentUser.id))
    );
  }, [targetMember, currentUser]);

  return {
    meNode,
    relationship,
    relType,
    isMe,
    currentUser
  };
}
