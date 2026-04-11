import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Share2, ZoomIn, ZoomOut, Maximize2, Users, Calendar, Heart, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DEMO_MEMBERS, DEMO_EVENTS, isDemoMode } from "./demo-data";
import { getSafeAvatar } from "./constants";
import { cn } from "./lib/utils";

interface TreeNodeProps {
  member: any;
  isRoot?: boolean;
  childrenCount?: number;
  onSelect: (m: any) => void;
  isSelected: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ member, isRoot, childrenCount, onSelect, isSelected }) => {
  return (
    <div className="flex flex-col items-center gap-3 relative min-w-[120px]">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onSelect(member)}
        className={cn(
          "relative z-10 size-20 rounded-[2rem] border-4 transition-all duration-500 overflow-hidden shadow-xl",
          isSelected ? "border-[#eab308] scale-110 ring-8 ring-[#eab308]/10" : "border-white"
        )}
      >
        <img src={getSafeAvatar(member.avatarUrl || member.avatar)} className="w-full h-full object-cover" alt={member.name} />
        {isRoot && (
          <div className="absolute top-0 right-0 bg-[#eab308] text-white p-1 rounded-bl-xl shadow-inner">
            <Heart size={10} fill="currentColor" />
          </div>
        )}
      </motion.button>

      <div className="flex flex-col items-center">
        <span className={cn(
          "text-sm font-black tracking-tighter transition-colors",
          isSelected ? "text-amber-600" : "text-slate-700"
        )}>
          {member.name}
        </span>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          {member.relationship || member.relation || "家族成员"}
        </span>
      </div>

      {childrenCount && childrenCount > 0 && !isSelected && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">
          {childrenCount} 分支
        </div>
      )}
    </div>
  );
};

