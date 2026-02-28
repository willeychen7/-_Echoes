import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Copy, Check, Camera } from "lucide-react";
import { Button } from "./components/Button";
import { motion, AnimatePresence } from "motion/react";
import { deduceRole, RELATIONSHIP_OPTIONS } from "./lib/relationships";
import { ImageCropper } from "./components/ImageCropper";
import { isDemoMode } from "./demo-data";

export const AddMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [inviteCode]);

  const displayRelationships = React.useMemo(() => {
    const shuffled = [...RELATIONSHIP_OPTIONS].sort(() => 0.5 - Math.random());
    return [...shuffled.slice(0, 5).map(r => r.label), "其他"];
  }, []);

  const defaultAvatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Molly",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
  ];

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
    const familyId = currentUser?.familyId || 1;
    const createdByMemberId = currentUser?.memberId;

    const finalRelationship = relationship === "其他" ? customRelationship : relationship;
    // deduceRole will check if finalRelationship matches any standard role strings (e.g. "爸爸", "奶奶")
    const deducedRole = deduceRole(finalRelationship);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relationship: finalRelationship,
          avatarUrl: avatar || `https://picsum.photos/seed/${name}/200/200`,
          bio: "",
          birthDate: "",
          familyId,
          createdByMemberId,
          standardRole: deducedRole
        })
      });
      const data = await response.json().catch(() => ({}));
      const newId = data.id || Date.now();
      const inviteCodeResponse = data.inviteCode || `FA-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      if (isDemoMode(currentUser)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        customMembers.push({
          id: newId,
          name,
          relationship: finalRelationship,
          avatarUrl: avatar || `https://picsum.photos/seed/${name}/200/200`,
          bio: "",
          birthDate: "",
          isRegistered: false,
          standardRole: deducedRole,
          createdByMemberId: currentUser?.memberId
        });
        localStorage.setItem("demoCustomMembers", JSON.stringify(customMembers));
      } else if (!data.id) {
        throw new Error(data.error || "Failed to add member");
      }

      setInviteCode(inviteCodeResponse);
      setNewMemberId(newId);
    } catch (error) {
      console.error(error);
      alert("添加失败，请稍后重试。");
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
            <p className="text-[10px] text-slate-400 mt-2">
              (可选) 如果家人也在使用该小程序，您可以将此码发送给他们，注册后即可产生关联。否则可以忽略。
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
                className="flex-1 py-3 text-[#eab308] font-bold bg-[#eab308]/10 rounded-xl hover:bg-[#eab308]/20 flex items-center justify-center"
              >
                {copied ? "已复制" : "复制邀请码"}
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

          <div className="space-y-4">
            <label className="text-xl font-black px-1 block">新成员是我的 ____</label>
            <div className="grid grid-cols-3 gap-3">
              {displayRelationships.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRelationship(r);
                    if (r !== "其他") setCustomRelationship("");
                  }}
                  className={`px-4 py-4 rounded-2xl border-2 transition-all text-lg font-black ${relationship === r
                    ? "bg-[#eab308] border-[#eab308] text-black shadow-lg shadow-[#eab308]/20"
                    : "bg-white border-slate-50 text-slate-500 hover:border-[#eab308]/30"
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {relationship === "其他" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2"
              >
                <input
                  type="text"
                  className="w-full h-16 px-6 rounded-2xl border-none bg-white shadow-md text-xl font-bold focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                  placeholder="填写具体的称谓，如：干爹、老战友"
                  value={customRelationship}
                  onChange={(e) => setCustomRelationship(e.target.value)}
                />
              </motion.div>
            )}
          </div>
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
