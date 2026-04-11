import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "./lib/utils";
import { getSafeAvatar } from "./constants";
import { DEMO_MEMORIES, isDemoMode } from "./demo-data";

export interface FamilyMapViewProps {
    members: any[];
    currentUser?: any;
    searchQuery?: string;
}

export const FamilyMapView: React.FC<FamilyMapViewProps> = ({ members, currentUser, searchQuery }) => {
    const navigate = useNavigate();

    // 1. 获取真实消息数据以统计数量
    const [realStats, setRealStats] = useState<Record<string, {text: number, voice: number, photo: number}>>({});

    useEffect(() => {
        const fetchStats = async () => {
             const savedUser = localStorage.getItem("currentUser");
             const cUser = savedUser ? JSON.parse(savedUser) : null;
             let msgs: any[] = [];
             
             if (isDemoMode(cUser)) {
                  msgs = DEMO_MEMORIES;
             } else {
                  try {
                      const res = await fetch('/api/messages');
                      const data = await res.json();
                      if (Array.isArray(data)) msgs = data;
                  } catch (e) {
                      msgs = [];
                  }
             }
             
             const statsObj: Record<string, {text: number, voice: number, photo: number}> = {};
             
             msgs.forEach(msg => {
                  const mid = msg.memberId || msg.targetMemberId || msg.eventId;
                  if (mid) {
                      if (!statsObj[mid]) statsObj[mid] = { text: 0, voice: 0, photo: 0 };
                      if (msg.type === 'voice' || msg.audioUrl || msg.voiceUrl) statsObj[mid].voice++;
                      else if (msg.type === 'photo' || msg.imageUrl) statsObj[mid].photo++;
                      else statsObj[mid].text++;
                  }
             });
             
             // 发送者也记为参与内容的分享
             msgs.forEach(msg => {
                  if (msg.authorId) {
                      const mid = msg.authorId;
                      if (!statsObj[mid]) statsObj[mid] = { text: 0, voice: 0, photo: 0 };
                      if (msg.type === 'voice' || msg.audioUrl || msg.voiceUrl) statsObj[mid].voice++;
                      else if (msg.type === 'photo' || msg.imageUrl) statsObj[mid].photo++;
                      else statsObj[mid].text++;
                  }
             });
             
             setRealStats(statsObj);
        };
        fetchStats();
    }, []);

    // 2. 过滤并按辈分(generation_num)分组
    const generationalGroups = useMemo(() => {
        let filtered = members.filter(m => m.memberType !== 'virtual' && m.memberType !== 'placeholder' && !m.isVirtual && !m.is_placeholder);
        
        // 确保本尊等同真实用户也永远显示
        if (currentUser?.familyId === 'demo' || isDemoMode(currentUser)) {
            // demo模式已在前置过滤虚拟人，所以可以直接用
        } else {
            filtered = filtered.filter(m => (m.is_registered || m.isRegistered) || !!m.createdByMemberId || m.id === currentUser?.id || m.id === currentUser?.memberId);
        }

        if (searchQuery) {
            filtered = filtered.filter(m => m.name?.includes(searchQuery) || (m.relationship && m.relationship.includes(searchQuery)));
        }

        // 分组器
        const groups: Record<number, any[]> = {};
        
        filtered.forEach(m => {
             // 默认 99 处理无法判定辈分的人（排到最后）
             let gen = 99;
             if (typeof m.generation_num === 'number') gen = m.generation_num;
             else if (typeof m.generationNum === 'number') gen = m.generationNum;
             
             if (!groups[gen]) groups[gen] = [];
             groups[gen].push(m);
        });

        // 将辈分对象转化为数组，并按辈分值从小到大排序 (长辈在前)
        const sortedGenKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
        
        return sortedGenKeys.map(gen => ({
             generation: gen,
             members: groups[gen]
        }));

    }, [members, searchQuery, currentUser]);

    const getSavedMemoriesStats = (id: number) => {
        return realStats[id] || { text: 0, voice: 0, photo: 0 };
    };

    return (
        <div className="w-full min-h-[850px] relative bg-gradient-to-b from-[#fffcf5] via-[#fdfbf7] to-[#faf8f2] rounded-t-[3rem] overflow-hidden pt-12 pb-32 border-t-[6px] border-white/60">
            
            {/* 顶部的柔和暖光晕 (点灯感) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-80 bg-[#fde68a]/30 blur-[120px] pointer-events-none" />

            {/* 生命树的微光主干 */}
            <div className="absolute top-16 bottom-20 left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-b from-[#eab308]/50 via-[#eab308]/20 to-transparent rounded-full shadow-[0_0_25px_rgba(245,158,11,0.4)] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center w-full gap-16 md:gap-24">
                {generationalGroups.map((group, groupIdx) => (
                    <div key={group.generation} className="flex flex-col items-center w-full relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${groupIdx * 0.15}s`, animationFillMode: 'both' }}>
                        
                        {/* 我们用一组并排的悬挂式“许愿灯”来表现这一代人 */}
                        <div className="flex flex-wrap justify-center items-start gap-6 md:gap-10 w-full max-w-4xl px-4 z-10">
                             {group.members.map((member, idx) => {
                                  const stats = getSavedMemoriesStats(member.id);
                                  const totalMemories = stats.text + stats.voice + stats.photo;
                                  const isMe = currentUser && (String(member.id) === String(currentUser.id) || String(member.id) === String(currentUser.memberId));
                                  const displayName = isMe ? (currentUser?.name || "我") : (member.name || "未知亲属");
                                  const relationLabel = isMe ? "我" : (member.relationship || "亲属");
                                  
                                  return (
                                       <div 
                                           key={member.id}
                                           onClick={() => navigate(`/archive/${member.id}`)}
                                           className="flex flex-col items-center group cursor-pointer w-[76px] md:w-[86px] relative"
                                       >
                                           {/* 许愿灯 (Glowing Orb) */}
                                           <div className="relative size-[72px] md:size-[80px] rounded-full p-[3px] bg-gradient-to-b from-[#fcd34d] to-[#eab308]/40 mb-3 shadow-[0_10px_30px_rgba(245,158,11,0.25)] group-hover:scale-[1.08] group-hover:shadow-[0_15px_40px_rgba(245,158,11,0.45)] transition-all duration-500 z-10">
                                               {/* 头像内胆 */}
                                               <div className="w-full h-full rounded-full overflow-hidden border-[2.5px] border-white/95 bg-white">
                                                   <img src={getSafeAvatar(member.avatarUrl)} className="w-full h-full object-cover" alt={displayName} referrerPolicy="no-referrer" />
                                               </div>
                                               
                                               {/* 是我本人的特别光效 */}
                                               {isMe && (
                                                   <div className="absolute -bottom-1 -right-1 size-5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full border-2 border-white shadow-md z-20 flex items-center justify-center">
                                                       <span className="text-[8px] text-white font-black scale-75 leading-none">我</span>
                                                   </div>
                                               )}
                                           </div>
                                           
                                           {/* 质感温润的文字 */}
                                           <span className="text-[13px] md:text-sm font-bold text-slate-800 tracking-wide mb-1 text-center w-full truncate drop-shadow-sm z-10">{displayName}</span>
                                           <span className="text-[10px] md:text-[11px] text-amber-700/70 font-medium mb-1.5 text-center w-full truncate z-10">{relationLabel}</span>
                                           
                                           {/* 树饰挂牌上的记录数 (像垂挂的小金牌) */}
                                           {totalMemories > 0 ? (
                                               <div className="mt-1 px-2.5 py-0.5 bg-gradient-to-b from-[#fef3c7]/90 to-white/90 rounded-full text-[10px] text-amber-700 font-bold border border-amber-200/50 shadow-sm backdrop-blur-sm z-10">
                                                   {totalMemories} 纪忆
                                               </div>
                                           ) : (
                                               <div className="mt-1 h-[22px]" />
                                           )}
                                       </div>
                                  );
                             })}
                        </div>
                    </div>
                ))}

                {generationalGroups.length === 0 && (
                    <div className="text-center py-20 text-slate-400 font-bold w-full">
                        还没有添加家族成员档案，快去添加吧
                    </div>
                )}
            </div>
            
        </div>
    );
};
