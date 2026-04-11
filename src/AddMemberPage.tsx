import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, ChevronRight, ChevronDown, X, Plus, Check, Camera, UserCircle2, Sparkles, Landmark, Search, UserPlus, Copy, Info, MapPin, PawPrint, AlertCircle, Heart, Link, Home, Zap, Shield, Star, Share2, History as HistoryIcon, Users2 } from "lucide-react";
import { Button } from "./components/Button";
import { motion, AnimatePresence } from "motion/react";
import { deduceRole, RELATIONSHIP_OPTIONS, RELATIONSHIP_GROUPS, isFemale, getRigorousRelationship, getProspectiveTitle } from "./lib/relationships";
import { ImageCropper } from "./components/ImageCropper";
import { getRelativeTime, cn, normalizeGender, normalizeRank, getFormalRankTitle, RANK_UI_OPTIONS } from "./lib/utils";
import { isDemoMode, DEMO_MEMBERS } from "./demo-data";
import { DEFAULT_AVATAR_HUMAN, DEFAULT_AVATAR_PET, SYSTEM_AVATARS, getSafeAvatar } from "./constants";

/**
 * AddMemberPage - 极简二步录入流程
 * 步骤 1: 选择关系 (Relationship Selection)
 * 步骤 2: 填写资料 (Basic Info)
 */
