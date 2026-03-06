import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Copy, Check, Camera, Heart, Link, Users, Landmark, Home, UserCircle2, PawPrint } from "lucide-react";
import { Button } from "./components/Button";
import { motion, AnimatePresence } from "motion/react";
import { deduceRole, RELATIONSHIP_OPTIONS } from "./lib/relationships";
import { ImageCropper } from "./components/ImageCropper";
import { getRelativeTime, cn } from "./lib/utils";
import { isDemoMode } from "./demo-data";
import { DEFAULT_AVATAR, SYSTEM_AVATARS } from "./constants";

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
  const [safetyStep, setSafetyStep] = useState<'none' | 'ask'>('none');
  const [safetyStage, setSafetyStage] = useState<1 | 2 | 3 | 4>(1); // 确认阶段：1.个人排行 2.定性 3.定方位 4.定排行/房分
  const [kinshipType, setKinshipType] = useState<'blood' | 'affinal' | 'social' | null>(null); // 定性：血亲、姻亲、友谊
  const [lineageSide, setLineageSide] = useState<'paternal' | 'maternal' | null>(null); // 方位：父族、母族
  const [safetyChoice, setSafetyChoice] = useState<'real' | 'clan' | null>(null); // 保持兼容
  const [connectingRank, setConnectingRank] = useState<string | null>(null); // 衔接人的排行 (如: 大伯、二叔)
  const [isCreatingVirtualParent, setIsCreatingVirtualParent] = useState(false);
  const [virtualParentName, setVirtualParentName] = useState("");
  const [memberType, setMemberType] = useState<'human' | 'pet'>('human');
  const [showBranchAsk, setShowBranchAsk] = useState(false);
  const [branchMode, setBranchMode] = useState<'lineage' | 'closeness' | 'nature' | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [branchStage, setBranchStage] = useState<'type' | 'rank'>('type');
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

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

  React.useEffect(() => {
    // 关键修正：不仅检查自定义文字，还要检查选中的标准 role 值 (如 cousin)
    const relText = (relationship === "其他" ? customRelationship : (RELATIONSHIP_OPTIONS.find(o => o.value === relationship)?.label || relationship)) || "";
    const isDirectFatherOfSomethingElse = relText.includes("爸") && !["父亲", "爸", "爸爸", "老爸", "亲爸"].includes(relText);
    const ambiguous = ["叔", "伯", "舅", "姨", "堂", "表", "侄", "甥", "孙", "外孙"].some(k => relText.includes(k)) || isDirectFatherOfSomethingElse;

    if (ambiguous) {
      setSafetyStep('ask');
      setSafetyStage(1);
    } else {
      setSafetyStep('none');
      setSafetyStage(1);
      setKinshipType(null);
      setLineageSide(null);
      setSafetyChoice(null);
    }
    // 重置分流与排行状态
    setSelectedBranch(null);
    setSelectedRank(null);
    setConnectingRank(null);
    setBranchStage('type');
  }, [relationship, customRelationship]);

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

    const finalRelationship = (relationship === "其他" ? customRelationship : relationship) || "";
    let resolvedRelationship = finalRelationship;
    let autoInferredBranch = selectedBranch;
    let autoInferredRank = selectedRank;

    // 1. 智能预解析：从输入文字中提取支系与排行 (如输入“堂大哥”，提取“堂”和“大”)
    if (!autoInferredBranch) {
      if (finalRelationship.startsWith("堂")) {
        autoInferredBranch = "堂";
        resolvedRelationship = resolvedRelationship.substring(1);
      } else if (finalRelationship.startsWith("表")) {
        autoInferredBranch = "表";
        resolvedRelationship = resolvedRelationship.substring(1);
      } else if (finalRelationship.startsWith("亲")) {
        autoInferredBranch = "亲生";
        resolvedRelationship = resolvedRelationship.substring(3).startsWith("的手足") ? resolvedRelationship.substring(5) : resolvedRelationship.substring(1);
      }
    }

    // 继续提取排行 (支持更多口语化：排行老三、细妹、幺儿等)
    if (!autoInferredRank) {
      const rankMatch = resolvedRelationship.match(/^(二|三|四|五|六|七|八|九|十|大|小|幺|老|排行老|排行|细|第一|第二|第三)/);
      if (rankMatch) {
        autoInferredRank = rankMatch[0];
        resolvedRelationship = resolvedRelationship.substring(rankMatch[0].length);
      }
    }

    // 2. 逻辑分流判定器 (智能推理：如果已经选择了父母，直接推断血统，不弹出询问)
    if (!autoInferredBranch && parentId) {
      const parent = members.find(m => Number(m.id) === Number(parentId));
      if (parent) {
        const parentRel = (parent.relationship || "").trim();
        const parentRole = parent.standardRole || "";
        const isMyDirectParent = ["父亲", "母亲", "爸", "妈", "爸爸", "妈妈", "老爸", "老妈"].some(k => parentRel.includes(k)) || ["father", "mother"].includes(parentRole);

        if (isMyDirectParent) {
          if (["哥", "姐", "弟", "妹", "兄"].some(k => resolvedRelationship.includes(k))) autoInferredBranch = "亲生";
          if (["甥", "侄", "孙"].some(k => resolvedRelationship.includes(k))) autoInferredBranch = "血亲";
        }
      }
    }

    // 防错校验：如果手动选的分支与已选父母冲突 (如选了亲爹却非说是堂亲)
    if (parentId && selectedBranch) {
      const parent = members.find(m => Number(m.id) === Number(parentId));
      const parentRel = (parent?.relationship || "").trim();
      const parentRole = parent?.standardRole || "";
      const isMyDirectParent = ["父亲", "母亲", "爸", "妈", "爸爸", "妈妈", "老爸", "老妈"].some(k => parentRel.includes(k)) || ["father", "mother"].includes(parentRole);

      if (isMyDirectParent && ["堂", "表", "姻亲", "社会好友"].includes(selectedBranch)) {
        alert(`逻辑矛盾：您选择了“${parent?.name}(${parentRel})”作为其父亲，这意味着TA是您的亲缘手足，不能被标记为“${selectedBranch}”。请重新确认名分归属。`);
        setSelectedBranch(null);
        return;
      }
    }

    if (!autoInferredBranch) {
      if (["外甥", "侄", "孙", "孙辈"].some(k => finalRelationship.includes(k))) {
        setBranchMode('lineage');
        setBranchStage('type');
        setShowBranchAsk(true);
        return;
      }
      if (["哥", "姐", "弟", "妹", "兄"].some(k => finalRelationship.includes(k))) {
        setBranchMode('closeness');
        setBranchStage('type');
        setShowBranchAsk(true);
        return;
      }
      if (["叔", "伯", "姑", "舅", "姨"].some(k => finalRelationship.includes(k))) {
        setBranchMode('nature');
        setBranchStage('type');
        setShowBranchAsk(true);
        return;
      }
    }

    // 3. 深度安全检查 (Wizard Step)：处理向导交互
    if (safetyStep === 'ask' && !parentId) {
      if (!selectedRank) {
        alert("请先完成阶段一：指定该成员在其同辈中的排行");
        return;
      }
      if (!kinshipType) {
        alert("请先确认阶段二：该成员与您的根本关系定性");
        return;
      }
      if (kinshipType !== 'social' && !lineageSide) {
        alert("请先完成阶段三：该亲属所属的宗亲/外戚方位");
        return;
      }
      if (kinshipType !== 'social' && !connectingRank) {
        alert("请先完成阶段四：明确该亲属在家族中的房分排行");
        return;
      }
    }

    // 4. 终极兜底：如果系统现在还是无法判定属于哪个支系 (Branch)，强制弹出询问，不准含糊
    if (!autoInferredBranch && !selectedBranch && relationship !== "挚友/其他" && !parentId) {
      if (["表", "堂", "亲", "姑", "姨", "舅", "叔", "伯", "侄", "甥", "孙"].some(k => finalRelationship.includes(k))) {
        alert("该称谓涉及分支归属，请先完成下方的亲疏确认。");
        setBranchMode('lineage');
        setBranchStage('type');
        setShowBranchAsk(true);
        return;
      }
    }

    const currentBranch = selectedBranch || autoInferredBranch;
    const currentRank = (selectedRank === "none" ? null : (selectedRank || autoInferredRank));

    // 检查是否需要询问排行
    if (!currentRank && currentBranch !== "社会好友" && ["哥", "姐", "弟", "妹", "甥", "侄", "孙"].some(k => resolvedRelationship.includes(k))) {
      setBranchStage('rank');
      setShowBranchAsk(true);
      return;
    }

    if (finalRelationship.includes("/")) {
      const parts = finalRelationship.split("/");
      if (['母家', '表', '姻亲'].includes(currentBranch || '')) {
        resolvedRelationship = parts[1] || parts[parts.length - 1];
      } else {
        resolvedRelationship = parts[0];
      }
    }

    // --- 逻辑守卫 (Logic Guard) ---
    // 强制执行传统的宗法逻辑：母系无“堂”，父系姑表为“表”
    const currentBranchName = selectedBranch || autoInferredBranch;
    const side = lineageSide || (currentBranchName === '母家' ? 'maternal' : 'paternal');

    // 如果是母系（外戚），绝对不能出现“堂”
    if (side === 'maternal' && (resolvedRelationship.includes("堂") || currentBranchName === '堂')) {
      alert(`传统礼法提醒：母系（外家）亲属应称“表”不称“堂”。系统已自动为您修正为“表${resolvedRelationship.replace("堂", "")}”。`);
      resolvedRelationship = resolvedRelationship.replace("堂", "表");
      if (autoInferredBranch === '堂') autoInferredBranch = '表';
    }

    // 最终组合逻辑：确保“堂/表”逻辑与支系一致
    let relationshipToStore = currentBranchName
      ? `${resolvedRelationship}(${currentBranchName})`
      : resolvedRelationship;

    if (currentRank) {
      relationshipToStore = `${currentRank}${relationshipToStore}`;
    }

    const deducedRole = deduceRole(finalRelationship);

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
          ancestralHall: (connectingRank && connectingRank !== '无' ? `${connectingRank}房` : (parent?.ancestralHall || null))
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
          ancestralHall: (connectingRank && connectingRank !== '无' ? `${connectingRank}房` : (parent?.ancestralHall || null))
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

      <main className="flex-1 px-6 py-8 max-w-md mx-auto w-full space-y-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-[#eab308]/10 rounded-full flex items-center justify-center mx-auto text-[#eab308]">
            <UserPlus size={40} />
          </div>
          <h2 className="text-3xl font-bold">邀请家人加入</h2>
          <p className="text-slate-500 italic text-lg">填写家人的信息，生成专属邀请码</p>
        </div>

        <div className="space-y-8">
          {/* Avatar Selection */}
          <div className="space-y-3">
            <label className="text-xl font-black px-1 block">选择头像</label>
            <div className="flex gap-4 overflow-x-auto pb-4 px-1 scrollbar-hide">
              <label className="flex-shrink-0 relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:border-[#eab308] transition-colors">
                  <Camera size={28} className="text-slate-400 group-hover:text-[#eab308]" />
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                <span className="text-xs text-center block mt-2 font-bold text-slate-400 uppercase tracking-widest">上传</span>
              </label>

              {avatar && (
                <div className="flex-shrink-0 relative cursor-pointer border-2 border-[#eab308] rounded-full p-0.5">
                  <img src={avatar} alt="Selected" className="w-20 h-20 rounded-full object-cover shadow-sm" />
                </div>
              )}

              {defaultAvatars.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setAvatar(url)}
                  className={`flex-shrink-0 relative rounded-full p-0.5 border-2 transition-all ${avatar === url ? "border-[#eab308]" : "border-transparent hover:border-slate-200"
                    }`}
                >
                  <img src={url} alt={`Avatar ${i}`} className="w-20 h-20 rounded-full bg-slate-50 shadow-sm" />
                </button>
              ))}
            </div>
          </div>

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
            <label className="text-xl font-black px-1 block">出生年月 <span className="text-sm font-normal text-slate-400 ml-2 tracking-widest">(选填)</span></label>
            <input
              type="date"
              className="w-full h-16 px-6 rounded-2xl border-none bg-white shadow-md text-xl font-bold text-slate-700 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
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
                    "flex-1 h-20 rounded-[2rem] font-bold transition-all border-2 flex flex-col items-center justify-center gap-1",
                    memberType === t
                      ? "bg-slate-800 border-slate-800 text-white shadow-xl scale-[1.02]"
                      : "bg-white border-slate-50 text-slate-400 hover:border-slate-200 shadow-sm"
                  )}
                >
                  {t === 'human' ? (
                    <>
                      <UserCircle2 size={24} className={memberType === t ? "text-amber-400" : "text-slate-300"} />
                      <span className="text-sm">人物档案</span>
                    </>
                  ) : (
                    <>
                      <PawPrint size={24} className={memberType === t ? "text-amber-400" : "text-slate-300"} />
                      <span className="text-sm">萌宠伙伴</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xl font-black px-1 block">Ta与您的关系</label>
            <div className="grid grid-cols-3 gap-2">
              {displayRelationships.map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => {
                    setRelationship(rel);
                    if (rel !== "其他") {
                      setSelectedBranch(null); // 重置分支
                    }
                  }}
                  className={cn(
                    "h-12 rounded-xl font-bold text-sm transition-all border-2",
                    relationship === rel
                      ? "bg-[#eab308] border-[#eab308] text-black shadow-md"
                      : "bg-white border-slate-50 text-slate-400 hover:border-slate-100"
                  )}
                >
                  {rel}
                </button>
              ))}
            </div>

            {relationship === "其他" && (
              <div className="space-y-2 relative">
                <input
                  type="text"
                  className="w-full h-14 px-5 rounded-2xl border-none bg-white shadow-inner text-lg font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                  placeholder="手动输入或选择建议 (如: 侄女, 姑父)"
                  value={customRelationship}
                  onChange={(e) => {
                    setCustomRelationship(e.target.value);
                    setIsDropdownVisible(true);
                    setSelectedBranch(null); // 输入变化时重置分支
                  }}
                  onFocus={() => setIsDropdownVisible(true)}
                />

                {isDropdownVisible && customRelationship && (
                  <div className="absolute top-16 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-[110] max-h-48 overflow-y-auto">
                    {RELATIONSHIP_SUGGESTIONS.filter(s => s.includes(customRelationship)).map(s => (
                      <button
                        key={s}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-xl font-bold text-slate-700 text-sm transition-colors"
                        onClick={() => {
                          setCustomRelationship(s);
                          setIsDropdownVisible(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                    {RELATIONSHIP_SUGGESTIONS.filter(s => s.includes(customRelationship)).length === 0 && (
                      <div className="p-3 text-xs text-slate-400 italic">没有匹配的词汇，请继续输入</div>
                    )}
                  </div>
                )}
                {isDropdownVisible && customRelationship && (
                  <div
                    className="fixed inset-0 z-[105]"
                    onClick={() => setIsDropdownVisible(false)}
                  />
                )}
              </div>
            )}
          </div>

          {/* 物理血缘指名 (Parent Identification) */}
          <AnimatePresence mode="wait">
            {safetyStep === 'ask' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-[3rem] border-2 border-[#eab308]/20 shadow-2xl space-y-6 relative overflow-hidden"
              >
                {/* 进度指示条 */}
                <div className="flex gap-1 px-12">
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`h-1 flex-1 rounded-full transition-all ${safetyStage >= s ? 'bg-[#eab308]' : 'bg-slate-100'}`} />
                  ))}
                </div>

                {/* 阶段 1：个人排行 (Personal Seniority) */}
                {safetyStage === 1 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-slate-800 italic underline decoration-[#eab308] underline-offset-4">第一阶段：名分确认</h3>
                      <p className="text-sm font-bold text-slate-700">
                        请问这位 {(relationship === "其他" ? customRelationship : (RELATIONSHIP_OPTIONS.find(o => o.value === relationship)?.label || relationship))} ({name || '未命名'}) 在这辈排行第几？
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {["大", "二", "三", "四", "五", "小", "无"].map(rk => (
                        <button
                          key={rk}
                          onClick={() => { setSelectedRank(rk); setSafetyStage(2); }}
                          className={`py-5 rounded-[1.5rem] border-2 text-base font-black transition-all ${selectedRank === rk ? 'border-[#eab308] bg-white text-black shadow-lg scale-105' : 'bg-slate-50 border-transparent text-slate-400'}`}
                        >
                          {rk === "无" ? "不知" : rk}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-center text-slate-400">提示：这是 TA 在同胞亲兄弟姐妹中的排行。</p>
                  </div>
                )}

                {/* 阶段 2：定性 (Kinship Type) */}
                {safetyStage === 2 && (
                  <div className="space-y-6 text-center">
                    <div className="flex justify-between items-center px-2">
                      <button onClick={() => setSafetyStage(1)} className="text-slate-400 text-xs font-bold">← 返回排行</button>
                      <h3 className="text-lg font-black text-slate-800 italic">第二阶段：关系定性</h3>
                      <div className="w-12"></div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 px-2">
                      <button
                        onClick={() => { setKinshipType('blood'); setSafetyStage(3); }}
                        className="flex items-center gap-4 p-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 hover:border-red-100 hover:bg-red-50/30 transition-all group"
                      >
                        <div className="size-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                          <Heart size={28} fill="currentColor" />
                        </div>
                        <div className="text-left flex-1">
                          <span className="font-black text-slate-800 block text-base">同胞血亲</span>
                          <span className="text-[10px] text-slate-400">例：亲叔伯、亲姑姨、亲兄弟及其后代</span>
                        </div>
                      </button>
                      <button
                        onClick={() => { setKinshipType('affinal'); setSafetyStage(3); }}
                        className="flex items-center gap-4 p-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="size-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                          <Link size={28} />
                        </div>
                        <div className="text-left flex-1">
                          <span className="font-black text-slate-800 block text-base">姻亲眷属</span>
                          <span className="text-[10px] text-slate-400">例：舅妈、姑父、婶婶、姻脉所系</span>
                        </div>
                      </button>
                      <button
                        onClick={() => { setKinshipType('social'); setSafetyStep('none'); }}
                        className="flex items-center gap-4 p-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 hover:border-green-100 hover:bg-green-50/30 transition-all group"
                      >
                        <div className="size-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                          <Users size={28} />
                        </div>
                        <div className="text-left flex-1">
                          <span className="font-black text-slate-800 block text-base">社会好友</span>
                          <span className="text-[10px] text-slate-400">例：挚友、义气兄弟、世交好友</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* 阶段 3：定方位 (Lineage Direction) */}
                {safetyStage === 3 && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                      <button onClick={() => setSafetyStage(2)} className="text-slate-400 text-xs font-bold">← 返回定性</button>
                      <h3 className="text-lg font-black text-slate-800 italic">第三阶段：方位坐标</h3>
                      <div className="w-12"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => { setLineageSide('paternal'); setSafetyStage(4); setSafetyChoice('real'); }}
                        className="p-8 rounded-[2.5rem] border-2 border-slate-50 bg-slate-50 hover:border-[#eab308] hover:bg-white transition-all group text-center space-y-3 shadow-sm hover:shadow-md"
                      >
                        <div className="size-16 rounded-full bg-amber-50 mx-auto flex items-center justify-center text-[#eab308] group-hover:scale-110 transition-transform">
                          <Landmark size={32} />
                        </div>
                        <span className="font-black text-slate-800 block">父族宗亲</span>
                        <span className="text-[10px] text-slate-400 leading-tight">我父亲/父系<br />那边的人</span>
                      </button>
                      <button
                        onClick={() => { setLineageSide('maternal'); setSafetyStage(4); setSafetyChoice('real'); }}
                        className="p-8 rounded-[2.5rem] border-2 border-slate-50 bg-slate-50 hover:border-[#eab308] hover:bg-white transition-all group text-center space-y-3 shadow-sm hover:shadow-md"
                      >
                        <div className="size-16 rounded-full bg-amber-50 mx-auto flex items-center justify-center text-[#eab308] group-hover:scale-110 transition-transform">
                          <Home size={32} />
                        </div>
                        <span className="font-black text-slate-800 block">母族外戚</span>
                        <span className="text-[10px] text-slate-400 leading-tight">我母亲/母系<br />那边的人</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 阶段 4：定排行/房分 (House Branch) */}
                {safetyStage === 4 && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                      <button onClick={() => setSafetyStage(3)} className="text-slate-400 text-xs font-bold">← 返回方位</button>
                      <h3 className="text-lg font-black text-slate-800">最终阶段：房分排行</h3>
                      <div className="w-12"></div>
                    </div>

                    <div className="bg-amber-100/30 rounded-[2.5rem] p-8 border border-amber-200/50 space-y-4">
                      <p className="text-sm font-bold text-slate-800 leading-relaxed text-center">
                        {(() => {
                          const relText = (relationship === "其他" ? customRelationship : (RELATIONSHIP_OPTIONS.find(o => o.value === relationship)?.label || relationship));
                          if (["孙", "外孙"].some(k => relText.includes(k))) return `您的第几个孩子，是 ${name || '这位晚辈'} 的父母？`;

                          if (lineageSide === 'paternal') {
                            return `那位 ${relText} 的父亲，在您的父辈中排行老几？`;
                          } else {
                            return `那位 ${relText} 的父/母，在您的母系长辈中排行老几？`;
                          }
                        })()}
                      </p>
                      <p className="text-[11px] text-amber-700/60 text-center font-medium">
                        提示：此选项将决定其所属支脉的“房分”。
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {["大", "二", "三", "四", "五", "小", "无"].map(rk => (
                        <button
                          key={rk}
                          onClick={() => {
                            setConnectingRank(rk);
                            setSafetyStep('none');
                          }}
                          className={`py-5 rounded-2xl border-2 text-base font-black transition-all ${connectingRank === rk ? 'border-[#eab308] bg-white text-black shadow-lg scale-105' : 'bg-slate-50 border-transparent text-slate-400'}`}
                        >
                          {rk === "无" ? "不知" : rk}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {safetyChoice === 'clan' && candidateParents.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-amber-200 space-y-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-black text-amber-600">看来您的叔公们还没有加入广场</p>
                  <p className="text-[10px] text-slate-400">为了理清房分，请问这位 {relationship} 的父亲（您的叔公）怎么称呼？</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-12 px-4 rounded-xl border-none bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-[#eab308]/20"
                    placeholder="如：二叔公、三叔公"
                    value={virtualParentName}
                    onChange={(e) => {
                      setVirtualParentName(e.target.value);
                      setIsCreatingVirtualParent(true);
                    }}
                  />
                  <button onClick={() => setSafetyChoice(null)} className="px-4 text-xs font-bold text-slate-400">返回</button>
                </div>
              </motion.div>
            )}

            {candidateParents.length > 0 && (safetyStep === 'none' || safetyChoice) && (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <p className="text-sm font-black text-amber-700/60 uppercase tracking-widest flex items-center gap-2">
                    <Check className="size-4" /> 您正在添加 {relationship === "其他" ? customRelationship : relationship}，请指点他是谁的孩子？
                  </p>
                  {safetyChoice && (
                    <button onClick={() => setSafetyChoice(null)} className="text-[10px] bg-amber-200/50 px-2 py-0.5 rounded-full text-amber-800 font-bold">重新选择亲疏</button>
                  )}
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {candidateParents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setParentId(parentId === p.id ? null : p.id);
                        setIsCreatingVirtualParent(false);
                      }}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center gap-2 transition-all p-2 rounded-2xl border-2",
                        parentId === p.id ? "bg-white border-[#eab308] shadow-md scale-105" : "border-transparent opacity-60"
                      )}
                    >
                      <img src={p.avatarUrl} className="size-14 rounded-full object-cover border-2 border-white shadow-sm" />
                      <span className="text-xs font-black text-slate-800">{p.name} ({p.relationship})</span>
                    </button>
                  ))}
                  {!isCreatingVirtualParent ? (
                    <button
                      onClick={() => setIsCreatingVirtualParent(true)}
                      className="flex-shrink-0 flex flex-col items-center gap-2 transition-all p-2 rounded-2xl border-2 border-transparent opacity-40"
                    >
                      <div className="size-14 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">+</div>
                      <span className="text-xs font-bold">不在列表中</span>
                    </button>
                  ) : (
                    <div className="flex-shrink-0 flex flex-col items-center gap-2 p-2">
                      <input
                        autoFocus
                        type="text"
                        className="w-24 h-14 rounded-2xl bg-white border-2 border-[#eab308] text-[10px] font-bold text-center px-1"
                        placeholder="输入其父姓名"
                        value={virtualParentName}
                        onChange={(e) => setVirtualParentName(e.target.value)}
                      />
                      <span onClick={() => setIsCreatingVirtualParent(false)} className="text-[10px] text-red-400 font-bold">取消</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-4 pb-12">
          <Button
            size="xl"
            className="w-full py-6 text-xl font-bold rounded-full bg-[#eab308] hover:bg-[#d9a306] text-black shadow-lg shadow-[#eab308]/20 border-none transition-all"
            disabled={!name || !relationship || (relationship === "其他" && !customRelationship) || isSubmitting}
            onClick={handleAdd}
          >
            {isSubmitting ? "正在创建档案..." : "建立档案"}
          </Button>
        </div>
      </main>

      <AnimatePresence>
        {showBranchAsk && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBranchAsk(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative z-10 space-y-6"
            >
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-black text-slate-800">确认名分归属</h3>
                <p className="text-sm text-slate-500">
                  {branchStage === 'type' && (
                    <>
                      {branchMode === 'lineage' && `想确认下，这位 ${relationship === '其他' ? customRelationship : relationship} 是：`}
                      {branchMode === 'closeness' && `这位 ${relationship === '其他' ? customRelationship : relationship} 与您的亲近程度是：`}
                      {branchMode === 'nature' && `这位 ${relationship === '其他' ? customRelationship : relationship} 是通过哪条路认的亲：`}
                    </>
                  )}
                  {branchStage === 'rank' && `请问这位 ${relationship === '其他' ? customRelationship : relationship} 在这辈排行第几？`}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {branchStage === 'type' && branchMode === 'lineage' && (
                  <>
                    <button
                      onClick={() => setSelectedBranch('母家')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '母家' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '母家' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>👩‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我母亲家这边的</span>
                        <span className="text-[10px] text-slate-400">比如：外公外婆的孩子们</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('父家')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '父家' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '父家' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>👨‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我父亲家这边的</span>
                        <span className="text-[10px] text-slate-400">比如：爷爷奶奶的孩子们</span>
                      </div>
                    </button>
                  </>
                )}

                {branchStage === 'type' && branchMode === 'closeness' && (
                  <>
                    <button
                      onClick={() => setSelectedBranch('亲生')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '亲生' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '亲生' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>🏠</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">亲生的手足</span>
                        <span className="text-[10px] text-slate-400">同一个爸妈带大的</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('堂')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '堂' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '堂' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>祠</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">叔叔伯伯家的 (堂)</span>
                        <span className="text-[10px] text-slate-400">同一个祖宗的家族孩子</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('表')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '表' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '表' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>🍎</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">姑舅姨妈家的 (表)</span>
                        <span className="text-[10px] text-slate-400">也就是咱们常说的“表亲”</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('社会好友')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '社会好友' ? 'border-[#eab308] bg-white opacity-100' : 'bg-slate-50 border-transparent hover:border-slate-200 opacity-70'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '社会好友' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>🤝</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">社会好友 / 损友</span>
                        <span className="text-[10px] text-slate-400">非血缘关系的挚友、同学等</span>
                      </div>
                    </button>
                  </>
                )}

                {branchStage === 'type' && branchMode === 'nature' && (
                  <>
                    <button
                      onClick={() => setSelectedBranch('血亲')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '血亲' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '血亲' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>🩸</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">血亲亲属</span>
                        <span className="text-[10px] text-slate-400">比如：你爸爸的亲兄弟（伯伯/叔叔）</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('姻亲')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '姻亲' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '姻亲' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>💍</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">姻亲眷属</span>
                        <span className="text-[10px] text-slate-400">比如：姑姑的丈夫（姑父）、舅舅的妻子（舅妈）</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedBranch('母家')}
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedBranch === '母家' ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <span className={`text-3xl transition-all ${selectedBranch === '母家' ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>👩‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我妈妈的娘家人</span>
                        <span className="text-[10px] text-slate-400">比如：亲舅舅（妈妈的亲哥哥/弟弟）</span>
                      </div>
                    </button>
                  </>
                )}

                {branchStage === 'rank' && (
                  <div className="grid grid-cols-2 gap-3">
                    {["大", "二", "三", "四", "五", "六", "小", "无"].map(rk => (
                      <button
                        key={rk}
                        onClick={() => setSelectedRank(rk === "无" ? "none" : rk)}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center font-bold text-slate-800 ${((rk === "无" && selectedRank === "none") || selectedRank === rk) ? 'border-[#eab308] bg-white' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                      >
                        {rk === "无" ? "不清楚/没排行" : rk}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleAdd}
                  disabled={branchStage === 'type' ? !selectedBranch : !selectedRank}
                  className="w-full py-4 rounded-2xl bg-[#eab308] text-black font-black text-lg shadow-lg shadow-[#eab308]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                >
                  确认名分
                </button>
              </div>

              <button
                onClick={() => setShowBranchAsk(false)}
                className="w-full py-4 text-slate-400 font-bold text-sm"
              >
                返回修改
              </button>
            </motion.div>
          </div>
        )}

        {showCropper && tempImage && (
          <ImageCropper
            image={tempImage}
            onCropComplete={(croppedImage) => {
              setAvatar(croppedImage);
              setShowCropper(false);
              setTempImage(null);
            }}
            onClose={() => {
              setShowCropper(false);
              setTempImage(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
