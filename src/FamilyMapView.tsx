import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ZoomIn, ZoomOut, Maximize2, Share2, Info } from "lucide-react";
import { generateSmartLayout } from "./lib/kinshipEngine";

export const FamilyMapView: React.FC<{ members: any[] }> = ({ members }) => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.8);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [selectedId, setSelectedId] = useState<string | number | null>(null);

    // 💡 核心：全家福自适应布局计算 (包括房头背景块)
    const { processedMembers, pods } = useMemo(() => {
        const layout = generateSmartLayout(members);
        return {
            processedMembers: layout.members,
            pods: layout.pods
        };
    }, [members]);

    useEffect(() => {
        // Center the map initially
        if (containerRef.current) {
            setPosition({
                x: containerRef.current.clientWidth / 2 - 500 * scale,
                y: containerRef.current.clientHeight / 2 - 250 * scale
            });
        }
    }, [scale]);

    if (!processedMembers || processedMembers.length === 0) {
        return <div className="p-8 text-center text-slate-400">目前还没有家庭成员可以显示在地图上。</div>;
    }

    const maxMapY = Math.max(...processedMembers.map(m => m.mapY || 0));
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

    // 💡 核心精进：血脉航线追踪算法
    const activePath = useMemo(() => {
        if (!selectedId) return [];
        const target = processedMembers.find(m => m.id === selectedId);
        if (!target || !target.logicTag) return [];

        const tag = target.logicTag;
        const parts = tag.split('-');
        if (parts.length < 2) return [];

        const side = parts[0];
        const route = parts[1].split(',').filter((s: string) => s !== 'sib' && s !== 'x' && !s.startsWith('o'));

        const pathNodes = [];
        // 1. 寻找本人 (self)
        const selfNode = processedMembers.find(m => (m.logicTag || "").includes('self'));
        if (selfNode) pathNodes.push(selfNode);

        // 2. 补全中间节点
        let currentSegments: string[] = [];
        for (const segment of route) {
            currentSegments.push(segment);
            const midTag = `${side}-${currentSegments.join(',')}`;
            const midNode = processedMembers.find(m => (m.logicTag || "").startsWith(midTag));
            if (midNode) pathNodes.push(midNode);
        }

        if (!pathNodes.find(n => n.id === target.id)) {
            pathNodes.push(target);
        }

        return pathNodes;
    }, [selectedId, processedMembers]);

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
            onClick={() => setSelectedId(null)}
        >
            {/* Control Panel */}
            <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 glass-morphism p-2 rounded-2xl shadow-lg border border-slate-100/50 bg-white/50 backdrop-blur-md">
                <button onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><ZoomIn size={24} /></button>
                <button onClick={(e) => { e.stopPropagation(); resetZoom(); }} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><Maximize2 size={24} /></button>
                <button onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors shadow-sm"><ZoomOut size={24} /></button>
            </div>

            {/* Instruction Banner */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 glass-morphism px-6 py-2.5 rounded-full shadow-md border border-slate-100/50 bg-white/80 backdrop-blur-md flex items-center gap-2 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                <span className="text-sm font-bold text-slate-600 tracking-widest whitespace-nowrap">
                    {selectedId ? "正在追踪血脉航线..." : "探索家族树，点击头像激发航线"}
                </span>
            </div>

            {/* Legends */}
            <div className="absolute top-6 left-6 z-20 glass-morphism p-4 rounded-2xl shadow-md border border-slate-100/50 bg-white/80 backdrop-blur-md">
                <h3 className="text-xs font-black text-[#eab308] uppercase tracking-widest mb-3">家族分野坐标</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-gradient-to-r from-emerald-400 to-[#eab308] rounded-full shadow-sm" />
                        <span className="text-xs font-black text-slate-600">父系宗亲 <span className="text-slate-400 font-mono">(左)</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full shadow-sm" />
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
                {/* SVG Background Layer */}
                <svg width="1000" height={maxHeight} className="absolute inset-0 pointer-events-none z-0">
                    <defs>
                        <linearGradient id="centerLine" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(234, 179, 8, 0)" />
                            <stop offset="50%" stopColor="rgba(234, 179, 8, 0.3)" />
                            <stop offset="100%" stopColor="rgba(234, 179, 8, 0)" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* 💡 核心精进：房头背景块渲染 */}
                    {pods?.map((pod: any) => (
                        <g key={pod.id}>
                            <rect
                                x={pod.x}
                                y={pod.y}
                                width={pod.width}
                                height={pod.height}
                                rx="40"
                                fill={pod.color}
                                stroke={pod.side === 'paternal' ? 'rgba(234,179,8,0.1)' : 'rgba(168,85,247,0.1)'}
                                strokeWidth="2"
                                className="transition-all duration-700"
                            />
                            {/* 房头标签 */}
                            <text
                                x={pod.x + pod.width / 2}
                                y={pod.y + 25}
                                textAnchor="middle"
                                className="text-[10px] font-black fill-slate-400 uppercase tracking-[0.2em]"
                            >
                                {pod.label}
                            </text>
                        </g>
                    ))}

                    {/* 分界线 */}
                    <line x1="500" y1="50" x2="500" y2={maxHeight - 50} stroke="url(#centerLine)" strokeWidth="6" strokeDasharray="12,12" strokeLinecap="round" />

                    {/* SVG 航线渲染 */}
                    <AnimatePresence>
                        {activePath.length > 1 && (
                            <motion.g
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {activePath.map((node, i) => {
                                    if (i === 0) return null;
                                    const prev = activePath[i - 1];
                                    return (
                                        <motion.path
                                            key={`path-${node.id}`}
                                            d={`M ${prev.mapX} ${prev.mapY} L ${node.mapX} ${node.mapY}`}
                                            stroke={node.logicTag?.includes('[M]') ? '#a855f7' : '#eab308'}
                                            strokeWidth="4"
                                            strokeDasharray="8,8"
                                            fill="none"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.8, delay: i * 0.1 }}
                                            filter="url(#glow)"
                                        />
                                    );
                                })}
                            </motion.g>
                        )}
                    </AnimatePresence>
                </svg>

                {/* Plotting Members */}
                {processedMembers.map(member => {
                    if (member.mapX == null || member.mapY == null) return null;

                    const isMaternal = (member.logicTag || "").includes('[M]');
                    const isSameSurnameMaternal = (member.logicTag || "").includes('!S');
                    const isVirtual = member.member_type === 'virtual' || member.memberType === 'virtual' || member.isGhost;
                    const isSelected = selectedId === member.id;

                    return (
                        <motion.div
                            key={member.id}
                            className="absolute flex flex-col items-center group"
                            style={{
                                left: member.mapX,
                                top: member.mapY,
                                x: '-50%',
                                y: '-50%',
                                zIndex: isSelected ? 40 : 10
                            }}
                        >
                            <div
                                className={`rounded-full border-4 shadow-xl overflow-hidden cursor-pointer hover:scale-110 active:scale-95 transition-all
                                    ${isVirtual ? 'w-16 h-16 border-slate-200 opacity-60 grayscale'
                                        : 'w-24 h-24 ' + (isSelected ? 'ring-4 ring-white ring-offset-4 ring-offset-[#eab308]' : '')}
                                    ${isSameSurnameMaternal ? 'border-transparent !bg-clip-border' : (isMaternal ? 'border-purple-200' : 'border-amber-200')}
                                    bg-white relative
                                `}
                                style={isSameSurnameMaternal ? {
                                    border: '4px solid transparent',
                                    backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #eab308, #a855f7)',
                                    backgroundOrigin: 'border-box',
                                    backgroundClip: 'padding-box, border-box'
                                } : {}}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isVirtual) {
                                        if (isSelected) navigate(`/archive/${member.id}`);
                                        else setSelectedId(member.id);
                                    }
                                }}
                            >
                                <img
                                    src={member.avatarUrl || member.avatar_url || (isVirtual ? (member.gender === 'female' ? '/avatars/female_v.png' : '/avatars/male_v.png') : `https://picsum.photos/seed/${member.id}/200/200`)}
                                    alt={member.name}
                                    className={`w-full h-full object-cover ${isVirtual ? 'opacity-40' : ''}`}
                                    onError={(e: any) => { e.target.src = isVirtual ? `https://ui-avatars.com/api/?name=V&background=f1f5f9&color=cbd5e1` : `https://picsum.photos/seed/${member.id}/200/200`; }}
                                />
                                {(!isVirtual && member.isRegistered) && (
                                    <div className={`absolute bottom-0 inset-x-0 h-4 ${isMaternal ? 'bg-purple-500' : 'bg-emerald-500'} flex justify-center items-center shadow-inner`}>
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                )}
                            </div>

                            <div className={`mt-3 flex flex-col items-center bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-[1.5rem] shadow-lg border relative z-20 transition-all 
                                ${isSelected ? 'scale-110 -translate-y-2 !border-[#eab308] border-2 shadow-[#eab308]/20' : 'group-hover:-translate-y-1'}
                                ${isVirtual ? 'border-slate-100 shadow-none opacity-70 px-3 py-1.5' : (isMaternal ? 'border-purple-100' : 'border-amber-100')}`}
                            >
                                <span className={`font-black whitespace-nowrap ${isVirtual ? 'text-xs text-slate-400 italic' : 'text-xl ' + (isMaternal ? 'text-purple-900' : 'text-slate-800')}`}>{member.name}</span>
                                {(!isVirtual && member.relationship) && (
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5
                                        ${isMaternal ? 'text-purple-500' : 'text-[#eab308]'}
                                    `}>
                                        {member.relationship}
                                    </span>
                                )}
                                {isSelected && member.logicTag && (
                                    <motion.span
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-[10px] font-mono font-bold text-slate-400 mt-2 px-2.5 py-1 bg-slate-100 rounded-lg inset-shadow-sm flex items-center gap-1"
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isMaternal ? 'bg-purple-400' : 'bg-[#eab308]'}`}></span>
                                        {member.logicTag}
                                    </motion.span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};
