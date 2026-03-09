import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, X, Heart, Link, Users, Landmark, Home, UserCircle2, PawPrint, AlertCircle, ArrowLeft, UserPlus, Copy, Camera } from "lucide-react";
import { Button } from "./components/Button";
import { motion, AnimatePresence } from "motion/react";
import { deduceRole, RELATIONSHIP_OPTIONS, isFemale } from "./lib/relationships";
import { ImageCropper } from "./components/ImageCropper";
import { getRelativeTime, cn, normalizeGender } from "./lib/utils";
import { isDemoMode } from "./demo-data";
import { DEFAULT_AVATAR, SYSTEM_AVATARS } from "./constants";
import { getLogicTag, validateKinshipLogic, getReverseKinship, CONNECTOR_SUGGESTIONS } from "./lib/kinshipEngine";

export const AddMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [meGender, setMeGender] = useState<'male' | 'female'>('male');
  const [members, setMembers] = useState<any[]>([]);
  const [parentId, setParentId] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1); // 1-6步引导
  const [generation, setGeneration] = useState<'ancestor' | 'elder' | 'peer' | 'junior' | null>(null); // 代际
  const [lineageSide, setLineageSide] = useState<'paternal' | 'maternal' | null>(null); // 方位
  const [connectorNode, setConnectorNode] = useState<string | null>(null); // 衔接点
  const [mySurname, setMySurname] = useState("");
  const [targetSurname, setTargetSurname] = useState("");
  const [logicTag, setLogicTag] = useState<string | null>(null);

  const [safetyStep, setSafetyStep] = useState<'none' | 'ask'>('none');
  const [safetyStage, setSafetyStage] = useState<1 | 2 | 3 | 4>(1);
  const [kinshipType, setKinshipType] = useState<'blood' | 'affinal' | 'social' | null>(null);
  const [safetyChoice, setSafetyChoice] = useState<'real' | 'clan' | null>(null);
  const [connectingRank, setConnectingRank] = useState<string | null>(null);
  const [isCreatingVirtualParent, setIsCreatingVirtualParent] = useState(false);
  const [virtualParentName, setVirtualParentName] = useState("");
  const [memberType, setMemberType] = useState<'human' | 'pet'>('human');
  const [showBranchAsk, setShowBranchAsk] = useState(false);
  const [branchMode, setBranchMode] = useState<'lineage' | 'closeness' | 'nature' | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [branchStage, setBranchStage] = useState<'type' | 'rank'>('type');
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);
  const [correctionType, setCorrectionType] = useState<'error' | 'warning' | 'success'>('error');
  const [myRank, setMyRank] = useState<string | null>(null);


  // 全面涵盖：孙辈、旁系、长辈、以及平辈的潜在歧义词
  const AMBIGUOUS_RELATIONS = [
    "外甥", "侄", "孙", "辈",      // 孙辈/后辈
    "哥", "姐", "弟", "妹",         // 平辈 (堂/表/亲)
    "叔", "伯", "姑", "舅", "姨"    // 长辈 (血路/姻路)
  ];

  // 预定义的建议列表 (用于下拉选择)
  const RELATIONSHIP_SUGGESTIONS = React.useMemo(() => {
    const bases = RELATIONSHIP_OPTIONS.map(opt => opt.label);
    const ranks = ["大", "二", "三", "四", "五", "小", "幺"];
    const rankables = ["哥", "弟", "姐", "妹", "叔", "伯", "姑", "舅", "姨", "侄", "甥", "孙", "侄子", "侄女", "外甥", "外甥女", "孙子", "孙女"];
    const cousinPrefixes = ["堂", "表"];

    let expanded: string[] = [...bases];

    // 1. 添加堂/表基础前缀 (覆盖长、平、晚三代)
    ["哥", "弟", "姐", "妹", "叔", "伯", "姑", "舅", "姨", "侄", "甥", "孙"].forEach(s => {
      cousinPrefixes.forEach(p => {
        expanded.push(`${p}${s}`);
        if (s === "侄") expanded.push(`${p}侄子`, `${p}侄女`);
        if (s === "甥") expanded.push(`${p}外甥`, `${p}外甥女`);
        if (s === "孙") expanded.push(`${p}孙子`, `${p}孙女`);
      });
    });

    // 2. 添加排行前缀 (常规)
    rankables.forEach(r => {
      ranks.forEach(prefix => {
        expanded.push(`${prefix}${r}`);
      });
    });

    // 3. 深度组合：堂/表 + 排行 + 重点称谓
    ["哥", "弟", "姐", "妹", "叔", "伯", "姑", "舅", "姨", "侄", "甥", "孙"].forEach(s => {
      cousinPrefixes.forEach(p => {
        ranks.forEach(rk => {
          expanded.push(`${p}${rk}${s}`);
        });
      });
    });

    return Array.from(new Set(expanded));
  }, []);

  React.useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;

    // 初始化我的姓氏
    if (currentUser?.surname) {
      setMySurname(currentUser.surname);
    } else if (currentUser?.name) {
      setMySurname(currentUser.name.trim().charAt(0));
    }

    if (isDemoMode(currentUser)) {
      const demoMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
      setMembers([...demoMembers]);
    } else if (currentUser?.familyId) {
      fetch(`/api/family-members?familyId=${currentUser.familyId}`)
        .then(res => res.json())
        .then(data => Array.isArray(data) && setMembers(data))
        .catch(console.error);
    }
  }, []);

  React.useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    const me = members.find(m =>
      (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId)) ||
      (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id))
    );
    if (me && (me.logicTag || me.logic_tag) && !myRank) {
      const tag = String(me.logicTag || me.logic_tag);
      const match = tag.match(/-o(大|二|三|四|五|六|七|八|九|十|小)/);
      if (match) setMyRank(match[1]);
    }
    if (me?.gender) {
      setMeGender(normalizeGender(me.gender) || 'male');
    }
  }, [members, myRank]);

  const meNode = React.useMemo(() => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    return members.find(m =>
      (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId)) ||
      (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id))
    );
  }, [members]);

  const candidateParents = React.useMemo(() => {
    const rel = relationship === "其他" ? customRelationship : relationship;
    if (!rel || members.length === 0) return [];
    const role = deduceRole(rel);

    // 基于三步走向导的精准过滤
    if (kinshipType === 'blood' || kinshipType === 'affinal') {
      if (connectorNode === 'sibling') {
        const savedUser = localStorage.getItem("currentUser");
        const currentUser = savedUser ? JSON.parse(savedUser) : null;
        const me = members.find(m => Number(m.id) === Number(currentUser?.memberId));
        if (me?.fatherId) {
          return members.filter(m => Number(m.id) === Number(me.fatherId));
        }
        return members.filter(m => m.standardRole === "father" || (m.relationship || "").includes("爸"));
      }

      if (lineageSide === 'paternal') {
        // 父族：衔接人通常是我的亲爷爷 (或者说是父辈的父亲)
        const savedUser = localStorage.getItem("currentUser");
        const currentUser = savedUser ? JSON.parse(savedUser) : null;
        const me = members.find(m => Number(m.id) === Number(currentUser?.memberId));
        const myFather = members.find(m => Number(m.id) === Number(me?.fatherId));
        if (myFather?.fatherId) {
          return members.filter(m => Number(m.id) === Number(myFather.fatherId));
        }
        return members.filter(m => m.standardRole === "grandfather_paternal" || m.relationship === "爷爷");
      } else if (lineageSide === 'maternal') {
        // 母族：衔接人通常是我的亲外公
        return members.filter(m => m.standardRole === "grandfather_maternal" || m.relationship === "外公" || m.relationship === "姥爷");
      }
    }

    // 默认回退逻辑
    if (["uncle_paternal", "aunt_paternal", "father"].includes(role)) {
      return members.filter(m => m.standardRole?.includes("grandfather_paternal") || (m.relationship || "").includes("爷"));
    }
    if (["brother", "sister"].includes(role)) {
      return members.filter(m => m.standardRole === "father" || (m.relationship || "").includes("爸"));
    }
    if (["uncle_maternal", "aunt_maternal", "mother"].includes(role)) {
      return members.filter(m => m.standardRole?.includes("grandfather_maternal") || (m.relationship || "").includes("外公"));
    }
    if (role === "cousin" || rel.includes("堂") || rel.includes("表")) {
      return members.filter(m => ["uncle_paternal", "aunt_paternal", "uncle_maternal", "aunt_maternal"].includes(m.standardRole || ""));
    }
    return [];
  }, [relationship, customRelationship, members, kinshipType, lineageSide]);


  // 实时逻辑校准与“教学提示”
  React.useEffect(() => {
    const relText = (relationship === "其他" ? customRelationship : relationship) || "";
    if (lineageSide && connectorNode) {
      const check = validateKinshipLogic(lineageSide, connectorNode, relText, gender, targetSurname, mySurname);
      setCorrectionNotice(check.warning || null);
      setCorrectionType(check.type);
      setLogicTag(check.tag || null);
    } else {
      setCorrectionNotice(null);
    }
  }, [relationship, customRelationship, lineageSide, connectorNode, mySurname, targetSurname, gender]);

  // 宗法防错守卫：阻断错误的选择并触发教学提示
  const handleKinshipTypeSelect = (type: 'blood' | 'affinal' | 'social') => {
    const relText = (relationship === "其他" ? customRelationship : (RELATIONSHIP_OPTIONS.find(o => o.value === relationship)?.label || relationship)) || "";

    // 明确的血亲词缀（排除带有姻亲特征的：夫、嫂、媳、母、妈、婆、婶、父、爹）
    const isStrictBlood = ["哥", "弟", "姐", "妹", "叔", "伯", "姑", "舅", "姨", "儿子", "女儿", "孙", "侄", "外甥", "公", "爷", "奶", "婆"].some(k => relText.includes(k))
      && !["夫", "嫂", "媳", "母", "妈", "婶", "父", "爹", "妗", "老公", "老婆"].some(k => relText.includes(k));

    // 强拦截 1：明显的血亲，不能选姻亲或社交
    if (isStrictBlood && type !== 'blood') {
      setCorrectionNotice(`礼法防错：“${relText}”属于您的同胞/同脉血亲，不可选择“${type === 'social' ? '社会好友' : '姻亲眷属'}”。`);
      return;
    }

    // 堂/表亲的宽泛拦截 (应对未被 isStrictBlood 覆盖的情况)
    if (["堂", "表"].some(k => relText.includes(k)) && type === 'social') {
      setCorrectionNotice(`礼法防错：“${relText}”属于您的宗族/外家至亲，不可选择“社会好友”。`);
      return;
    }

    setCorrectionNotice(null);
    setKinshipType(type);
    if (type === 'social') {
      setSafetyStep('none');
    } else {
      setSafetyStage(3);
    }
  };

  const handleLineageSideSelect = (side: 'paternal' | 'maternal') => {
    const relText = (relationship === "其他" ? customRelationship : (RELATIONSHIP_OPTIONS.find(o => o.value === relationship)?.label || relationship)) || "";

    // 父族专属
    if (["堂", "叔", "伯", "姑", "婶", "侄"].some(k => relText.includes(k)) && !["表", "外"].some(k => relText.includes(k)) && side !== 'paternal') {
      setCorrectionNotice(`礼法防错：“${relText}”属于父族宗亲一脉，不可选母系外戚。`);
      return;
    }
    // 母族专属
    if (["舅", "姨", "妗", "姥", "外孙", "外甥"].some(k => relText.includes(k)) && side !== 'maternal') {
      setCorrectionNotice(`礼法防错：“${relText}”属于母系外戚一脉，不可选父族宗亲。`);
      return;
    }

    setCorrectionNotice(null);
    setLineageSide(side);
    setSafetyStage(4);
    setSafetyChoice('real');
  };

  // 自动化：当需要创建虚拟父辈时，预填一个温情的名称
  React.useEffect(() => {
    if (safetyChoice === 'clan' && candidateParents.length === 0 && !virtualParentName && name) {
      setVirtualParentName(`${name}的父亲`);
      setIsCreatingVirtualParent(true);
    }
  }, [safetyChoice, candidateParents.length, name, virtualParentName]);

  React.useLayoutEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [inviteCode]);

  const displayRelationships = React.useMemo(() => {
    return ["父亲", "母亲", "儿子", "女儿", "其他"];
  }, []);

  const defaultAvatars = SYSTEM_AVATARS;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setShowCropper(true);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      alert("请输入姓名");
      return;
    }
    if (!name || (connectorNode !== 'sibling' && !relationship && !customRelationship)) return;

    // --- 🚀 礼法防火墙：最终提交拦截 ---
    const relTextRaw = (relationship === "其他" ? customRelationship : relationship) || "";
    if (lineageSide && connectorNode) {
      const check = validateKinshipLogic(lineageSide, connectorNode, relTextRaw, gender, targetSurname, mySurname);
      if (!check.isValid && check.type === 'error') {
        alert(check.warning || "礼法冲突：输入的称谓与逻辑不符，请修正后再提交。");
        return;
      }
    }

    setIsSubmitting(true);

    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    const familyId = currentUser?.familyId || null;
    const createdByMemberId = currentUser?.memberId;

    // 🚀 核心：排重检查
    const relationshipToStoreRaw = (relationship === "其他" ? customRelationship : relationship) || "";

    // 🚀 核心校验：堂/表亲必须写明房分 (代际链路约束)
    if (['self_p', 'self_m'].includes(connectorNode!) || relationshipToStoreRaw.includes("堂") || relationshipToStoreRaw.includes("表")) {
      if (!connectingRank || connectingRank === '不知道') {
        alert(`⚠️ 请填写 ${name} 父辈的排行。对于堂/表亲，系统必须明确 TA 属于哪一房 (如：大房、二房)，否则无法生成准确的家族树。`);
        return;
      }
    }

    const isDuplicate = members.some(m =>
      m.name === name.trim() &&
      (m.relationship === relationshipToStoreRaw || (m.logic_tag || m.logicTag || "").includes(connectorNode || ""))
    );
    if (isDuplicate) {
      alert("⚠️ 该人物关系或姓名在家族中已存在，请勿重复添加。");
      return;
    }

    // 💡 核心：全量名分修正引擎 (Logic-First Correction) V9.0 兼容版
    const baseRel = (relationship === "其他" ? customRelationship : relationship) || "";
    let finalRel = baseRel;
    const side = lineageSide || 'paternal';

    // 1. 物理路径驱动的智能名分修正
    if (connectorNode === 'sibling') {
      // 【亲兄弟姐妹】绝对禁止表/堂
      finalRel = baseRel.replace(/[表堂]/g, '');
      if (!/[\u4e00-\u9fa5]/.test(finalRel)) finalRel = gender === 'female' ? '姐姐/妹妹' : '哥哥/弟弟';
    } else if (side === 'paternal' || connectorNode?.endsWith('_p') || connectorNode === 'father' || connectorNode === 'grandfather') {
      // 【父系/宗亲分支】强制“堂”，剔除“表” (除非是姑表、姨表在特殊路径下，但通常优先保证堂哥正确)
      if (baseRel.includes('堂') || connectorNode === 'self_p') {
        finalRel = baseRel.replace('表', '堂');
        if (!finalRel.includes('堂') && (baseRel.includes('哥') || baseRel.includes('弟') || baseRel.includes('姐') || baseRel.includes('妹'))) {
          finalRel = '堂' + finalRel;
        }
      }
    } else if (side === 'maternal' || connectorNode?.endsWith('_m') || connectorNode === 'mother' || connectorNode === 'm_grandfather') {
      // 【母系分支】强制使用“表”系，屏蔽“堂”
      finalRel = baseRel.replace('堂', '表');
      if (connectorNode === 'self_m' && !finalRel.includes('表')) finalRel = '表' + finalRel;
    }

    // 2. 处理最后录入排行的问题 (排行补偿)
    if (selectedRank && selectedRank !== '不知道' && !finalRel.startsWith(selectedRank)) {
      // ⚡️ 核心修复：先去掉可能存在的所有旧排行前缀，再补上最新的
      const cleanRel = finalRel.replace(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老)/, '');
      finalRel = `${selectedRank}${cleanRel}`;
    }

    // 3. 判定同姓逻辑（用于同姓外戚打标）
    const computedTargetSurname = targetSurname || name.trim().charAt(0);
    const isSameSurname = mySurname !== "" && computedTargetSurname !== "" && mySurname === computedTargetSurname;
    if (side === 'maternal' && isSameSurname) {
      if (!finalRel.includes('(母家同姓)')) finalRel += '(母家同姓)';
    }

    const relationshipToStore = finalRel;

    // 4. 角色与方位锁定：防止推导干扰
    let finalRole = deduceRole(relationshipToStore);
    if (connectorNode === 'sibling') {
      finalRole = gender === 'female' ? 'sister' : 'brother';
    }

    const currentLogicTag = getLogicTag(
      side as 'paternal' | 'maternal',
      connectorNode as string,
      selectedRank || '',
      isSameSurname
    );

    const myGen = currentUser?.generationNum ?? 30;
    const rel = (relationship === '其他' ? customRelationship : relationship) || "";
    let targetGen = myGen;

    if (connectorNode === 'father' || connectorNode === 'mother') targetGen = myGen - 1;
    else if (['grandfather', 'grandmother', 'm_grandfather', 'm_grandmother'].includes(connectorNode!)) targetGen = myGen - 2;
    else if (['g_grandfather', 'm_g_grandfather'].includes(connectorNode!)) {
      if (rel.includes('高祖') || rel.includes('四')) targetGen = myGen - 5;
      else if (rel.includes('曾') || rel.includes('太') || rel.includes('三')) targetGen = myGen - 3;
      else targetGen = myGen - 2; // fallback
    }
    else if (['child_p', 'child_m'].includes(connectorNode!)) targetGen = myGen + 1;
    else if (connectorNode === 'grandchild_p') {
      if (rel.includes('曾') || rel.includes('曾孙')) targetGen = myGen + 3;
      else if (rel.includes('玄') || rel.includes('耳')) targetGen = myGen + 4;
      else targetGen = myGen + 2;
    }
    else targetGen = myGen;

    setIsSubmitting(true);
    let currentParentId = parentId;

    // 🚀 核心修复：对于亲兄弟姐妹模式，自动尝试获取当前用户的父辈 ID，实现血脉真正的双向绑定
    if (connectorNode === 'sibling' && !currentParentId) {
      const meNode = members.find(m =>
        (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId)) ||
        (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id))
      );
      if (meNode?.fatherId) {
        currentParentId = meNode.fatherId;
      } else if (meNode?.motherId) {
        // 如果没有 fatherId 分支，退而求其次用母系 ID 衔接（虽然逻辑上还是会存入 father_id 字段作为主要 parent）
        currentParentId = meNode.motherId;
      }
    }

    // 虚拟父辈创建逻辑 (保持完整)
    if ((isCreatingVirtualParent || (safetyStep === 'ask' && !parentId)) && !currentParentId) {
      try {
        const isMaternalSide = lineageSide === 'maternal';
        let baseRel = isMaternalSide ? "姨/舅" : "伯/叔";
        if (kinshipType === 'affinal') baseRel = isMaternalSide ? "表外祖/姻亲长辈" : "族亲长辈";
        let finalVirtualName = virtualParentName.trim() || `${name}的父辈`;
        if (kinshipType === 'blood' && connectingRank && connectingRank !== '不知道') {
          if (isMaternalSide) {
            finalVirtualName = relationship.includes("舅") ? `${connectingRank}舅` : `${connectingRank}姨`;
          } else {
            finalVirtualName = (connectingRank === "大") ? "大伯" : `${connectingRank}叔`;
          }
        } else if (kinshipType === 'blood') {
          finalVirtualName = isMaternalSide ? (relationship.includes("舅") ? "舅舅" : "阿姨") : "叔伯";
        }
        const genNum = (currentUser.generationNum || 30) - 1;
        const vResponse = await fetch("/api/family-members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: finalVirtualName,
            relationship: kinshipType === 'blood' ? baseRel : (isMaternalSide ? "表世系" : "宗族旁支"),
            avatarUrl: `https://avatar.vercel.sh/${finalVirtualName}.svg`,
            familyId,
            createdByMemberId,
            memberType: 'virtual',
            is_placeholder: true,
            generationNum: genNum,
            ancestralHall: connectingRank && connectingRank !== '不知道'
              ? `${connectingRank}房`
              : (finalVirtualName.includes("二") ? "二房" : finalVirtualName.includes("大") ? "大房" : null)
          })
        });
        const vData = await vResponse.json();
        if (vData.id) currentParentId = vData.id;
      } catch (err) {
        console.error("Virtual parent creation failed:", err);
      }
    }

    const parent = members.find(m => Number(m.id) === Number(currentParentId));

    const rankMap: Record<string, number> = { '大': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '小': 11 };
    const siblingOrder = selectedRank ? rankMap[selectedRank] : (connectingRank ? rankMap[connectingRank] : null);

    try {
      const response = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relationship: relationshipToStore,
          avatarUrl: avatar || `https://picsum.photos/seed/${name}/200/200`,
          bio: "",
          birthDate,
          familyId,
          createdByMemberId,
          standardRole: finalRole,
          gender,
          memberType,
          fatherId: currentParentId,
          originSide: side,
          origin_side: side,
          surname: computedTargetSurname,
          generationNum: targetGen,
          generation_num: targetGen,
          ancestralHall: (
            parent?.ancestralHall ||
            parent?.ancestral_hall ||
            (connectorNode === 'sibling' ? (currentUser.ancestralHall || currentUser.ancestral_hall) : null) ||
            (connectingRank && connectingRank !== '不知道' ? `${connectingRank}房` : null) ||
            (selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null)
          ),
          logicTag: currentLogicTag,
          siblingOrder: siblingOrder || null,
          kinshipType: kinshipType,
          kinship_type: kinshipType
        })
      });
      const data = await response.json().catch(() => ({}));
      const newId = data.id || Date.now();
      const inviteCodeResponse = data.inviteCode || `INV-${newId}-${createdByMemberId}`;

      if (isDemoMode(currentUser)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        customMembers.push({
          id: newId,
          name,
          relationship: relationshipToStore,
          avatarUrl: avatar || `https://picsum.photos/seed/${name}/200/200`,
          bio: "",
          birthDate,
          isRegistered: false,
          standardRole: finalRole,
          createdByMemberId: currentUser?.memberId,
          gender,
          memberType,
          fatherId: currentParentId,
          originSide: side,
          origin_side: side,
          surname: computedTargetSurname,
          generationNum: targetGen,
          generation_num: targetGen,
          ancestralHall: (
            parent?.ancestralHall ||
            (connectingRank && connectingRank !== '不知道' ? `${connectingRank}房` : null) ||
            (selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null)
          ),
          logicTag: currentLogicTag
        });
        localStorage.setItem("demoCustomMembers", JSON.stringify(customMembers));
      } else if (!data.id) {
        const errMsg = data.error || data.message || "服务器插入失败";
        throw new Error(errMsg);
      }

      setInviteCode(inviteCodeResponse);
      setNewMemberId(newId);
    } catch (error: any) {
      console.error(error);
      alert(`添加失败：${error.message || "系统繁忙，请稍后重试"}`);
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

  if (inviteCode) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-slate-900 font-serif items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={40} />
          </div>

          <h2 className="text-2xl font-bold text-slate-800">家人档案已建立！</h2>
          <p className="text-slate-500">
            您现在可以为 <span className="font-bold text-slate-800">{name}</span> 上传照片、留下语音，开始记录记忆瞬间。
          </p>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-2 mt-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">家人专属邀请码</p>
            <div className="text-4xl font-mono font-bold text-[#eab308] tracking-wider break-all">
              {inviteCode}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              (可选) 如果家人也在使用该小程序，您可以点击下方「复制邀请链接」发送给他们。他们点开链接即可直接注册并与您建立家族关联。
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              size="lg"
              className="w-full rounded-xl font-bold bg-[#eab308] text-black hover:bg-[#d9a306]"
              onClick={() => navigate(`/archive/${newMemberId}`)}
            >
              直接进入TA的记忆档案
            </Button>
            <div className="flex gap-3">
              <button
                onClick={copyCode}
                className="flex-1 py-3 text-[#eab308] font-bold bg-[#eab308]/10 rounded-xl hover:bg-[#eab308]/20 flex items-center justify-center transition-all active:scale-95"
              >
                {copied ? "已复制链接" : "复制邀请链接"}
                {!copied && <Copy size={16} className="ml-1" />}
              </button>
              <button
                onClick={() => navigate("/square#archive")}
                className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                返回列表
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-slate-900 font-serif">
      <header className="flex items-center px-6 py-4 justify-between bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors text-slate-800">
          <ArrowLeft size={28} />
        </button>
        <h1 className="text-xl font-black text-slate-800">添加家族成员</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-md mx-auto w-full space-y-10 relative">
        <div className="flex items-center justify-between mb-8 px-4">
          {[1, 2, 3, 4, 5].map(step => {
            const isFamily = memberType === 'human' && kinshipType === 'blood';
            const maxSteps = isFamily ? 5 : 2;
            if (step > maxSteps) return null;
            return (
              <div key={step} className={`flex-1 h-1.5 rounded-full mx-0.5 ${wizardStep >= (step === 1 ? 1 : step + 1) ? 'bg-[#eab308]' : 'bg-slate-200'} transition-all duration-300`} />
            );
          })}
        </div>

        {/* 第 1 步：大类与代际整合界面 */}
        {wizardStep === 1 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">建立新的档案</h2>
              <p className="text-slate-500 italic text-base">第一步：请选择您与 TA 的关系坐标</p>
            </div>

            <div className="space-y-8">
              {/* 家族血脉分组 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Landmark className="size-4 text-emerald-600" />
                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest">家族至亲 (血脉)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'ancestor', label: '祖辈', sub: '爷爷奶奶/外公外婆...', color: 'bg-emerald-50 text-emerald-700' },
                    { type: 'elder', label: '父辈', sub: '父母/叔伯/舅姨...', color: 'bg-indigo-50 text-indigo-700' },
                    { type: 'peer', label: '平辈', sub: '兄弟姐妹/堂表亲...', color: 'bg-blue-50 text-blue-700' },
                    { type: 'junior', label: '晚辈', sub: '子女/侄甥/孙辈...', color: 'bg-amber-50 text-amber-700' },
                  ].map((gen) => (
                    <button
                      key={gen.type}
                      onClick={() => {
                        setMemberType('human');
                        setKinshipType('blood');
                        setGeneration(gen.type as any);
                        setWizardStep(3); // 直接跳过原 Step 2，进入分支选择
                      }}
                      className={cn(
                        "p-5 rounded-[2rem] border-2 border-transparent text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm",
                        gen.color
                      )}
                    >
                      <h3 className="font-black text-xl mb-1">{gen.label}</h3>
                      <p className="opacity-60 text-[10px] font-bold leading-tight">{gen.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 其他伙伴分组 - 恢复原来的横向横格样式 */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <Heart className="size-4 text-rose-500" />
                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest">其他重要伙伴</span>
                </div>
                {[
                  { type: 'human', kType: 'social', label: '知心好友', sub: '战友、老同学、恩师等', icon: <Users className="size-6" />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
                  { type: 'pet', kType: 'social', label: '忠诚宠物', sub: '陪伴家族成长的毛孩子', icon: <PawPrint className="size-6" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMemberType(item.type as any);
                      setKinshipType(item.kType as any);
                      setWizardStep(2);
                    }}
                    className={cn(
                      "w-full p-6 rounded-[2.5rem] border-2 text-left transition-all hover:scale-[1.02] flex items-center gap-5 shadow-sm active:scale-95",
                      item.color
                    )}
                  >
                    <div className="p-4 bg-white rounded-2xl shadow-sm">{item.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-black text-xl">{item.label}</h3>
                      <p className="opacity-60 text-sm font-medium">{item.sub}</p>
                    </div>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 第 3 步：选择血脉分支与方位 */}
        {wizardStep === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">选择血脉分支</h2>
              <p className="text-slate-500 italic text-base">第 3 步：确定从哪一侧血脉线路衔接</p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
                {generation !== 'peer' && generation !== 'junior' && (
                  <>
                    <button onClick={() => setLineageSide('paternal')} className={cn("flex-1 h-12 rounded-xl font-bold transition-all", lineageSide === 'paternal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400')}>父系一脉</button>
                    <button onClick={() => setLineageSide('maternal')} className={cn("flex-1 h-12 rounded-xl font-bold transition-all", lineageSide === 'maternal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400')}>母系一脉</button>
                  </>
                )}
                {(generation === 'peer' || generation === 'junior') && (
                  <button onClick={() => setLineageSide('paternal')} className={cn("flex-1 h-12 rounded-xl font-bold bg-white text-slate-800 shadow-sm")}>至亲/我所在的支脉</button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {generation === 'ancestor' && lineageSide === 'paternal' && (
                  <>
                    <button onClick={() => { setConnectorNode('grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">爷爷的分支 (从伯公/叔公等)</button>
                    <button onClick={() => { setConnectorNode('g_grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">太爷爷或更高 (曾祖、祖宗系统)</button>
                  </>
                )}
                {generation === 'ancestor' && lineageSide === 'maternal' && (
                  <>
                    <button onClick={() => { setConnectorNode('m_grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">外公家族的分支 (表长辈系)</button>
                    <button onClick={() => { setConnectorNode('m_g_grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">外曾祖或更高</button>
                  </>
                )}
                {generation === 'elder' && lineageSide === 'paternal' && (
                  <>
                    <button onClick={() => { setConnectorNode('father'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">父亲的手足兄弟 (叔伯/姑)</button>
                    <button onClick={() => { setConnectorNode('grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">堂系长辈 (爷爷家族的叔伯/姑辈)</button>
                  </>
                )}
                {generation === 'elder' && lineageSide === 'maternal' && (
                  <>
                    <button onClick={() => { setConnectorNode('mother'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">母亲的手足兄弟 (舅/姨)</button>
                    <button onClick={() => { setConnectorNode('m_grandfather'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">母系堂系长辈</button>
                  </>
                )}
                {generation === 'peer' && (
                  <>
                    <button onClick={() => { setConnectorNode('sibling'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">亲兄弟姐妹 (同父同母)</button>
                    <button onClick={() => { setConnectorNode('self_p'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">堂兄弟姐妹 (父系同宗族)</button>
                    <button onClick={() => { setConnectorNode('self_m'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">表兄弟姐妹 (母亲的外戚)</button>
                  </>
                )}
                {generation === 'junior' && (
                  <>
                    <button onClick={() => { setConnectorNode('child_p'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">下一辈 (子/女/侄儿/外甥)</button>
                    <button onClick={() => { setConnectorNode('grandchild_p'); setWizardStep(4); }} className="p-5 rounded-2xl text-left bg-white border-2 border-slate-100 font-bold hover:border-slate-300 transition-all">下两辈及以后 (孙辈/玄孙辈等)</button>
                  </>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full h-14 font-bold rounded-2xl" onClick={() => setWizardStep(2)}>上一步</Button>
          </motion.div>
        )}

        {/* 第 4 步：称谓选择 */}
        {wizardStep === 4 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">锁定称谓</h2>
              <p className="text-slate-500 italic text-base">第 4 步：确认您在生活中如何称呼 TA</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                {(CONNECTOR_SUGGESTIONS[connectorNode as string] || ["哥哥", "姐姐", "弟弟", "妹妹", "其他"])
                  .concat(["其他"])
                  .filter((rel, i, arr) => arr.indexOf(rel) === i)
                  .map(rel => (
                    <button
                      key={rel}
                      onClick={() => { setRelationship(rel); if (rel !== '其他') setCustomRelationship(""); }}
                      className={`h-12 border-2 rounded-xl font-bold text-sm transition-all ${relationship === rel ? 'bg-black text-[#eab308] border-black scale-105 shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {rel}
                    </button>
                  ))}
              </div>
              {relationship === '其他' && (
                <input
                  type="text"
                  placeholder="请输入具体称谓 (如: 表姨, 堂叔)"
                  className="w-full h-14 px-6 rounded-2xl border-none shadow-md bg-white font-bold text-lg text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                  value={customRelationship}
                  onChange={e => setCustomRelationship(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold rounded-2xl" onClick={() => setWizardStep(3)}>上一步</Button>
              <Button
                className="flex-1 h-14 bg-black text-[#eab308] font-bold rounded-2xl shadow-lg shadow-black/10 transition-all active:scale-95"
                onClick={() => {
                  if (!relationship && !customRelationship) { alert("请确定称谓"); return; }
                  setWizardStep(5);
                }}
              >
                下一步
              </Button>
            </div>
          </motion.div>
        )}

        {/* 第 5 步：排行房分 */}
        {wizardStep === 5 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">确认房分座次</h2>
              <p className="text-slate-500 italic text-base">第 5 步：TA 在自家兄弟姐妹中排行老几？</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-xl font-black px-1 block text-slate-700">选择排行</label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {['大', '二', '三', '四', '五', '六', '七', '八', '九', '十', '小', '不知道'].map(rk => (
                    <button
                      key={rk}
                      onClick={() => setSelectedRank(rk)}
                      className={`h-11 border-2 rounded-xl font-bold text-sm transition-all ${selectedRank === rk ? 'bg-black text-[#eab308] border-black shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {rk}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-bold px-1 italic">
                  💡 系统将据此自动标记房分 (如: 大房、二叔公等)。
                </p>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2.5rem] space-y-3 shadow-inner mt-8">
                <div className="flex items-center gap-2">
                  <div className="size-2 bg-indigo-500 rounded-full animate-pulse" />
                  <h4 className="font-black text-indigo-900 text-[10px] tracking-widest uppercase">互称逻辑预览</h4>
                </div>
                <p className="text-indigo-900 font-bold text-lg leading-relaxed">
                  关系校验成功。TA 会称呼您为：
                  <span className="text-white bg-indigo-600 px-3 py-1 rounded-lg ml-2 shadow-sm whitespace-nowrap">
                    {getReverseKinship(
                      relationship === '其他' ? customRelationship : relationship,
                      lineageSide as 'paternal' | 'maternal',
                      connectorNode as string,
                      meGender,
                      {
                        relationship: relationship === '其他' ? customRelationship : relationship,
                        gender,
                        ancestralHall: selectedRank && selectedRank !== '不知道' ? `${selectedRank}房` : null
                      },
                      meNode,
                      members
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold rounded-2xl" onClick={() => setWizardStep(4)}>上一步</Button>
              <Button
                className="flex-1 h-14 bg-black text-[#eab308] font-bold rounded-2xl shadow-lg shadow-black/20 transition-all active:scale-95"
                onClick={() => setWizardStep(6)}
              >
                下一步填写姓名
              </Button>
            </div>
          </motion.div>
        )}

        {/* 第 6 步：基本信息填入 */}
        {wizardStep === 6 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">最后完善姓名</h2>
              <p className="text-slate-500 italic text-base">第 6 步：为这位家人档案注入生命</p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="size-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="Avatar" /> : <Landmark className="text-slate-300" size={48} />}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-400 px-1 uppercase tracking-widest">称呼或真实姓名</label>
                  <input
                    type="text"
                    className="w-full h-16 px-6 rounded-2xl bg-white shadow-md text-xl font-bold border-none text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                    placeholder="请输入姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-400 px-1 uppercase tracking-widest">确认性别</label>
                  <div className="flex gap-3">
                    {['male', 'female'].map(g => (
                      <button
                        key={g}
                        onClick={() => setGender(g as any)}
                        className={cn(
                          "flex-1 h-16 rounded-2xl font-bold transition-all border-2",
                          gender === g ? "bg-black text-[#eab308] border-black scale-105 shadow-md" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        {g === 'male' ? '男 (♂)' : '女 (♀)'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setAvatar(ev.target?.result as string);
                          setTempImage(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="w-full h-14 bg-slate-50 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all border border-slate-100"
                >
                  <Camera size={20} className="text-[#eab308]" />
                  {avatar ? '更换照片' : '上传照片记录 TA'}
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold rounded-2xl" onClick={() => setWizardStep(5)}>上一步</Button>
              <Button
                disabled={isSubmitting}
                className="flex-1 h-14 bg-black text-[#eab308] hover:bg-slate-800 font-bold rounded-2xl shadow-lg shadow-black/20 transition-all active:scale-95"
                onClick={handleAdd}
              >
                {isSubmitting ? '正在绘制家谱...' : '建立档案并收录'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* 对于好友或宠物的简化流程 */}
        {wizardStep === 2 && (memberType === 'pet' || kinshipType === 'social') && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-slate-800">{memberType === 'pet' ? '伙伴基础信息' : '故友基础信息'}</h2>
              <p className="text-slate-500 italic text-base">只需一步，为 TA 建立永久记忆</p>
            </div>
            <div className="space-y-6">
              <input
                type="text"
                className="w-full h-16 px-6 rounded-2xl bg-white shadow-xl text-xl font-bold border-none text-slate-800"
                placeholder="输入名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex gap-3">
                {['male', 'female'].map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g as any)}
                    className={cn(
                      "flex-1 h-14 rounded-2xl font-bold transition-all border-2",
                      gender === g ? "bg-black text-[#eab308] border-black" : "bg-white border-slate-100 text-slate-400"
                    )}
                  >
                    {g === 'male' ? (memberType === 'human' ? '男' : '公') : (memberType === 'human' ? '女' : '母')}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="w-full h-16 px-6 rounded-2xl bg-white shadow-md text-xl font-bold border-none text-slate-800"
                placeholder={memberType === 'pet' ? "品种 (如: 金毛)" : "描述关系 (如: 战友, 老同学)"}
                value={customRelationship || relationship}
                onChange={(e) => setCustomRelationship(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold rounded-2xl" onClick={() => setWizardStep(1)}>上一步</Button>
              <Button className="flex-1 h-14 bg-black text-[#eab308] font-bold rounded-2xl shadow-lg active:scale-95" onClick={handleAdd}>创建档案</Button>
            </div>
          </motion.div>
        )}
      </main>
    </div >
  );
};
