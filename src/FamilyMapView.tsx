import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export const FamilyMapView: React.FC<{ members: any[] }> = ({ members }) => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.8);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Center the map initially
        if (containerRef.current) {
            setPosition({
                x: containerRef.current.clientWidth / 2 - 500 * scale,
                y: containerRef.current.clientHeight / 2 - 250 * scale
            });
        }
    }, [scale]);

    if (!members || members.length === 0) {
        return <div className="p-8 text-center text-slate-400">目前还没有家庭成员可以显示在地图上。</div>;
    }

    const maxMapY = Math.max(...members.map(m => m.mapY || 0));
    const maxHeight = Math.max(800, maxMapY + 300);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragStart({
            x: clientX - position.x,
            y: clientY - position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setPosition({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.4));
    const resetZoom = () => {
        setScale(0.8);
        if (containerRef.current) {
            setPosition({
                x: containerRef.current.clientWidth / 2 - 500 * 0.8,
                y: containerRef.current.clientHeight / 2 - 250 * 0.8
            });
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full min-h-[600px] relative bg-[#fdfbf7] overflow-hidden rounded-[2.5rem] border-4 border-white shadow-xl touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        >
            {/* Control Panel */}
            <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 glass-morphism p-2 rounded-2xl shadow-lg border border-slate-100/50 bg-white/50 backdrop-blur-md">
                <button onClick={zoomIn} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><ZoomIn size={24} /></button>
                <button onClick={resetZoom} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><Maximize2 size={24} /></button>
                <button onClick={zoomOut} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><ZoomOut size={24} /></button>
            </div>

            {/* Instruction Banner */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 glass-morphism px-6 py-2.5 rounded-full shadow-md border border-slate-100/50 bg-white/80 backdrop-blur-md flex items-center gap-2 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                <span className="text-sm font-bold text-slate-600 tracking-widest whitespace-nowrap">探索家族树，点击头像查看档案</span>
            </div>

            {/* Sub-Legend */}
            <div className="absolute top-6 left-6 z-20 glass-morphism p-4 rounded-2xl shadow-md border border-slate-100/50 bg-white/80 backdrop-blur-md">
                <h3 className="text-xs font-black text-[#eab308] uppercase tracking-widest mb-3">家族分野坐标</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-[#eab308] rounded-full shadow-sm" />
                        <span className="text-xs font-black text-slate-600">父系宗亲 <span className="text-slate-400 font-mono">(左)</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-purple-400 rounded-full shadow-sm" />
                        <span className="text-xs font-black text-slate-600">母系外家 <span className="text-slate-400 font-mono">(右)</span></span>
                    </div>
                </div>
            </div>

            {/* The Interactive Map Layer */}
            <motion.div
                ref={mapRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing transform-gpu"
                style={{
                    width: 1000,
                    height: maxHeight,
                    x: position.x,
                    y: position.y,
                    scale: scale,
                    originX: 0,
                    originY: 0
                }}
            >
                {/* SVG Background for lines - Center Divider */}
                <svg width="1000" height={maxHeight} className="absolute inset-0 pointer-events-none z-0">
                    <defs>
                        <linearGradient id="centerLine" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(234, 179, 8, 0)" />
                            <stop offset="50%" stopColor="rgba(234, 179, 8, 0.3)" />
                            <stop offset="100%" stopColor="rgba(234, 179, 8, 0)" />
                        </linearGradient>
                    </defs>
                    <line x1="500" y1="50" x2="500" y2={maxHeight - 50} stroke="url(#centerLine)" strokeWidth="6" strokeDasharray="12,12" strokeLinecap="round" />
                </svg>

                {/* Plotting Members */}
                {members.map(member => {
                    if (member.mapX == null || member.mapY == null) return null;

                    const isMaternal = member.logicTag?.includes('[M]');
                    const isVirtual = member.member_type === 'virtual' || member.memberType === 'virtual' || ["的父亲", "的母亲", "的孩子", "的子女", "的兄弟姐妹", "的哥哥", "的姐姐", "的弟弟", "的妹妹", "的爷爷", "的奶奶", "的外公", "的外婆", "的曾祖", "的高祖"].some(k => (member.name || "").includes(k));

                    return (
                        <motion.div
                            key={member.id}
                            initial={{ opacity: 0, scale: 0, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, delay: Math.random() * 0.3 }}
                            className="absolute flex flex-col items-center group"
                            style={{
                                left: member.mapX,
                                top: member.mapY,
                                x: '-50%',
                                y: '-50%'
                            }}
                        >
                            <div
                                className={`rounded-full border-4 shadow-xl overflow-hidden cursor-pointer hover:scale-110 active:scale-95 transition-all
                                    ${isVirtual ? 'w-16 h-16 border-slate-200 opacity-60 grayscale' : 'w-24 h-24 ' + (isMaternal ? 'border-purple-200 shadow-purple-200/50 hover:shadow-purple-300' : 'border-amber-200 shadow-amber-200/50 hover:shadow-amber-300')}
                                    bg-slate-50 relative z-10
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isVirtual) navigate(`/archive/${member.id}`);
                                }}
                            >
                                <img
                                    src={member.avatarUrl || member.avatar_url || (isVirtual ? '' : `https://picsum.photos/seed/${member.name}/200/200`)}
                                    alt={member.name}
                                    className="w-full h-full object-cover"
                                />
                                {(!isVirtual && member.isRegistered) && (
                                    <div className={`absolute bottom-0 inset-x-0 h-4 ${isMaternal ? 'bg-purple-500' : 'bg-emerald-500'} flex justify-center items-center`}>
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                )}
                            </div>

                            <div className={`mt-3 flex flex-col items-center bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-[1.5rem] shadow-lg border relative z-20 transition-transform group-hover:-translate-y-1
                                ${isVirtual ? 'border-slate-100 shadow-none opacity-70 px-3 py-1.5' : (isMaternal ? 'border-purple-100 shadow-purple-100/50' : 'border-amber-100 shadow-amber-100/50')}`}
                            >
                                <span className={`font-black whitespace-nowrap ${isVirtual ? 'text-xs text-slate-400' : 'text-xl ' + (isMaternal ? 'text-purple-900' : 'text-slate-800')}`}>{member.name}</span>
                                {(!isVirtual && member.relationship) && (
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5
                                        ${isMaternal ? 'text-purple-500' : 'text-[#eab308]'}
                                    `}>
                                        {member.relationship}
                                    </span>
                                )}
                                {member.logicTag && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 px-2.5 py-1 bg-slate-100 rounded-lg inset-shadow-sm flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${isMaternal ? 'bg-purple-400' : 'bg-[#eab308]'}`}></span>
                                        {member.logicTag}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};