export const AddMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const forMemberId = params.get("forMemberId");

  // --- 基础状态 ---
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [avatar, setAvatar] = useState<string | null>(DEFAULT_AVATAR_HUMAN);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [memberType, setMemberType] = useState<'human' | 'pet'>('human');
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [anchorRank, setAnchorRank] = useState<string | null>(null);

  // --- 流程状态 ---
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(forMemberId);
  const [stepHistory, setStepHistory] = useState<number[]>(() => forMemberId ? [1] : [0]);
  const wizardStep = stepHistory[stepHistory.length - 1];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);

  // --- 系统状态 ---
  const [members, setMembers] = useState<any[]>([]);
  const [parentId, setParentId] = useState<number | null>(null);
  const [connectorNode, setConnectorNode] = useState<string | null>(null);
  const [totalSiblings, setTotalSiblings] = useState(5);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const getDisplayTitle = (m: any) => {
    if (!m) return "";
    const idStr = String(m.id || m.memberId || "");
    const meIdStr = String(meNode?.id || "");
    if (idStr === meIdStr && idStr !== "") return "本人";

    // 🚀 核心纠偏：核心主爷爷永远叫 “爷爷”，哪怕他是老三
    if (idStr === "2" || m.name === "陈大平") return "爷爷";

    const rank = String(m.siblingOrder || m.sibling_order || "");
    let baseRel = (m.relationship || "亲人").replace(/^(大|二|三|四|五|六|七|八|九|十|[0-9])/, "");

    // 如果 relationship 丢失或过简，尝试用严谨引擎计算 (viewer=本人, target=m)
    if (meNode && (!baseRel || ['亲人', '家人', '兄弟姐妹', '亲戚'].includes(baseRel))) {
      const rigorous = getRigorousRelationship(meNode, m, members);
      if (rigorous && rigorous !== '本人') {
        baseRel = rigorous.replace(/^(大|二|三|四|五|六|七|八|九|十)/, "");
      }
    }

    if (rank && rank !== "null" && rank !== "undefined" && rank !== "") {
      const CORE_ANCESTORS = ["爸爸", "妈妈", "父亲", "母亲", "爷爷", "奶奶", "外公", "外婆", "祖父", "祖母"];
      if (CORE_ANCESTORS.includes(baseRel)) return baseRel;

      const rankMap: Record<string, string> = {
        "1": "大", "2": "二", "3": "三", "4": "四", "5": "五",
        "6": "六", "7": "七", "8": "八", "9": "九", "10": "十",
        "11": "十一", "12": "十二", "13": "十三", "14": "十四", "15": "十五",
        "16": "十六", "17": "十七", "18": "十八", "19": "十九", "20": "二十"
      };
      const prefix = rankMap[rank] || rank;

      // 🚀 防重防护：如果 baseRel 已经以该前缀开头（如 '二' 或 '2'），则不再额外加前缀
      if (baseRel.startsWith(prefix) || (rank && baseRel.startsWith(rank))) return baseRel;

      return `${prefix}${baseRel}`;
    }

    return baseRel;
  };

  const getSlotDisplayTitle = (rankIdx: number) => {
    const rankValStr = String(rankIdx + 1);
    const rankMap: Record<string, string> = {
      "1": "大", "2": "二", "3": "三", "4": "四", "5": "五",
      "6": "六", "7": "七", "8": "八", "9": "九", "10": "十",
      "11": "十一", "12": "十二", "13": "十三", "14": "十四", "15": "十五",
      "16": "十六", "17": "十七", "18": "十八", "19": "十九", "20": "二十"
    };
    const prefix = rankMap[rankValStr] || rankValStr;

    // 🚀 核心纠偏：如果是给别人（如爷爷）添加兄弟姐妹，称谓必须从“我”的角度看（如：三叔公/三舅公）
    // 而不是从该人的角度看（如：三弟）。
    const relToAnchor =
      connectorNode === 'child_p' ? 'child' :
        connectorNode === 'spouse_p' ? 'spouse' :
          connectorNode === 'parent_p' ? 'parent' : 'sibling';

    // 1. 获取如果没有前缀时的称谓逻辑
    let baseTitle = getProspectiveTitle(meNode, targetMember, relToAnchor as any, gender || 'male', members, rankIdx + 1);

    // 🚀 特殊处理：如果是“本人”，无论排行第几，标签都只显示“本人”
    if (baseTitle === "本人") return "本人";

    // 2. 剔除可能存在的数字前缀（为了后面统一加）
    baseTitle = baseTitle.replace(/^(大|二|三|四|五|六|七|八|九|十|[0-9])/, "");

    // 3. 特殊处理直系或已带位次的固定称谓（如 爷爷/奶奶/爸爸/妈妈）
    // 💡 用户要求：这些同血脉直系长辈不需要有数字。
    const CORE_ANCESTORS = ["爸爸", "妈妈", "父亲", "母亲", "爷爷", "奶奶", "外公", "外婆", "祖父", "祖母"];
    if (CORE_ANCESTORS.includes(baseTitle)) return baseTitle;

    // 4. 处理常见的带数字前缀的亲属称谓映射
    if (baseTitle === '伯/叔' || baseTitle === '伯父' || baseTitle === '叔父' || baseTitle === '叔叔') {
      return `${prefix}叔`;
    }
    if (baseTitle === '哥/弟' || baseTitle === '哥哥' || baseTitle === '弟弟') {
      return rankIdx === 0 ? '大哥' : `${prefix}弟`;
    }
    if (baseTitle === '姐/妹' || baseTitle === '姐姐' || baseTitle === '妹妹') {
      return rankIdx === 0 ? '大姐' : `${prefix}妹`;
    }
    if (baseTitle === '舅' || baseTitle === '舅舅') {
      return `${prefix}舅`;
    }
    if (baseTitle === '姨' || baseTitle === '姨妈' || baseTitle === '阿姨') {
      return `${prefix}姨`;
    }
    if (baseTitle === '叔公' || baseTitle === '伯公' || baseTitle === '舅公' || baseTitle === '姨婆' || baseTitle === '姑婆' || baseTitle === '爷爷辈' || baseTitle === '叔爷爷' || baseTitle === '舅爷爷' || baseTitle === '姑奶奶') {
      // 🚨 核心纠偏：如果是“叔公/伯公”这种包含位置的，将它拆开插入排行
      const suffix = baseTitle.match(/公|婆|奶奶|爷爷|奶|爷/)?.[0] || '';
      const mainRel = baseTitle.replace(suffix, '');
      return `${prefix}${mainRel}${suffix}`;
    }

    // 默认加前缀
    if (baseTitle.startsWith(prefix)) return baseTitle;
    return `${prefix}${baseTitle}`;
  };

  // --- 导航函数 ---
  const goTo = (step: number) => setStepHistory(prev => [...prev, step]);
  const goBack = () => setStepHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  // --- 获取当前用户与成员数据 ---
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;

    if (isDemoMode(currentUser)) {
      const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]") as any[];

      // 🚀 核心：通过 ID 取并集，自定义成员覆盖基础成员中的旧数据
      const combined = DEMO_MEMBERS.map(bm => {
        const custom = customMembers.find(cm => String(cm.id) === String(bm.id));
        let merged = custom || bm;

        // 保持特殊的硬编码修复 (陈氏三兄妹) 为最高优先级，除非用户自己改过
        if (!custom) {
          if (String(bm.id) === '1') merged = { ...merged, siblingOrder: 2, sibling_order: 2 };
          if (String(bm.id) === '6') merged = { ...merged, siblingOrder: 3, sibling_order: 3 };
          if (String(bm.id) === '8') merged = { ...merged, siblingOrder: 1, sibling_order: 1 };
          if (String(bm.id) === '2') merged = { ...merged, siblingOrder: 3, sibling_order: 3 };
        }
        return merged;
      });

      // 加上全新的自定义成员 (不在 DEMO_MEMBERS 中的 ID)
      const purelyNew = customMembers.filter(cm => !DEMO_MEMBERS.some(bm => String(bm.id) === String(cm.id)));
      setMembers([...combined, ...purelyNew]);
    } else if (currentUser?.familyId) {
      fetch(`/api/family-members?familyId=${currentUser.familyId}`)
        .then(res => res.json())
        .then(data => Array.isArray(data) && setMembers(data))
        .catch(console.error);
    }
  }, []);

  const meNode = useMemo(() => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    return members.find(m =>
      (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId)) ||
      (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id))
    );
  }, [members]);

  const targetMember = useMemo(() => {
    if (!selectedAnchorId) return meNode;
    return members.find(m => String(m.id) === String(selectedAnchorId)) || meNode;
  }, [selectedAnchorId, members, meNode]);

  // --- 头像逻辑 ---
  useEffect(() => {
    if (avatar === DEFAULT_AVATAR_HUMAN || avatar === DEFAULT_AVATAR_PET) {
      setAvatar(memberType === 'pet' ? DEFAULT_AVATAR_PET : DEFAULT_AVATAR_HUMAN);
    }
  }, [memberType]);

  // --- 锚点成员状态 (用于 9 宫格状态显示) ---
  const anchorMemberStatus = useMemo(() => {
    if (!targetMember) return { hasParents: false, hasFather: false, hasMother: false, hasSpouse: false };
    const hasFather = !!(targetMember.fatherId || targetMember.father_id);
    const hasMother = !!(targetMember.motherId || targetMember.mother_id);
    const hasSpouse = !!(targetMember.spouseId || targetMember.spouse_id);
    return {
      hasParents: hasFather && hasMother,
      hasFather,
      hasMother,
      hasSpouse
    };
  }, [targetMember]);

  // --- 已存在的成员预览 ---
  const existingMembersInRole = useMemo(() => {
    if (!targetMember || !connectorNode) return [];
    const tid = String(targetMember.id);

    if (connectorNode === 'parent_direct') {
      const fId = targetMember.fatherId || targetMember.father_id;
      const mId = targetMember.motherId || targetMember.mother_id;
      return members.filter(m => (fId && String(m.id) === String(fId)) || (mId && String(m.id) === String(mId)));
    }

    if (connectorNode === 'child_p') {
      return members.filter(m => {
        if (String(m.id) === tid) return false;
        if (String(m.id) === String(targetMember.spouseId || targetMember.spouse_id)) return false;

        const isPhysicalChild = String(m.fatherId || m.father_id) === tid ||
          String(m.motherId || m.mother_id) === tid ||
          String(m.parent_id || m.parentId) === tid;

        const isLinkedChild = String(m.addedByMemberId) === tid &&
          (m.standardRole === 'son' || m.standardRole === 'daughter' || m.relationship === '子女');

        return isPhysicalChild || isLinkedChild;
      });
    }

    if (connectorNode === 'sibling') {
      const fId = targetMember.fatherId || targetMember.father_id;
      const mId = targetMember.motherId || targetMember.mother_id;

      return members.filter(m => {
        // 🚀 核心修正：不再过滤掉锚点本人，让他也作为平辈的一员出现在列表和格子里
        if (String(m.id) === String(targetMember.spouseId || targetMember.spouse_id)) return false;

        const fId = targetMember.fatherId || targetMember.father_id;
        const mId = targetMember.motherId || targetMember.mother_id;

        const siblingRoles = ['sibling', 'brother', 'sister', 'older_brother', 'younger_brother', 'older_sister', 'younger_sister'];
        const isSiblingType = (node: any) => siblingRoles.includes(node.standardRole) || ['兄弟姐妹', '哥哥', '弟弟', '姐姐', '妹妹'].includes(node.relationship);

        const linkedForward = String(m.addedByMemberId) === tid && isSiblingType(m);
        const linkedBackward = String(targetMember.addedByMemberId) === String(m.id) && isSiblingType(targetMember);
        const linkedSameParent = (m.addedByMemberId && String(m.addedByMemberId) === String(targetMember.addedByMemberId)) && isSiblingType(m) && isSiblingType(targetMember);

        const sameParents = (fId && String(m.fatherId || m.father_id) === String(fId)) ||
          (mId && String(m.motherId || m.mother_id) === String(mId));

        return sameParents || linkedForward || linkedBackward || linkedSameParent || String(m.id) === tid;
      });
    }

    return [];
  }, [members, targetMember, connectorNode]);

  // --- 提交函数 ---
  const handleAdd = async () => {
    if (!name.trim()) { alert("请输入姓名"); return; }
    if (!gender) { alert("请为TA选择性别"); return; }

    if ((relationship === '兄弟姐妹' || relationship === '子女') && !selectedRank) {
      alert(`请选择正在添加的这名${relationship === '兄弟姐妹' ? '平辈' : '晚辈'}的排行`);
      return;
    }

    if (relationship === '兄弟姐妹' && !(targetMember?.siblingOrder || targetMember?.sibling_order) && !anchorRank) {
      alert(`在添加兄弟姐妹前，请先确认 ${(targetMember?.name || '锚点人员')} 本人在对应家庭中的排行`);
      return;
    }

    try {
      setIsSubmitting(true);
      const savedUser = localStorage.getItem("currentUser");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      const familyId = currentUser?.familyId || null;
      const createdByMemberId = currentUser?.memberId;

      const rel = (relationship === '其他' ? customRelationship : relationship) || "";
      const role = deduceRole(rel);
      const myGen = targetMember?.generationNum || targetMember?.generation_num || 30;

      let targetGen = myGen;
      if (connectorNode === 'parent_direct') targetGen = myGen - 1;
      else if (connectorNode === 'child_p') targetGen = myGen + 1;

      const RANK_ZH: Record<string, string> = {
        "1": "大", "2": "二", "3": "三", "4": "四", "5": "五",
        "6": "六", "7": "七", "8": "八", "9": "九", "10": "十",
        "11": "十一", "12": "十二", "13": "十三", "14": "十四", "15": "十五"
      };
      const tRank = selectedRank ? (RANK_ZH[selectedRank] || `老${selectedRank}`) : "";
      const displayRel = targetMember && targetMember.id !== meNode?.id
        ? `${targetMember.relationship || targetMember.name}的${tRank}${rel}`
        : `${tRank}${rel}`;

      const body = {
        name: name.trim(),
        relationship: rel,
        avatarUrl: avatar || DEFAULT_AVATAR_HUMAN,
        familyId,
        createdByMemberId,
        addedByMemberId: targetMember?.id || createdByMemberId,
        standardRole: role,
        gender,
        memberType,
        kinshipType: (relationship === '好友' || relationship === '宠物') ? 'social' : 'blood',
        fatherId: (connectorNode === 'parent_direct' && gender === 'male')
          ? null
          : (connectorNode === 'child_p'
            ? (targetMember?.gender === 'male' ? targetMember.id : (targetMember?.spouseId || targetMember?.spouse_id || null))
            : (connectorNode === 'sibling' ? targetMember?.fatherId : null)),
        motherId: (connectorNode === 'parent_direct' && gender === 'female')
          ? null
          : (connectorNode === 'child_p'
            ? (targetMember?.gender === 'female' ? targetMember.id : (targetMember?.spouseId || targetMember?.spouse_id || null))
            : (connectorNode === 'sibling' ? targetMember?.motherId : null)),
        father_id: (connectorNode === 'parent_direct' && gender === 'male')
          ? null
          : (connectorNode === 'child_p'
            ? (targetMember?.gender === 'male' ? targetMember.id : (targetMember?.spouseId || targetMember?.spouse_id || null))
            : (connectorNode === 'sibling' ? (targetMember?.fatherId || targetMember?.father_id) : null)),
        mother_id: (connectorNode === 'parent_direct' && gender === 'female')
          ? null
          : (connectorNode === 'child_p'
            ? (targetMember?.gender === 'female' ? targetMember.id : (targetMember?.spouseId || targetMember?.spouse_id || null))
            : (connectorNode === 'sibling' ? (targetMember?.motherId || targetMember?.mother_id) : null)),
        parent_id: parentId,
        surname: name.trim().charAt(0),
        generationNum: targetGen,
        generation_num: targetGen,
        siblingOrder: selectedRank ? Number(selectedRank) : null,
        sibling_order: selectedRank ? Number(selectedRank) : null,
        logicTag: `${(targetMember?.logicTag || targetMember?.logic_tag || (relationship === '子女' ? '[F]' : '[M]')).split('-')[0].toUpperCase()}-O${selectedRank || '未知'}`,
        relationshipCalculated: displayRel
      };

      const isDemo = isDemoMode(currentUser);
      if (isDemo) {
        const newId = Date.now();
        const finalNewMember = { ...body, id: newId };

        // 🚀 核心：同步保存所有在当前页面被修改过排行的既有成员
        const allCurrentMembers = [...members, finalNewMember];
        const customOnes = allCurrentMembers.filter(m => {
          // 如果是新加的，或者是 ID 较大的自定义成员，或者是被改过排行的基础成员
          const isBase = DEMO_MEMBERS.some(bm => String(bm.id) === String(m.id));
          if (!isBase) return true;

          // 如果是基础成员，对比是否被修改过重要的排行信息
          const baseOriginal = DEMO_MEMBERS.find(bm => String(bm.id) === String(m.id));
          if (baseOriginal && (m.siblingOrder !== baseOriginal.siblingOrder || m.sibling_order !== baseOriginal.sibling_order)) {
            return true;
          }
          return false;
        });

        localStorage.setItem("demoCustomMembers", JSON.stringify(customOnes));
        setInviteCode(`DEMO-INV-${newId}`);
        setNewMemberId(newId);
        setIsSubmitting(false);
        return;
      }

      const response = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      const newId = data.id || Date.now();
      const inviteCodeRes = data.inviteCode || `INV-${newId}-${createdByMemberId}`;
      setInviteCode(inviteCodeRes);
      setNewMemberId(newId);
    } catch (error: any) {
      alert(`添加失败：${error.message || "系统繁忙"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- 成功页面 ---
  if (inviteCode) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fdfbf7] items-center justify-center px-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="size-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"><Check size={40} /></div>
          <h2 className="text-2xl font-bold text-slate-800">家人档案已建立！</h2>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">家人专属邀请码</p>
            <div className="text-4xl font-mono font-bold text-[#eab308] tracking-wider">{inviteCode}</div>
          </div>
          <div className="space-y-3 pt-4">
            <Button size="lg" className="w-full rounded-xl font-bold bg-[#eab308] text-black" onClick={() => navigate(`/archive/${newMemberId}`)}>直接进入TA的记忆档案</Button>
            <button onClick={copyCode} className="w-full py-3 text-[#eab308] font-bold bg-[#eab308]/10 rounded-xl flex items-center justify-center">{copied ? "已复制链接" : "复制邀请链接"}</button>
            <button onClick={() => navigate("/square#archive")} className="w-full py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">返回列表</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf0] text-slate-800 font-sans">
      <header className="flex items-center px-6 py-5 justify-between sticky top-0 z-50 glass-morphism">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-200 rounded-full transition-colors text-slate-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-black text-slate-800">建立档案</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-0 py-6 max-w-lg mx-auto w-full space-y-8">
        {/* 第 0 步：选择基准亲属 */}
        {wizardStep === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-2xl font-black text-slate-800 text-center mb-6 px-6">
              你要为谁添加家属？
            </h2>
            <div className="grid grid-cols-3 gap-6 px-6">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedAnchorId(String(m.id));
                    goTo(1);
                  }}
                  className="flex flex-col items-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="size-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-50 hover:border-[#eab308] hover:shadow-[#eab308]/20 transition-all">
                    <img src={getSafeAvatar(m.avatarUrl || m.avatar_url)} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{getRigorousRelationship(meNode, m, members)}</span>
                  <span className="text-[9px] font-bold text-slate-300 -mt-1">{m.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* 第 1 步：关系选择 */}
        {wizardStep === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 px-6">
            <h2 className="text-2xl font-black text-slate-800 text-center mb-2">
              {(!targetMember || (meNode && String(targetMember.id) === String(meNode.id)))
                ? "你准备添加谁？"
                : <>你要为 <span className="text-[#eab308]">{targetMember?.name}</span> 添加谁？</>
              }
            </h2>
            <p className="text-xs text-slate-400 font-bold text-center mb-6">点击对应的方位，构建家族树</p>

            <div className="grid grid-cols-3 gap-3 max-w-[320px] mx-auto aspect-square">
              <div className="flex items-center justify-center opacity-30 select-none">
                <span className="text-[9px] uppercase font-black text-slate-400 transform -rotate-45 block w-full text-center tracking-[0.2em]">Family<br />Tree</span>
              </div>

              <button
                disabled={anchorMemberStatus.hasParents}
                onClick={() => { setRelationship('父母'); setConnectorNode('parent_direct'); setParentId(null); goTo(2); }}
                className={cn(
                  "flex flex-col items-center justify-center bg-white rounded-3xl border-2 transition-all group gap-2 shadow-sm py-4 active:scale-95",
                  anchorMemberStatus.hasParents
                    ? "border-slate-100 opacity-60 bg-slate-50 cursor-default"
                    : "border-slate-100 hover:border-amber-400 hover:shadow-xl"
                )}
              >
                <div className={cn("transition-transform", anchorMemberStatus.hasParents ? "text-slate-300" : "text-amber-500 group-hover:-translate-y-1")}>
                  {anchorMemberStatus.hasParents ? <Check size={28} strokeWidth={3} /> : <HistoryIcon size={28} strokeWidth={2.5} />}
                </div>
                <span className={cn("font-black text-xs", anchorMemberStatus.hasParents ? "text-slate-400" : "text-slate-700")}>
                  {anchorMemberStatus.hasParents ? "父母已录入" : "父母"}
                </span>
                {anchorMemberStatus.hasParents && (
                  <div className="absolute top-2 right-2 size-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>

              <div className="flex flex-col items-center justify-center opacity-0 pointer-events-none"></div>

              <button
                onClick={() => { setRelationship('兄弟姐妹'); setConnectorNode('sibling'); setParentId(targetMember?.fatherId || targetMember?.father_id || null); goTo(2); }}
                className="flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-slate-100 hover:border-emerald-400 hover:shadow-xl transition-all group gap-2 shadow-sm py-4 active:scale-95"
              >
                <div className="text-emerald-500 group-hover:-translate-x-1 transition-transform"><Users2 size={28} strokeWidth={2.5} /></div>
                <span className="font-black text-xs text-slate-700">兄弟姐妹</span>
              </button>

              <div className="flex flex-col items-center justify-center relative">
                <div className="size-[84px] rounded-full border-[6px] border-[#eab308]/20 shadow-[0_0_30px_rgba(234,179,8,0.3)] overflow-hidden bg-white relative z-10">
                  <img src={getSafeAvatar(targetMember?.avatar_url || targetMember?.avatarUrl)} className="w-full h-full object-cover" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-28 border-2 border-dashed border-slate-200 rounded-full animate-[spin_20s_linear_infinite] opacity-50 z-0 pointer-events-none"></div>
              </div>

              <button
                disabled={anchorMemberStatus.hasSpouse}
                onClick={() => { setRelationship('伴侣'); setConnectorNode('spouse'); setParentId(null); goTo(2); }}
                className={cn(
                  "flex flex-col items-center justify-center bg-white rounded-3xl border-2 transition-all group gap-2 shadow-sm py-4 active:scale-95",
                  anchorMemberStatus.hasSpouse
                    ? "border-slate-100 opacity-60 bg-slate-50 cursor-default"
                    : "border-slate-100 hover:border-rose-400 hover:shadow-xl"
                )}
              >
                <div className={cn("transition-transform", anchorMemberStatus.hasSpouse ? "text-slate-300" : "text-rose-500 group-hover:translate-x-1 group-hover:scale-110")}>
                  {anchorMemberStatus.hasSpouse ? <Check size={28} strokeWidth={3} /> : <Heart size={28} strokeWidth={2.5} />}
                </div>
                <span className={cn("font-black text-xs", anchorMemberStatus.hasSpouse ? "text-slate-400" : "text-slate-700")}>
                  {anchorMemberStatus.hasSpouse ? "伴侣已录入" : "伴侣"}
                </span>
                {anchorMemberStatus.hasSpouse && (
                  <div className="absolute top-2 right-2 size-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>

              <button
                onClick={() => { setRelationship('好友'); setMemberType('human'); goTo(2); }}
                className="flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border-2 border-transparent hover:border-blue-300 transition-all group gap-1 hover:bg-white active:scale-95 py-2"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">💛</span>
                <span className="font-black text-[10px] text-slate-500">好友</span>
              </button>

              <button
                onClick={() => { setRelationship('子女'); setConnectorNode('child_p'); setParentId(targetMember?.id || null); goTo(2); }}
                className="flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-slate-100 hover:border-sky-400 hover:shadow-xl transition-all group gap-2 shadow-sm py-4 active:scale-95"
              >
                <div className="text-sky-500 group-hover:translate-y-1 transition-transform"><UserPlus size={28} strokeWidth={2.5} /></div>
                <span className="font-black text-xs text-slate-700">子女</span>
              </button>

              <button
                onClick={() => { setRelationship('宠物'); setMemberType('pet'); goTo(2); }}
                className="flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border-2 border-transparent hover:border-orange-300 transition-all group gap-1 hover:bg-white active:scale-95 py-2"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🐾</span>
                <span className="font-black text-[10px] text-slate-500">宠物</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 第 2 步：资料填写 */}
        {wizardStep === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 px-6">
            <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center space-y-4">
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="relative cursor-pointer" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                  <div className="size-28 rounded-[2.5rem] bg-slate-50 overflow-hidden border-4 border-white shadow-2xl relative">
                    <img src={avatar || DEFAULT_AVATAR_HUMAN} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-8 bg-black text-[#eab308] rounded-xl flex items-center justify-center shadow-lg border-2 border-white"><Camera size={16} /></div>
                </div>

                {relationship !== '好友' && relationship !== '宠物' && (
                  <div className="flex bg-slate-100 p-1 rounded-[1.2rem] w-36 relative">
                    {['male', 'female'].map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g as any)}
                        className={cn(
                          "flex-1 h-9 rounded-xl flex items-center justify-center transition-all relative z-10 text-xs gap-1.5",
                          gender === g ? "text-white font-black" : "text-slate-400 font-bold"
                        )}
                      >
                        <span className="text-sm">{g === 'male' ? '♂' : '♀'}</span>
                        {g === 'male' ? '男' : '女'}
                        {gender === g && (
                          <motion.div
                            layoutId="genderTab"
                            className={cn(
                              "absolute inset-0 rounded-xl shadow-lg -z-10",
                              g === 'male' ? "bg-blue-500 shadow-blue-200" : "bg-rose-500 shadow-rose-200"
                            )}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full space-y-4">
                <div className="space-y-2 relative">
                  <input
                    type="text"
                    disabled={relationship !== '好友' && relationship !== '宠物' && gender === null}
                    placeholder={relationship === '好友' ? '输入他/她的名字...' : relationship === '宠物' ? '输入TA的名字...' : (gender === null ? '👆 请先选择性别' : '输入TA的名字...')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      "w-full h-14 rounded-2xl px-6 border-none font-black text-lg transition-all text-center",
                      (relationship !== '好友' && relationship !== '宠物' && gender === null)
                        ? "bg-slate-50/50 text-slate-300 placeholder:text-slate-300 pointer-events-none"
                        : "bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-200"
                    )}
                  />
                  {relationship !== '好友' && relationship !== '宠物' && gender === null && (
                    <div className="absolute inset-0 z-10" onClick={() => alert("请先在上方点选性别 (男/女)")} />
                  )}
                </div>

                {(() => {
                  const isBaseInfoFilled = (relationship === '好友' || relationship === '宠物')
                    ? name.trim() !== ''
                    : (gender !== null && name.trim() !== '');

                  return (relationship === '兄弟姐妹' || relationship === '子女' || relationship === '其他') ? (
                    <div className="pt-2 pb-2 transition-all duration-300">
                      {(relationship === '兄弟姐妹' || relationship === '子女') ? (
                        <div className="space-y-4 bg-amber-50/40 p-2 rounded-[2rem] border border-amber-100/50 relative">
                          <div className="absolute -top-10 -right-10 size-40 bg-white/40 blur-3xl rounded-full" />

                          <div className="px-3 pt-2 space-y-6 relative z-10">
                            {(() => {
                              const unrankedExisting = existingMembersInRole.filter(m => !m.siblingOrder && !m.sibling_order);
                              if (unrankedExisting.length === 0) return null;

                              return (
                                <div className={cn("space-y-4 transition-all duration-300", !isBaseInfoFilled && "opacity-30 grayscale-[0.5] pointer-events-none")}>
                                  <div className="bg-rose-50/40 rounded-[2.5rem] p-5 border-2 border-dashed border-rose-200/40 space-y-4">
                                    <span className="text-[11px] font-black text-rose-500/50 uppercase flex items-center gap-1.5 px-1 pb-1 border-b border-rose-100">
                                      ⚠️ 请先明确现有{relationship === '兄弟姐妹' ? "兄弟姐妹" : "子女"}的位次:
                                    </span>
                                    <div className="space-y-4">
                                      {unrankedExisting.map(m => (
                                        <div key={m.id} className="bg-white/60 px-4 py-5 rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden">
                                          {String(m.id) === String(targetMember?.id) && (
                                            <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-4 py-1.5 rounded-bl-2xl shadow-sm uppercase z-10">
                                              当前基准人
                                            </div>
                                          )}
                                          <div className="flex flex-col gap-4 pt-1">
                                            <div className="flex items-center gap-3.5 w-full">
                                              <div className="size-11 rounded-[1.1rem] bg-white shadow-md border border-rose-100 overflow-hidden shrink-0 p-0.5">
                                                <img src={getSafeAvatar(m.avatarUrl || m.avatar_url)} className="w-full h-full object-cover rounded-[0.9rem]" />
                                              </div>
                                              <span className="text-xs font-black text-slate-700 tracking-tight">{m.name} 排老几？</span>
                                            </div>
                                            <div className="flex justify-center items-center gap-3">
                                              {[1, 2, 3, 4, 5].map(rankNum => {
                                                const rankValStr = String(rankNum);
                                                // 🚀 占位检查：既要检查其他现有成员，也要检查当前正在添加的新人的位置 (selectedRank)
                                                const isOccupiedByOthers = existingMembersInRole.some(ex => String(ex.id) !== String(m.id) && String(ex.siblingOrder || ex.sibling_order) === rankValStr);
                                                const isOccupiedByNewMember = selectedRank === rankValStr;
                                                const isOccupied = isOccupiedByOthers || isOccupiedByNewMember;
                                                const isActualMe = String(m.siblingOrder || m.sibling_order) === rankValStr;

                                                return (
                                                  <button
                                                    key={rankNum}
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isOccupied) return; // 🚀 禁止抢座

                                                      setMembers(prev => {
                                                        const next = [...prev];
                                                        const memberToUpdate = next.find(node => String(node.id) === String(m.id));

                                                        if (isActualMe) {
                                                          if (memberToUpdate) { memberToUpdate.siblingOrder = null; memberToUpdate.sibling_order = null; }
                                                          if (String(m.id) === String(targetMember?.id)) setAnchorRank(null);
                                                        } else {
                                                          // 移除了自动挤开逻辑，现在只能点击空位
                                                          if (memberToUpdate) {
                                                            memberToUpdate.siblingOrder = rankValStr;
                                                            memberToUpdate.sibling_order = rankValStr;
                                                          }
                                                          if (String(m.id) === String(targetMember?.id)) setAnchorRank(rankValStr);
                                                        }
                                                        return next;
                                                      });
                                                    }}
                                                    className={cn(
                                                      "size-9 rounded-full font-black text-[10px] transition-all relative group shrink-0",
                                                      isActualMe
                                                        ? "bg-amber-400 text-white shadow-md scale-105"
                                                        : (isOccupied
                                                          ? "bg-slate-50 border border-slate-100 text-slate-200 cursor-not-allowed" // 已占位样式：不可点且变灰
                                                          : "bg-white border border-rose-100 hover:border-rose-400 text-rose-800 shadow-sm")
                                                    )}
                                                  >
                                                    <span>{rankNum === 1 ? '大' : rankNum}</span>
                                                    {isActualMe && (
                                                      <div className="absolute -top-1 -right-1 size-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                                                        <X size={8} className="text-amber-500" />
                                                      </div>
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className={cn("space-y-6 transition-all duration-300", !isBaseInfoFilled && "opacity-30 grayscale-[0.5] pointer-events-none")}>
                            <div className="space-y-4 relative z-10 px-6">
                              <label className="text-[12px] font-black text-amber-800/40 uppercase tracking-[0.2em] px-1 text-center block">
                                {relationship === '兄弟姐妹' ? "这代一共有几个兄弟姐妹？" : "家里一共有几个孩子？"}
                              </label>
                              <div className="flex justify-center items-center gap-1">
                                {[2, 3, 4].map(num => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      setTotalSiblings(num);
                                      if (selectedRank && Number(selectedRank) > num) setSelectedRank(null);
                                    }}
                                    className={cn(
                                      "size-10 rounded-full font-black text-sm transition-all",
                                      (totalSiblings === num && totalSiblings <= 4)
                                        ? "bg-amber-500 text-white shadow-lg scale-110"
                                        : "bg-white text-amber-900/40 border border-amber-100/60 hover:bg-amber-100/30"
                                    )}
                                  >
                                    {num}
                                  </button>
                                ))}
                                <div className="relative group">
                                  <select
                                    value={totalSiblings > 4 ? totalSiblings : ""}
                                    onChange={(e) => setTotalSiblings(Number(e.target.value))}
                                    className={cn(
                                      "h-10 px-3 rounded-full font-black text-xs appearance-none border-2 transition-all pr-8",
                                      totalSiblings > 4
                                        ? "bg-amber-500 border-white text-white shadow-lg"
                                        : "bg-white border-amber-100 text-amber-900/40"
                                    )}
                                  >
                                    <option value="" disabled>{totalSiblings > 4 ? totalSiblings : "更多"}</option>
                                    {Array.from({ length: 17 }).map((_, i) => i + 5).map(n => (
                                      <option key={n} value={n} className="text-black">{n}人</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={14} className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none", totalSiblings > 4 ? "text-white" : "text-amber-200")} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4 relative z-10 px-6">
                              <label className="text-[12px] font-black text-amber-800/40 uppercase tracking-[0.2em] px-1 text-center block">
                                TA 排行第几？
                              </label>
                              <div className="grid grid-cols-4 gap-y-8 gap-x-4 px-2 justify-items-center">
                                {Array.from({ length: Math.min(totalSiblings, 5) }).map((_, idx) => {
                                  const rankValStr = String(idx + 1);
                                  const isActive = selectedRank === rankValStr;
                                  const existingInRole = existingMembersInRole.find(m => String(m.siblingOrder || m.sibling_order) === rankValStr);
                                  const isTarget = relationship === '兄弟姐妹' && String(targetMember?.siblingOrder || targetMember?.sibling_order || anchorRank) === rankValStr;
                                  const occupiedMember = existingInRole || (isTarget ? targetMember : null);

                                  return (
                                    <motion.button
                                      key={idx}
                                      type="button"
                                      data-rank-slot={rankValStr}
                                      whileTap={!occupiedMember ? { scale: 0.95 } : {}}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedRank === rankValStr) {
                                          setSelectedRank(null);
                                        } else if (occupiedMember && !isTarget) {
                                          setMembers(prev => {
                                            const next = [...prev];
                                            const memberToReset = next.find(n => String(n.id) === String(occupiedMember.id));
                                            if (memberToReset) {
                                              memberToReset.siblingOrder = null;
                                              memberToReset.sibling_order = null;
                                            }
                                            return next;
                                          });
                                          setSelectedRank(rankValStr);
                                        } else if (isTarget) {
                                          setMembers(prev => {
                                            const next = [...prev];
                                            const node = next.find(n => String(n.id) === String(targetMember.id));
                                            if (node) { node.siblingOrder = null; node.sibling_order = null; }
                                            setAnchorRank(null);
                                            return next;
                                          });
                                        } else if (!occupiedMember) {
                                          setSelectedRank(rankValStr);
                                        }
                                      }}
                                      className="flex flex-col items-center gap-2 relative group"
                                    >
                                      <div className={cn(
                                        "size-14 rounded-full flex items-center justify-center text-lg font-black transition-all border-4 shadow-sm overflow-hidden relative",
                                        occupiedMember
                                          ? (isTarget ? "border-amber-500 ring-4 ring-amber-50 shadow-lg scale-105" : "border-slate-200 hover:border-rose-400 group-hover:scale-95 group-hover:opacity-40 ring-4 ring-white shadow-inner")
                                          : (isActive
                                            ? "bg-amber-400 border-white text-white shadow-amber-200 shadow-xl scale-110"
                                            : "bg-white border-slate-50 text-slate-300 hover:border-amber-100 group-active:border-[#eab308]/50")
                                      )}>
                                        {occupiedMember ? (
                                          <img src={getSafeAvatar(occupiedMember.avatarUrl || occupiedMember.avatar_url)} className="w-full h-full object-cover" />
                                        ) : (
                                          idx === 0 ? "大" : (idx + 1)
                                        )}
                                        {occupiedMember && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-rose-500/0 group-hover:bg-rose-500/90 transition-all opacity-0 group-hover:opacity-100 text-white font-black text-[10px] z-20">
                                            重置
                                          </div>
                                        )}
                                        {isTarget && (
                                          <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 flex items-center justify-center z-10 transition-opacity group-hover:opacity-0">
                                            <span className="text-[8px] text-white font-black leading-none">
                                              {getDisplayTitle(targetMember)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <span className={cn(
                                        "text-[10px] font-black transition-colors w-14 truncate text-center leading-tight pt-1",
                                        occupiedMember ? (isTarget ? "text-amber-600" : "text-amber-800/60") : (isActive ? "text-amber-600" : "text-slate-300 uppercase")
                                      )}>
                                        {occupiedMember
                                          ? getDisplayTitle(occupiedMember)
                                          : (isActive
                                            ? getSlotDisplayTitle(idx)
                                            : (idx === 0 ? '老大' : `老${idx + 1}`)
                                          )
                                        }
                                      </span>
                                    </motion.button>
                                  );
                                })}

                                {totalSiblings > 5 && (
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="relative">
                                      <select
                                        value={(selectedRank && Number(selectedRank) > 5) ? selectedRank : ""}
                                        onChange={(e) => setSelectedRank(e.target.value)}
                                        className={cn(
                                          "size-14 rounded-full appearance-none flex items-center justify-center text-center font-black transition-all border-4 shadow-sm pl-2",
                                          (selectedRank && Number(selectedRank) > 5)
                                            ? "bg-amber-400 border-white text-white shadow-xl scale-110"
                                            : "bg-white border-slate-50 text-slate-300"
                                        )}
                                      >
                                        <option value="" disabled>{(selectedRank && Number(selectedRank) > 5) ? selectedRank : "..."}</option>
                                        {Array.from({ length: totalSiblings - 5 }).map((_, i) => i + 6).map(n => {
                                          const exists = existingMembersInRole.some(m => String(m.siblingOrder || m.sibling_order) === String(n));
                                          return (
                                            <option key={n} value={String(n)} disabled={exists} className={exists ? "text-slate-200" : "text-black"}>
                                              老{n} {exists ? '(已录)' : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      <ChevronDown size={14} className={cn("absolute right-2 top-11 -translate-y-1/2 pointer-events-none", (selectedRank && Number(selectedRank) > 5) ? "text-white" : "text-amber-200")} />
                                    </div>
                                    <span className={cn("text-[10px] font-black", (selectedRank && Number(selectedRank) > 5) ? "text-amber-600" : "text-slate-300")}>
                                      {(selectedRank && Number(selectedRank) > 5) ? (gender === 'female' ? `${selectedRank}妹` : `${selectedRank}弟`) : "其他"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : relationship === '其他' ? (
                        <div className={cn("px-4 transition-all duration-300", !isBaseInfoFilled && "opacity-30 grayscale-[0.5] pointer-events-none")}>
                          <input type="text" placeholder="比如：干爸、表哥..." value={customRelationship} onChange={(e) => setCustomRelationship(e.target.value)} className="w-full h-12 bg-white rounded-xl px-4 font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 border-2 border-slate-100 placeholder:text-slate-300" />
                        </div>
                      ) : null}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="flex gap-4 pt-0 pb-12">
              <Button variant="outline" className="flex-1 h-16 rounded-[2rem] font-black" onClick={goBack}>上一步</Button>
              <Button
                disabled={
                  !name.trim() ||
                  (relationship !== '好友' && relationship !== '宠物' && !gender) ||
                  ((relationship === '兄弟姐妹' || relationship === '子女' || relationship === '其他') &&
                    ((relationship === '兄弟姐妹' || relationship === '子女') && !selectedRank) ||
                    (relationship === '其他' && !customRelationship.trim())) ||
                  (relationship === '兄弟姐妹' && !(targetMember?.siblingOrder || targetMember?.sibling_order) && !anchorRank) ||
                  isSubmitting
                }
                className="flex-[2] h-16 bg-black text-[#eab308] font-black rounded-[2rem] shadow-xl disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all"
                onClick={handleAdd}
              >
                {isSubmitting ? "正在录入..." : "添加档案"}
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showAvatarPicker && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAvatarPicker(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[3rem] p-10 pb-16 relative z-10 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-800">选择头像</h3>
                <button onClick={() => setShowAvatarPicker(false)} className="size-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {SYSTEM_AVATARS.slice(0, 8).map(av => (
                  <button key={av} onClick={() => { setAvatar(av); setShowAvatarPicker(false); }} className="size-16 rounded-2xl overflow-hidden border-2 border-slate-50 hover:border-[#eab308] transition-all">
                    <img src={av} className="w-full h-full object-cover" />
                  </button>
                ))}
                <label className="size-16 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                  <Plus size={20} />
                  <span className="text-[10px] font-bold mt-1">上传</span>
                  <input type="file" className="hidden" accept="image/*" />
                </label>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