export const FamilyTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [zoom, setZoom] = useState(1);

  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("currentUser");
    const parsed = saved ? JSON.parse(saved) : null;

    if (isDemoMode(parsed)) {
      setMembers(DEMO_MEMBERS);
      setEvents(DEMO_EVENTS);
      setLoading(false);
    } else {
      const familyId = parsed.familyId;
      Promise.all([
        fetch(`/api/family-members?familyId=${familyId}`).then(res => res.json()),
        fetch(`/api/events?familyId=${familyId}`).then(res => res.json())
      ]).then(([mList, eList]) => {
        if (Array.isArray(mList)) setMembers(mList);
        if (Array.isArray(eList)) setEvents(eList);
      }).finally(() => setLoading(false));
    }
  }, []);

  // 家族树分层逻辑：根据代数 (generation_num) 自动分组
  const generations = members.length > 0 ? (() => {
    const groups: Record<number, any[]> = {};
    members.forEach(m => {
      const gen = m.generationNum || m.generation_num || 30;
      if (!groups[gen]) groups[gen] = [];
      groups[gen].push(m);
    });
    return Object.keys(groups)
      .sort((a, b) => Number(a) - Number(b))
      .map(gen => ({
        level: `第 ${gen} 代`,
        members: groups[Number(gen)]
      }));
  })() : [
    { level: "暂无数据", members: [] }
  ];

  const getMemberEvents = (id: number) => {
    return events.filter(e => e.memberId === id).slice(0, 3);
  };

  return (
    <div className="fixed inset-0 bg-[#fdfbf7] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between z-50">
        <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-slate-900 active:scale-95 transition-all">
          <ArrowLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-slate-800 tracking-tight">家族脉络图</h1>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Digital Lineage Tree</span>
        </div>
        <button className="size-12 rounded-2xl bg-slate-900 text-white shadow-xl flex items-center justify-center active:scale-95 transition-all">
          <Share2 size={20} />
        </button>
      </header>

      {/* Control Tools */}
      <div className="fixed right-6 top-24 z-50 flex flex-col gap-3">
        {[
          { icon: ZoomIn, onClick: () => setZoom(z => Math.min(1.5, z + 0.1)) },
          { icon: ZoomOut, onClick: () => setZoom(z => Math.max(0.5, z - 0.1)) },
          { icon: Maximize2, onClick: () => setZoom(1) },
        ].map((tool, i) => (
          <button
            key={i}
            onClick={tool.onClick}
            className="size-11 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-amber-500 transition-colors"
          >
            <tool.icon size={20} />
          </button>
        ))}
      </div>

      {/* Tree Canvas */}
      <div className="flex-1 overflow-auto p-12 scroll-container">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="size-12 border-4 border-[#eab308]/20 border-t-[#eab308] rounded-full animate-spin" />
            <p className="text-slate-400 font-bold">加载家族脉络...</p>
          </div>
        ) : (
          <motion.div
            animate={{ scale: zoom }}
            className="flex flex-col items-center gap-24 min-w-max mx-auto pt-12 pb-64"
          >
            {generations.map((gen, gIdx) => (
              <div key={gen.level} className="flex flex-col items-center gap-12 relative w-full">
                {/* Generation Line Label */}
                <div className="absolute left-0 top-0 -translate-y-8 px-4 py-1.5 bg-slate-100/50 rounded-full border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{gen.level}</span>
                </div>

                <div className="flex items-center gap-16">
                  {gen.members.map((member, mIdx) => (
                    <TreeNode
                      key={member.id}
                      member={member}
                      isRoot={gIdx === 0}
                      childrenCount={gIdx < generations.length - 1 ? 2 : 0}
                      onSelect={setSelectedMember}
                      isSelected={selectedMember?.id === member.id}
                    />
                  ))}
                </div>

                {/* Connecting Lines (Mock with dots) */}
                {gIdx < generations.length - 1 && (
                  <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center h-16 w-0.5 border-r-2 border-dashed border-slate-200 opacity-50" />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Member Backdrop Drawer */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 inset-x-0 h-[65vh] bg-[#fdfbf7] rounded-t-[3rem] shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4" />

              <div className="flex-1 overflow-auto p-8 space-y-8">
                {/* Profile Header in Drawer */}
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-[2.5rem] border-4 border-white shadow-xl overflow-hidden shrink-0">
                    <img src={getSafeAvatar(selectedMember.avatarUrl || selectedMember.avatar)} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{selectedMember.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest">{selectedMember.relationship || selectedMember.relation}</span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{selectedMember.birthDate?.slice(0, 4)} — 至今</span>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "大事记", val: "12", icon: Calendar, color: "text-blue-500 bg-blue-50" },
                    { label: "岁月声", val: "8", icon: MessageSquare, color: "text-emerald-500 bg-emerald-50" },
                    { label: "被提及", val: "24", icon: Heart, color: "text-rose-500 bg-rose-50" },
                  ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl border border-slate-50 shadow-sm">
                      <div className={cn("size-8 rounded-xl flex items-center justify-center mb-2", stat.color)}>
                        <stat.icon size={16} />
                      </div>
                      <span className="text-xl font-black text-slate-800">{stat.val}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* Recent Memories */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Users size={14} /> 家族故事选辑
                  </h3>
                  <div className="space-y-3">
                    {getMemberEvents(selectedMember.id).map(event => (
                      <div key={event.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-2 group hover:border-amber-200 transition-colors">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-slate-400">{event.date.replace(/-/g, '.')}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-400 text-[9px] font-black uppercase">{event.type}</span>
                        </div>
                        <p className="text-base font-black text-slate-800 leading-tight">{event.title}</p>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-2">{event.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => navigate(`/archive/${selectedMember.id}`)}
                    className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-base shadow-xl active:scale-95 transition-all"
                  >
                    进入完整档案
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="p-6 bg-white/50 backdrop-blur-md border-t border-slate-100 text-center">
        <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase">双指缩放查看全貌 • 点击节点查看细节</p>
      </div>
    </div>
  );
};
