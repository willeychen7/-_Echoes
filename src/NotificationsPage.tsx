import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCircle2, MessageSquare, Calendar, ChevronRight, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

interface Notification {
    id: number;
    member_id: number;
    title: string;
    content: string;
    type: 'event_comment' | 'archive_comment' | 'system';
    is_read: boolean;
    link_url?: string;
    created_at: string;
}

export const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const saved = localStorage.getItem("currentUser");
        if (saved) {
            const user = JSON.parse(saved);
            setCurrentUser(user);
            fetchNotifications(user.memberId);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchNotifications = async (memberId: number) => {
        if (!memberId) return;
        try {
            const res = await fetch(`/api/notifications/${memberId}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const markAllAsRead = async () => {
        if (!currentUser?.memberId) return;
        try {
            const res = await fetch(`/api/notifications/read-all/${currentUser.memberId}`, {
                method: "PUT"
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            }
        } catch (e) {
            console.error(e);
        }
    };

    // 访问页面时，延迟自动标为已读
    useEffect(() => {
        if (!loading && notifications.some(n => !n.is_read)) {
            const timer = setTimeout(markAllAsRead, 1500);
            return () => clearTimeout(timer);
        }
    }, [loading, notifications.length]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'event_comment': return <Calendar className="text-orange-500" size={20} />;
            case 'archive_comment': return <MessageSquare className="text-blue-500" size={20} />;
            default: return <Bell className="text-purple-500" size={20} />;
        }
    };

    const getBg = (type: string) => {
        switch (type) {
            case 'event_comment': return "bg-orange-50";
            case 'archive_comment': return "bg-blue-50";
            default: return "bg-purple-50";
        }
    };

    return (
        <div className="bg-[#fdfbf0] min-h-full flex flex-col">
            <header className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md px-6 py-5 flex items-center justify-between shadow-sm shrink-0 border-b border-slate-100">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
                    <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
                    <span className="text-lg font-black pr-2">返回</span>
                </button>
                <h1 className="text-xl font-black font-display flex-1 text-center truncate px-2 text-slate-800">
                    消息通知
                </h1>
                <button
                    onClick={markAllAsRead}
                    className="text-sm font-bold text-[#eab308] px-3 py-1 rounded-full hover:bg-[#eab308]/10 transition-colors"
                >
                    全标已读
                </button>
            </header>

            <main className="flex-1 px-6 py-8">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="size-12 rounded-full border-4 border-[#eab308]/20 border-t-[#eab308] animate-spin" />
                            <p className="text-slate-400 font-bold">加载中...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-20 space-y-6 opacity-40"
                        >
                            <div className="size-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                                <Inbox size={48} />
                            </div>
                            <p className="text-xl font-black text-slate-800">暂无新消息</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {notifications.map((notif, i) => (
                                <motion.button
                                    key={notif.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={async () => {
                                        // 1. 先标为已读
                                        if (!notif.is_read) {
                                            fetch(`/api/notifications/${notif.id}/read`, { method: "PUT" }).catch(console.error);
                                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                                        }
                                        // 2. 跳转
                                        if (notif.link_url) navigate(notif.link_url);
                                    }}
                                    className={cn(
                                        "w-full bg-white p-5 rounded-[2rem] border transition-all flex gap-4 text-left group active:scale-[0.98]",
                                        notif.is_read ? "border-slate-100 opacity-80" : "border-[#eab308]/30 shadow-lg shadow-[#eab308]/5"
                                    )}
                                >
                                    <div className={cn("size-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow", getBg(notif.type))}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800 flex-1 truncate">{notif.title}</h4>
                                            {!notif.is_read && <div className="size-2 bg-red-500 rounded-full animate-pulse" />}
                                        </div>
                                        <p className="text-sm text-slate-500 leading-relaxed mb-2">{notif.content}</p>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-200 mt-2" />
                                </motion.button>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};
