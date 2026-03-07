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
            className="w-full h-full min-h-[600px] relative bg-[#fdfbf7] overflow-hidden rounded-3xl border-4 border-white shadow-xl"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        >
            {/* Control Panel */}
            <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 glass-morphism p-2 rounded-2xl shadow-lg border border-slate-100/50">
                <button onClick={zoomIn} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors"><ZoomIn size={24} /></button>
                <button onClick={resetZoom} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors"><Maximize2 size={24} /></button>
                <button onClick={zoomOut} className="p-3 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-[#eab308] transition-colors"><ZoomOut size={24} /></button>
            </div>

            {/* Instruction Banner */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 glass-morphism px-6 py-2.5 rounded-full shadow-sm border border-slate-100/50 flex items-center gap-2 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse" />
                <span className="text-sm font-bold text-slate-500 tracking-widest">拖动以探索家族树，点击头像查看档案</span>
            </div>

            {/* Sub-Legend */}
            <div className="absolute top-6 left-6 z-20 glass-morphism p-4 rounded-2xl shadow-sm border border-slate-100/50">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">家族分野</h3>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-[#eab308] rounded-full" />
                        <span className="text-xs font-bold text-slate-600">父系宗亲 (左)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-purple-400 rounded-full" />
                        <span className="text-xs font-bold text-slate-600">母系外家 (右)</span>
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
                            <stop offset="50%" stopColor="rgba(234, 179, 8, 0.2)" />
                            <stop offset="100%" stopColor="rgba(234, 179, 8, 0)" />
                        </linearGradient>
                    </defs>
                    <line x1="500" y1="50" x2="500" y2={maxHeight - 50} stroke="url(#centerLine)" strokeWidth="4" strokeDasharray="10,10" />
                </svg>

                {/* Plotting Members */}
                {members.map(member => {
                    if (member.mapX == null || member.mapY == null) return null;
                    
                    const isMaternal = member.logicTag?.includes('[M]');
                    
                    return (
                        <motion.div
                            key={member.id}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, delay: Math.random() * 0.5 }}
                            className="absolute flex flex-col items-center"
                            style={{
                                left: member.mapX,
                                top: member.mapY,
                                x: '-50%',
                                y: '-50%'
                            }}
                        >
                            <div 
                                className={`w-20 h-20 rounded-full border-4 shadow-xl overflow-hidden cursor-pointer hover:scale-110 active:scale-95 transition-all
                                    ${isMaternal ? 'border-purple-200 shadow-purple-200/50' : 'border-amber-200 shadow-amber-200/50'}
                                    bg-white
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/archive/${member.id}`);
                                }}
                            >
                                <img 
                                    src={member.avatarUrl || member.avatar_url || `https://picsum.photos/seed/${member.name}/200`} 
                                    alt={member.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            
                            <div className="mt-3 flex flex-col items-center bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                                <span className="font-black text-slate-800 text-lg whitespace-nowrap">{member.name}</span>
                                {member.relationship && (
                                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5
                                        ${isMaternal ? 'text-purple-500' : 'text-[#eab308]'}
                                    `}>
                                        {member.relationship}
                                    </span>
                                )}
                                {member.logicTag && (
                                    <span className="text-[8px] font-mono text-slate-300 mt-1 px-2 py-0.5 bg-slate-50 rounded mt-1">
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
