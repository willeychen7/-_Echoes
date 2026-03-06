import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Copy, Check, Camera } from "lucide-react";
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
  const [safetyChoice, setSafetyChoice] = useState<'real' | 'clan' | null>(null);
  const [isCreatingVirtualParent, setIsCreatingVirtualParent] = useState(false);
  const [virtualParentName, setVirtualParentName] = useState("");
  const [memberType, setMemberType] = useState<'human' | 'pet'>('human');
  const [showBranchAsk, setShowBranchAsk] = useState(false);
  const [branchMode, setBranchMode] = useState<'lineage' | 'closeness' | 'nature' | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  // 全面涵盖：孙辈、旁系、长辈、以及平辈的潜在歧义词
  const AMBIGUOUS_RELATIONS = [
    "外甥", "侄", "孙", "辈",      // 孙辈/后辈
    "哥", "姐", "弟", "妹",         // 平辈 (堂/表/亲)
    "叔", "伯", "姑", "舅", "姨"    // 长辈 (血路/姻路)
  ];

  // 预定义的建议列表 (用于下拉选择)
  const RELATIONSHIP_SUGGESTIONS = RELATIONSHIP_OPTIONS.map(opt => opt.label);

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

    // 严谨分流：如果用户做了亲疏选择，则精准过滤
    if (safetyChoice === 'real') {
      // 亲兄弟的父辈必须是观察者的亲爷爷 (grandfather_paternal)
      const savedUser = localStorage.getItem("currentUser");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      const me = members.find(m => Number(m.id) === Number(currentUser?.memberId));
      const myFather = members.find(m => Number(m.id) === Number(me?.fatherId));
      if (myFather?.fatherId) {
        return members.filter(m => Number(m.id) === Number(myFather.fatherId));
      }
      return members.filter(m => m.standardRole === "grandfather_paternal" || m.relationship === "爷爷");
    }

    if (safetyChoice === 'clan') {
      // 堂兄弟的父辈是我的叔公、伯公 (grand_uncle)
      return members.filter(m => (m.relationship || "").includes("叔公") || (m.relationship || "").includes("伯公"));
    }

    // 默认逻辑
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
  }, [relationship, customRelationship, members, safetyChoice]);

  React.useEffect(() => {
    const rel = (relationship === "其他" ? customRelationship : relationship) || "";
    const ambiguous = ["叔叔", "伯伯", "堂叔", "二爸", "小叔", "叔伯"].some(k => rel.includes(k));
    if (ambiguous) {
      setSafetyStep('ask');
    } else {
      setSafetyStep('none');
      setSafetyChoice(null);
    }
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

    const finalRelationship = relationship === "其他" ? customRelationship : relationship;

    // 逻辑分流判定器
    if (!selectedBranch) {
      if (["外甥", "侄", "孙", "孙辈"].some(k => finalRelationship.includes(k))) {
        setBranchMode('lineage');
        setShowBranchAsk(true);
        return;
      }
      if (["哥", "姐", "弟", "妹"].some(k => finalRelationship.includes(k))) {
        setBranchMode('closeness');
        setShowBranchAsk(true);
        return;
      }
      if (["叔", "伯", "姑", "舅", "姨"].some(k => finalRelationship.includes(k))) {
        setBranchMode('nature');
        setShowBranchAsk(true);
        return;
      }
    }

    let resolvedRelationship = finalRelationship;
    if (finalRelationship.includes("/")) {
      const parts = finalRelationship.split("/");
      if (['母家', '表', '姻亲'].includes(selectedBranch || '')) {
        // 通常 / 后面的词是母家、表亲或姻亲称谓 (如 侄子/外甥，外甥是母系)
        resolvedRelationship = parts[1] || parts[parts.length - 1];
      } else {
        // 通常 / 前面的是父家、堂亲或血亲 (如 侄子/外甥，侄子是父系)
        resolvedRelationship = parts[0];
      }
    }

    const relationshipToStore = selectedBranch
      ? `${resolvedRelationship}(${selectedBranch})`
      : resolvedRelationship;

    const deducedRole = deduceRole(finalRelationship);

    setIsSubmitting(true);
    let currentParentId = parentId;

    // 严谨：如果启用了虚拟父辈创建
    if (isCreatingVirtualParent && virtualParentName.trim()) {
      try {
        const genNum = (currentUser.generationNum || 30) - 1; // 默认爷爷辈/上一辈
        const vResponse = await fetch("/api/family-members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: virtualParentName.trim(),
            relationship: safetyChoice === 'clan' ? "叔公" : "长辈",
            avatarUrl: `https://avatar.vercel.sh/${virtualParentName.trim()}.svg`,
            familyId,
            createdByMemberId,
            memberType: 'virtual',
            generationNum: genNum,
            // 自动解析房头
            ancestralHall: virtualParentName.includes("二") ? "二房" : virtualParentName.includes("大") ? "大房" : virtualParentName.includes("三") ? "三房" : null
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
          ancestralHall: parent?.ancestralHall || null // 自动继承父辈房头
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
          memberType
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
                    "flex-1 h-14 rounded-2xl font-bold transition-all border-2",
                    memberType === t
                      ? "bg-slate-800 border-slate-800 text-white shadow-lg scale-[1.02]"
                      : "bg-white border-slate-50 text-slate-400 hover:border-slate-200"
                  )}
                >
                  {t === 'human' ? "人类成员 👤" : "可爱宠物 🐾"}
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
            {safetyStep === 'ask' && !safetyChoice && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-[2rem] border-2 border-[#eab308]/20 shadow-xl space-y-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Check size={60} /></div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800">确认亲疏关系</h3>
                  <p className="text-sm text-slate-500">这位长辈是您父亲的亲兄弟，还是堂兄弟？</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setSafetyChoice('real');
                      if (relationship === "叔叔" || relationship === "伯伯") {
                        // 自动建议更亲密的称谓
                        setRelationship(gender === 'male' ? "二爸" : "姑姑");
                      }
                    }}
                    className="p-6 rounded-2xl border-2 border-slate-50 bg-slate-50 hover:border-[#eab308] hover:bg-white transition-all text-center group"
                  >
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏡</div>
                    <span className="font-black text-slate-800 block">亲兄弟</span>
                    <span className="text-[10px] text-slate-400">亲爷爷的孩子</span>
                  </button>
                  <button
                    onClick={() => setSafetyChoice('clan')}
                    className="p-6 rounded-2xl border-2 border-slate-50 bg-slate-50 hover:border-[#eab308] hover:bg-white transition-all text-center group"
                  >
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">祠</div>
                    <span className="font-black text-slate-800 block">堂兄弟</span>
                    <span className="text-[10px] text-slate-400">叔公/伯公的孩子</span>
                  </button>
                </div>
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
                  {branchMode === 'lineage' && `想确认下，这位 ${relationship === '其他' ? customRelationship : relationship} 是：`}
                  {branchMode === 'closeness' && `这位 ${relationship === '其他' ? customRelationship : relationship} 与您的亲近程度是：`}
                  {branchMode === 'nature' && `这位 ${relationship === '其他' ? customRelationship : relationship} 是通过哪条路认的亲：`}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {branchMode === 'lineage' && (
                  <>
                    <button
                      onClick={() => { setSelectedBranch('母家'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">👩‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我母亲家这边的</span>
                        <span className="text-[10px] text-slate-400">比如：外公外婆的孩子们</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedBranch('父家'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">👨‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我父亲家这边的</span>
                        <span className="text-[10px] text-slate-400">比如：爷爷奶奶的孩子们</span>
                      </div>
                    </button>
                  </>
                )}

                {branchMode === 'closeness' && (
                  <>
                    <button
                      onClick={() => { setSelectedBranch('亲生'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🏠</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">亲生的手足</span>
                        <span className="text-[10px] text-slate-400">同一个爸妈带大的</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedBranch('堂'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">祠</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">叔叔伯伯家的 (堂)</span>
                        <span className="text-[10px] text-slate-400">同一个祖宗的家族孩子</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedBranch('表'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🍎</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">姑舅姨妈家的 (表)</span>
                        <span className="text-[10px] text-slate-400">也就是咱们常说的“表亲”</span>
                      </div>
                    </button>
                  </>
                )}

                {branchMode === 'nature' && (
                  <>
                    <button
                      onClick={() => { setSelectedBranch('血亲'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🩸</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">打断骨头连着筋的血亲</span>
                        <span className="text-[10px] text-slate-400">比如：我爸亲哥（大伯）</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedBranch('姻亲'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">💍</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">通过结婚进门的亲戚</span>
                        <span className="text-[10px] text-slate-400">比如：姑姑的老公（姑父）</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedBranch('母家'); setShowBranchAsk(false); setTimeout(handleAdd, 100); }}
                      className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#eab308] hover:bg-white transition-all flex items-center gap-4 group"
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">👩‍👦</span>
                      <div className="text-left">
                        <span className="font-black text-slate-800 block">我妈妈那边的亲兄弟</span>
                        <span className="text-[10px] text-slate-400">比如：亲舅舅</span>
                      </div>
                    </button>
                  </>
                )}
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
