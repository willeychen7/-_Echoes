import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, X, Heart, Link, Users, Landmark, Home, UserCircle2, PawPrint, AlertCircle, ArrowLeft, UserPlus, Copy, Camera } from "lucide-react";
import { Button } from "./components/Button";
import { motion, AnimatePresence } from "motion/react";
import { deduceRole, RELATIONSHIP_OPTIONS } from "./lib/relationships";
import { ImageCropper } from "./components/ImageCropper";
import { getRelativeTime, cn } from "./lib/utils";
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
  const [members, setMembers] = useState<any[]>([]);
  const [parentId, setParentId] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1); // 1-4步阶梯式引导
  const [generation, setGeneration] = useState<'elder' | 'peer' | 'junior' | null>(null); // 代际
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
      const check = validateKinshipLogic(lineageSide, connectorNode, relText, targetSurname, mySurname);
      setCorrectionNotice(check.warning || null);
      setCorrectionType(check.type);
      setLogicTag(check.tag || null);
    } else {
      setCorrectionNotice(null);
    }
  }, [relationship, customRelationship, lineageSide, connectorNode, mySurname, targetSurname]);

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
    if (!name || (!relationship && !customRelationship)) return;

    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    const familyId = currentUser?.familyId || null;
    const createdByMemberId = currentUser?.memberId;

    // 1. 获取基础称谓
    let baseRelationship = (relationship === "其他" ? customRelationship : relationship) || "";

    // 2. 【逻辑纠偏核心】根据方位和路径强制修名称 (处理用户可能在 Step 3 选错的情况)
    let relationshipToStore = baseRelationship;
    if (lineageSide === 'paternal') {
      if (connectorNode === 'sibling') {
        relationshipToStore = baseRelationship.replace(/[表堂]/g, ''); // 亲兄弟不带表/堂
      } else if (connectorNode === 'self_p' || connectorNode === 'father') {
        if (!relationshipToStore.includes('堂') && !relationshipToStore.includes('亲')) {
          // 自动补全“堂”字，并移除可能的“表”字
          relationshipToStore = '堂' + relationshipToStore.replace('表', '');
        }
      }
    } else if (lineageSide === 'maternal') {
      if (connectorNode === 'self_m' || connectorNode === 'm_grandfather' || connectorNode === 'mother') {
        if (!relationshipToStore.includes('表') && !/舅|姨/.test(relationshipToStore)) {
          // 自动补全“表”字，并移除可能的“堂”字
          relationshipToStore = '表' + relationshipToStore.replace('堂', '');
        }
      }
    }

    // 3. 注入排行前缀
    if (selectedRank && selectedRank !== '无' && !relationshipToStore.startsWith(selectedRank)) {
      relationshipToStore = `${selectedRank}${relationshipToStore}`;
    }

    const side = lineageSide || 'paternal';
    const computedTargetSurname = targetSurname || name.trim().charAt(0);
    const myGen = currentUser?.generationNum ?? 30;

    // 4. 代际自动推导逻辑
    let targetGen = myGen;
    if (connectorNode === 'father' || connectorNode === 'mother') targetGen = myGen - 1;
    else if (['grandfather', 'grandmother', 'm_grandfather', 'm_grandmother'].includes(connectorNode!)) targetGen = myGen - 2;
    else if (['child_p', 'child_m'].includes(connectorNode!)) targetGen = myGen + 1;
    else targetGen = myGen; // sibling, self_p, self_m

    // 5. 母系同姓标记
    if (side === 'maternal' && mySurname && computedTargetSurname && mySurname === computedTargetSurname) {
      if (!relationshipToStore.includes('(母家同姓)')) {
        relationshipToStore = `${relationshipToStore}(母家同姓)`;
      }
    }

    const currentLogicTag = logicTag || getLogicTag(side as any, connectorNode as string, selectedRank || '', mySurname !== "" && computedTargetSurname !== "" && mySurname === computedTargetSurname);

    const deducedRole = deduceRole(baseRelationship);
    setIsSubmitting(true);
    let currentParentId = parentId;

    // 严谨：如果启用了虚拟父辈创建 (即没有在现有列表中选到父辈)
    if ((isCreatingVirtualParent || (safetyStep === 'ask' && !parentId)) && !currentParentId) {
      try {
        const isMaternalSide = lineageSide === 'maternal';
        let baseRel = isMaternalSide ? "姨/舅" : "伯/叔";
        if (kinshipType === 'affinal') baseRel = isMaternalSide ? "表外祖/姻亲长辈" : "族亲长辈";

        // 组合具体的虚拟父辈名称
        let finalVirtualName = virtualParentName.trim() || `${name}的父辈`;
        if (kinshipType === 'blood' && connectingRank && connectingRank !== '无') {
          // 如果是血亲且指明了排行，自动修正名字为温情的称谓
          if (isMaternalSide) {
            finalVirtualName = relationship.includes("舅") ? `${connectingRank}舅` : `${connectingRank}姨`;
          } else {
            finalVirtualName = (connectingRank === "大" || connectingRank === "一") ? "大伯" : `${connectingRank}叔`;
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
            // 房头锚定：如果指明了排行，则直接确定房头
            ancestralHall: connectingRank && connectingRank !== '无'
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
          standardRole: deducedRole,
          gender,
          memberType,
          fatherId: currentParentId,
          originSide: side,
          origin_side: side,
          surname: computedTargetSurname,
          generationNum: targetGen,
          generation_num: targetGen,
          ancestralHall: (connectingRank && connectingRank !== '无' ? `${connectingRank}房` : (parent?.ancestralHall || null)),
          logicTag: currentLogicTag
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
          standardRole: deducedRole,
          createdByMemberId: currentUser?.memberId,
          gender,
          memberType,
          fatherId: currentParentId,
          originSide: side,
          origin_side: side,
          surname: computedTargetSurname,
          generationNum: targetGen,
          generation_num: targetGen,
          ancestralHall: (connectingRank && connectingRank !== '无' ? `${connectingRank}房` : (parent?.ancestralHall || null)),
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
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className={`flex-1 h-2 rounded-full mx-1 ${wizardStep >= step ? 'bg-[#eab308]' : 'bg-slate-200'}`} />
          ))}
        </div>

        {wizardStep === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">基础信息录入</h2>
              <p className="text-slate-500 italic text-lg">第1步：建立档案基础配置</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">成员姓名</label>
                <input
                  type="text"
                  className="w-full h-16 px-6 rounded-2xl border-none bg-white shadow-md text-xl font-bold focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                  placeholder="请输入家人的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">性别</label>
                <div className="flex gap-4">
                  {['male', 'female'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g as 'male' | 'female')}
                      className={cn(
                        "flex-1 h-16 rounded-2xl font-bold text-lg transition-all border-2",
                        gender === g
                          ? "bg-[#eab308] border-[#eab308] text-black shadow-lg shadow-[#eab308]/20 scale-[1.02]"
                          : "bg-white border-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {g === 'male' ? "男 (♂)" : "女 (♀)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">成员类型</label>
                <div className="flex gap-4">
                  {['human', 'pet'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMemberType(t as 'human' | 'pet')}
                      className={cn(
                        "flex-1 h-16 rounded-2xl font-bold transition-all border-2 flex items-center justify-center gap-2",
                        memberType === t
                          ? "bg-slate-800 border-slate-800 text-white shadow-xl scale-[1.02]"
                          : "bg-white border-slate-50 text-slate-400 hover:border-slate-200 shadow-sm"
                      )}
                    >
                      {t === 'human' ? <><UserCircle2 size={20} />人类</> : <><PawPrint size={20} />宠物</>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button size="lg" className="w-full h-14 text-lg font-bold bg-[#eab308] text-black hover:bg-[#d9a306]" onClick={() => {
              if (!name) { alert("请填写姓名"); return; }
              setWizardStep(2);
            }}>下一步：选择代际归属</Button>
          </motion.div>
        )}

        {wizardStep === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">代际与衔接点</h2>
              <p className="text-slate-500 italic text-lg">第2步：确定该亲属所属的家族分支</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">方位选择 (父族/母族)</label>
                <div className="flex gap-4">
                  <button onClick={() => setLineageSide('paternal')} className={`flex-1 h-16 rounded-2xl font-bold transition-all border-2 ${lineageSide === 'paternal' ? 'bg-[#eab308] border-[#eab308] text-black shadow-lg scale-[1.02]' : 'bg-white border-slate-100 text-slate-500'}`}>父系宗亲</button>
                  <button onClick={() => setLineageSide('maternal')} className={`flex-1 h-16 rounded-2xl font-bold transition-all border-2 ${lineageSide === 'maternal' ? 'bg-[#eab308] border-[#eab308] text-black shadow-lg scale-[1.02]' : 'bg-white border-slate-100 text-slate-500'}`}>母系外戚</button>
                </div>
              </div>

              {lineageSide && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                  <label className="text-xl font-black px-1 block">主要衔接点分支</label>
                  <div className="grid grid-cols-1 gap-3">
                    {lineageSide === 'paternal' ? (
                      <>
                        <button onClick={() => setConnectorNode('father')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'father' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>父亲本人的手足分支 (叔伯/姑)</button>
                        <button onClick={() => setConnectorNode('grandfather')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'grandfather' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>爷爷的分支 (伯公/叔公/姑婆及远堂系)</button>
                        <button onClick={() => setConnectorNode('grandmother')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'grandmother' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>奶奶的分支 (父系里的母族：舅公/姨婆/堂舅)</button>
                        <button onClick={() => setConnectorNode('sibling')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'sibling' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>亲兄弟姐妹 (同父同母/同脉)</button>
                        <button onClick={() => setConnectorNode('self_p')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'self_p' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>同宗平辈 (堂兄弟姐妹/同房亲)</button>
                        <button onClick={() => setConnectorNode('child_p')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'child_p' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>子孙晚辈 (儿女/亲侄/孙辈)</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConnectorNode('mother')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'mother' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>母亲本人的手足分支 (舅舅/姨妈)</button>
                        <button onClick={() => setConnectorNode('m_grandfather')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'm_grandfather' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>外公的分支 (老表系、外舅公)</button>
                        <button onClick={() => setConnectorNode('m_grandmother')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'm_grandmother' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>外婆的分支 (老表系、姨姥等)</button>
                        <button onClick={() => setConnectorNode('sibling')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'sibling' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>亲兄弟姐妹 (同父同母/同脉)</button>
                        <button onClick={() => setConnectorNode('self_m')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'self_m' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>母系平辈 (姑/舅/姨表兄弟姐妹)</button>
                        <button onClick={() => setConnectorNode('child_m')} className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${connectorNode === 'child_m' ? 'border-[#eab308] bg-yellow-50' : 'border-slate-100 bg-white'}`}>外戚晚辈 (外甥/外孙辈)</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold" onClick={() => setWizardStep(1)}>上一步</Button>
              <Button className="flex-1 h-14 bg-[#eab308] text-black hover:bg-[#d9a306] font-bold" onClick={() => {
                if (!lineageSide || !connectorNode) { alert("请选择方位和分支"); return; }
                setWizardStep(3);
              }}>下一步：确认称谓明细</Button>
            </div>
          </motion.div>
        )}

        {wizardStep === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">称谓与逻辑守卫</h2>
              <p className="text-slate-500 italic text-lg">第3步：根据传统宗法智能实时校验</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">您如何称呼TA？</label>
                <div className="grid grid-cols-3 gap-2">
                  {(CONNECTOR_SUGGESTIONS[connectorNode as string] || ["其他"]).concat(CONNECTOR_SUGGESTIONS[connectorNode as string]?.includes("其他") ? [] : ["其他"]).map(rel => (
                    <button key={rel} onClick={() => { setRelationship(rel); if (rel !== '其他') setCustomRelationship(""); }} className={`h-12 border-2 rounded-xl font-bold text-sm ${relationship === rel ? 'bg-[#eab308] border-[#eab308]' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

              {relationship === '其他' && (
                <div className="space-y-3">
                  <input type="text" placeholder="请输入具体称谓 (如: 表姨, 堂叔)" className="w-full h-14 px-5 rounded-xl border-none shadow-inner bg-white font-bold text-lg" value={customRelationship} onChange={e => setCustomRelationship(e.target.value)} />
                </div>
              )}

              {/* 逻辑反馈区 / 实时校验看板 */}
              <AnimatePresence>
                {correctionNotice && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`p-4 rounded-2xl border-2 flex items-start gap-3 shadow-sm ${correctionType === 'error' ? 'bg-rose-50 border-rose-200' : correctionType === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <AlertCircle className={`size-6 mt-0.5 flex-shrink-0 ${correctionType === 'error' ? 'text-rose-500' : correctionType === 'warning' ? 'text-amber-500' : 'text-green-500'}`} />
                    <p className={`text-sm font-bold leading-relaxed ${correctionType === 'error' ? 'text-rose-700' : correctionType === 'warning' ? 'text-amber-700' : 'text-green-700'}`}>
                      {correctionNotice}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {connectorNode === 'grandfather' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <p className="text-sm font-bold text-slate-600">由于选择了爷爷分支，系统启动姓氏智能辅助：</p>
                  <div className="flex gap-4">
                    <div className="flex-1"><label className="text-xs font-bold text-slate-400">您的姓氏</label><input type="text" value={mySurname} onChange={(e) => setMySurname(e.target.value)} className="w-full h-10 px-3 rounded-lg border-none shadow-sm" /></div>
                    <div className="flex-1"><label className="text-xs font-bold text-slate-400">家属姓氏</label><input type="text" value={targetSurname} onChange={(e) => setTargetSurname(e.target.value)} className="w-full h-10 px-3 rounded-lg border-none shadow-sm" /></div>
                  </div>
                </div>
              )}

            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold" onClick={() => setWizardStep(2)}>上一步</Button>
              <Button disabled={correctionType === 'error'} className="flex-1 h-14 bg-[#eab308] text-black hover:bg-[#d9a306] font-bold disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => {
                const relText = relationship === '其他' ? customRelationship : relationship;
                if (!relText) { alert("请录入称谓"); return; }
                setWizardStep(4);
              }}>下一步：确认房分排行</Button>
            </div>
          </motion.div>
        )}

        {wizardStep === 4 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">互称与核准提交</h2>
              <p className="text-slate-500 italic text-lg">第4步：明确排行及关系互认</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xl font-black px-1 block">TA在自家兄弟姐妹中排行极老？</label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {['大', '一', '二', '三', '四', '五', '小', '无'].map(rk => (
                    <button key={rk} onClick={() => setSelectedRank(rk)} className={`h-12 border-2 rounded-xl font-bold text-sm ${selectedRank === rk ? 'bg-[#eab308] border-[#eab308]' : 'bg-white border-slate-100'}`}>{rk}</button>
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-400 px-1 mt-2">选填项，录入后系统会自动生成对应的‘房分’ (如：大房、二房)。注：“大”通常指嫡长，“一”指通用排行。</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-start gap-4">
                <Users className="size-8 text-indigo-400 flex-shrink-0" />
                <div>
                  <h4 className="font-black text-indigo-800 text-sm tracking-widest mb-1">互称与血脉追踪定位</h4>
                  <div className="flex items-center gap-2 mb-3 mt-1 bg-white/50 px-3 py-1.5 rounded-lg border border-indigo-100/50">
                    <span className="text-xs font-black text-indigo-600">血脉航线：</span>
                    <span className="text-[10px] text-indigo-500/80 font-bold bg-white px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                      {lineageSide === 'paternal' ? '父系宗亲左排' : '母系外家右排'}
                      <ChevronRight size={10} className="inline opacity-50" />
                      {connectorNode === 'father' ? '手足兄弟连'
                        : connectorNode === 'grandfather' ? '爷爷支脉'
                          : connectorNode === 'grandmother' ? '奶奶的外戚'
                            : connectorNode === 'mother' ? '母亲的娘家'
                              : connectorNode === 'm_grandfather' ? '外公大树'
                                : connectorNode === 'm_grandmother' ? '外婆连脉'
                                  : connectorNode === 'self_p' || connectorNode === 'self_m' ? '同宗同代'
                                    : '子路晚辈'}
                      {selectedRank && selectedRank !== '无' && (
                        <>
                          <ChevronRight size={10} className="inline opacity-50" />
                          {selectedRank}房
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-indigo-900 font-bold text-base md:text-lg mb-2 flex items-center flex-wrap gap-2">
                    TA 将称呼您为：
                    <motion.span
                      key={relationship + lineageSide}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "text-2xl mx-1 bg-white px-3 py-0.5 rounded-lg shadow-sm border font-black",
                        lineageSide === 'maternal' ? "text-purple-600 border-purple-100" : "text-[#eab308] border-amber-100"
                      )}
                    >
                      {getReverseKinship(relationship === '其他' ? customRelationship : relationship, lineageSide as 'paternal' | 'maternal', connectorNode as string, gender)}
                    </motion.span>
                  </p>
                  <p className="text-xs text-indigo-400/80 font-mono font-bold uppercase border-t border-indigo-100/50 pt-2 mt-2 flex items-center gap-2">
                    <span className="size-1.5 bg-indigo-400 rounded-full animate-pulse" />
                    Logic_Coordinate: {logicTag || getLogicTag(lineageSide as 'paternal' | 'maternal', connectorNode as string, selectedRank || '', mySurname !== "" && targetSurname !== "" && mySurname === targetSurname)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 font-bold" onClick={() => setWizardStep(3)}>上一步</Button>
              <Button disabled={isSubmitting} className="flex-1 h-14 bg-black text-[#eab308] hover:bg-slate-800 font-bold" onClick={handleAdd}>建立专属档案</Button>
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
};
