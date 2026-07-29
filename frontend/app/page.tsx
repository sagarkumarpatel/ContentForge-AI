"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CheckCircle2, Copy, Terminal, AlignLeft, Share2, Briefcase, Mail, Sparkles, Check, Menu, X, Trash2, Edit2, Plus, MessageSquare, Clock, LayoutDashboard, GitBranch, Settings, BarChart2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Session {
  id: string;
  topic: string;
  date: number;
  result: any;
  imageUrl: string | null;
  discordPosted: boolean;
  discordPreview?: string | null;
}

const AGENTS = [
  { id: "Topic Analyzer", icon: Search, desc: "Identifies research angles" },
  { id: "Research Agent", icon: Search, desc: "Gathers facts & stats" },
  { id: "SEO Agent", icon: AlignLeft, desc: "Builds keyword outline" },
  { id: "Writer Agent", icon: AlignLeft, desc: "Drafts the blog post" },
  { id: "Editor Agent", icon: CheckCircle2, desc: "Polishes the draft" },
  { id: "Designer Agent", icon: Share2, desc: "Repurposes for social" },
  { id: "Publisher Agent", icon: Mail, desc: "Compiles final package" },
];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("blog");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [discordPosted, setDiscordPosted] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPublishingDiscord, setIsPublishingDiscord] = useState(false);
  const [discordPublishError, setDiscordPublishError] = useState<string | null>(null);
  const [discordPreview, setDiscordPreview] = useState<string | null>(null);

  // Sidebar & History State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTopicValue, setEditTopicValue] = useState("");
  const [particles, setParticles] = useState<{ id: number, x: number, duration: number, delay: number, size: number }[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  };

  // Initialize particles
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      duration: 10 + Math.random() * 20,
      delay: Math.random() * 10,
      size: Math.random() * 3 + 1
    }));
    setParticles(newParticles);
  }, []);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("contentForgeSessions");
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
  }, []);

  // Save to local storage on update
  useEffect(() => {
    localStorage.setItem("contentForgeSessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setLogs([]);
    setActiveAgent("Topic Analyzer");
    setCompletedAgents([]);
    setImageUrl(null);
    setDiscordPosted(false);
    setDiscordPreview(null);
    setImageError(false);
    setActiveSessionId(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);

    try {
      const response = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let finalResult = null;
      let finalImageUrl = null;
      let finalDiscordPosted = false;
      let finalDiscordPreview = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'log') {
                const logContent = data.content;
                setLogs(prev => [...prev, logContent]);

                const cleanLog = logContent.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();

                const agentMatch = cleanLog.match(/Working Agent: (.*?)(?:\s|$)/i) || cleanLog.match(/Agent:\s*(.*?)$/i) || cleanLog.match(/Agent: (.*?)(?:\s|$)/i);
                if (agentMatch) {
                  const agentName = agentMatch[1].trim();
                  const matchedAgent = AGENTS.find(a => a.id.includes(agentName) || agentName.includes(a.id.split(" ")[0]));

                  if (matchedAgent && matchedAgent.id !== activeAgent) {
                    setCompletedAgents(prev => [...new Set([...prev, activeAgent || ""])].filter(Boolean));
                    setActiveAgent(matchedAgent.id);
                  }
                }
              } else if (data.type === 'complete') {
                try {
                  finalResult = JSON.parse(data.content);
                  finalImageUrl = data.image_url || null;
                  finalDiscordPosted = !!data.discord_posted;
                  finalDiscordPreview = data.discord_preview || null;

                  setResult(finalResult);
                  setImageUrl(finalImageUrl);
                  setDiscordPosted(finalDiscordPosted);
                  setDiscordPreview(finalDiscordPreview);

                  // Create new session
                  const newSession: Session = {
                    id: Date.now().toString(),
                    topic,
                    date: Date.now(),
                    result: finalResult,
                    imageUrl: finalImageUrl,
                    discordPosted: finalDiscordPosted,
                    discordPreview: finalDiscordPreview
                  };
                  setSessions(prev => [newSession, ...prev]);
                  setActiveSessionId(newSession.id);

                } catch (e) {
                  console.error("Failed to parse result JSON", e);
                  setLogs(prev => [...prev, "Error parsing final JSON"]);
                }
                setIsRunning(false);
                setActiveAgent(null);
                setCompletedAgents(AGENTS.map(a => a.id));
              } else if (data.type === 'error') {
                setLogs(prev => [...prev, "ERROR: " + data.content]);
                setIsRunning(false);
                setActiveAgent(null);
              }
            } catch (e) {
              // Ignore incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsRunning(false);
      setActiveAgent(null);
    }
  };

  const handlePublishDiscord = async () => {
    setIsPublishingDiscord(true);
    setDiscordPublishError(null);
    try {
      const response = await fetch("http://localhost:8000/publish-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: JSON.stringify(result),
          image_path: imageUrl
        }),
      });
      const data = await response.json();
      if (data.posted) {
        setDiscordPosted(true);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, discordPosted: true } : s));
      } else {
        setDiscordPublishError(data.error || "Failed to post to Discord");
      }
    } catch (error: any) {
      setDiscordPublishError(error.message || "An error occurred");
    } finally {
      setIsPublishingDiscord(false);
    }
  };

  const copyToClipboard = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const loadSession = (session: Session) => {
    setTopic(session.topic);
    setResult(session.result);
    setImageUrl(session.imageUrl);
    setDiscordPosted(session.discordPosted);
    setDiscordPreview(session.discordPreview || null);
    setActiveSessionId(session.id);
    setImageError(false);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const startNewSession = () => {
    setTopic("");
    setResult(null);
    setImageUrl(null);
    setDiscordPosted(false);
    setDiscordPreview(null);
    setActiveSessionId(null);
    setLogs([]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      startNewSession();
    }
  };

  const startEditSession = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTopicValue(session.topic);
  };

  const saveEditSession = (id: string) => {
    if (editTopicValue.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, topic: editTopicValue.trim() } : s));
      if (activeSessionId === id) setTopic(editTopicValue.trim());
    }
    setEditingSessionId(null);
  };

  const renderSocialCard = (content: string, platform: string, icon: any) => {
    const Icon = icon;
    return (
      <div className="glass-card rounded-2xl overflow-hidden max-w-2xl mx-auto">
        {imageUrl && !imageError && (
          <img
            src={imageUrl.startsWith('http') ? imageUrl : `http://localhost:8000${imageUrl}`}
            alt={`${platform} Cover`}
            onError={() => setImageError(true)}
            className="w-full h-48 md:h-64 object-cover border-b border-zinc-800"
          />
        )}
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4 text-indigo-400 text-sm font-medium uppercase tracking-wider">
            <Icon className="w-4 h-4" />
            <span>{platform} Preview</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-zinc-300 bg-transparent p-0 m-0 text-[15px] leading-relaxed">{content}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#05070E] text-zinc-100 selection:bg-indigo-500/30 font-sans overflow-hidden">
      
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F19] to-[#05070E]" />
        
        {/* Hexagon Grid SVG Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'100\' viewBox=\'0 0 60 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg stroke=\'%23ffffff\' stroke-width=\'1\' fill=\'none\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M30 100V50l25.98-15v-30L30 20 4.02 5v30L30 50\'/%3E%3Cpath d=\'M30 0v50L4.02 65v30L30 80l25.98 15V65\'/%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '60px' }} 
        />
        
        {/* Nebula Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[120px]" />

        {/* Particles */}
        {particles.map(p => (
          <div 
            key={p.id}
            className="particle"
            style={{
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              boxShadow: `0 0 ${p.size * 2}px rgba(255, 255, 255, 0.8)`
            }}
          />
        ))}
      </div>

      {/* --- SIDEBAR --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed md:relative z-50 w-72 h-full glass border-r-0 border-white/5 flex flex-col transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
              ContentForge
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="px-4 py-2 space-y-1">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: GitBranch, label: 'Workflows' },
            { icon: Clock, label: 'History' },
            { icon: BarChart2, label: 'Analytics' },
            { icon: Settings, label: 'Settings' },
          ].map(item => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${item.active ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,0.8)]' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-white/5 pt-4 flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Runs</span>
            <button onClick={startNewSession} className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 p-1 rounded-md transition-colors" title="New Session">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {sessions.length === 0 ? (
             <div className="text-center p-4 text-zinc-600 text-sm mt-4">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-20" />
              <p>No history</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${activeSessionId === session.id ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        value={editTopicValue}
                        onChange={e => setEditTopicValue(e.target.value)}
                        onBlur={() => saveEditSession(session.id)}
                        onKeyDown={e => e.key === 'Enter' && saveEditSession(session.id)}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 bg-black/50 border border-indigo-500/50 rounded px-2 py-0.5 text-sm outline-none text-white w-full min-w-0"
                      />
                    ) : (
                      <div className="truncate text-sm font-medium w-full min-w-0">
                        {session.topic}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    <button onClick={(e) => startEditSession(e, session)} className="p-1 text-zinc-500 hover:text-indigo-300 rounded transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => deleteSession(e, session.id)} className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar pb-24">
        {/* Mobile Header Toggle */}
        <div className="md:hidden sticky top-0 z-30 glass border-b border-white/5 p-4 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-white rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">ContentForge</span>
          <div className="w-8" />
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-10 md:pt-20">

          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-indigo-200 drop-shadow-[0_0_15px_rgba(165,180,252,0.5)]">
              ContentForge-AI
            </h1>
            <p className="text-indigo-200/60 text-lg md:text-xl font-medium tracking-wide">
              Multi-Agent AI Content Orchestration Engine
            </p>
          </motion.div>

          {/* 7-Node Network Animation */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-16 relative"
          >
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
              {AGENTS.map((agent, i) => {
                const isActive = activeAgent === agent.id;
                const isComplete = completedAgents.includes(agent.id);
                
                return (
                  <div key={agent.id} className="flex items-center">
                    <div className="flex flex-col items-center gap-2 group cursor-default">
                      <div className={`
                        w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                        ${isActive 
                          ? 'bg-indigo-500/20 border-2 border-indigo-400 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.6)] scale-110' 
                          : isComplete 
                            ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-400' 
                            : 'glass text-zinc-500 group-hover:bg-white/5'}
                      `}>
                        <agent.icon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <span className={`text-[10px] md:text-xs font-medium uppercase tracking-widest ${isActive ? 'text-indigo-300 drop-shadow-[0_0_5px_rgba(165,180,252,0.8)]' : isComplete ? 'text-cyan-400' : 'text-zinc-500'}`}>
                        {agent.id.split(' ')[0]}
                      </span>
                    </div>
                    {i < AGENTS.length - 1 && (
                      <div className="hidden md:block w-8 h-[2px] mx-2 relative overflow-hidden rounded-full bg-white/5">
                        {(isActive || isComplete) && (
                          <motion.div 
                            className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-400"
                            initial={{ x: '-100%' }}
                            animate={{ x: isComplete ? '0%' : ['-100%', '100%'] }}
                            transition={{ duration: isComplete ? 0.3 : 1.5, repeat: isComplete ? 0 : Infinity }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Input Area */}
          {!activeSessionId && (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleGenerate}
              className="relative max-w-3xl mx-auto mb-16"
            >
              <div className={`relative rounded-3xl glass transition-all duration-300 ${isRunning ? 'opacity-50 pointer-events-none' : 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]'} flex flex-col p-2`}>
                <textarea
                  ref={textareaRef}
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    adjustTextareaHeight();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (topic.trim() && !isRunning) {
                        handleGenerate(e);
                      }
                    }
                  }}
                  placeholder="Initiate prompt sequence..."
                  rows={1}
                  style={{ minHeight: '60px', maxHeight: '250px' }}
                  className="w-full bg-transparent py-4 px-4 md:px-6 text-lg md:text-xl outline-none placeholder:text-zinc-600 font-medium tracking-wide resize-none overflow-y-auto custom-scrollbar"
                />

                <div className="flex justify-end pt-2 pr-2">
                  <button
                    type="submit"
                    disabled={isRunning || !topic.trim()}
                    className="px-6 md:px-8 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-[#2563EB] hover:to-[#4338CA] disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_10px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.8)] hover:-translate-y-[2px] flex items-center justify-center gap-2"
                  >
                    {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initialize"}
                  </button>
                </div>
              </div>
            </motion.form>
          )}

          {/* Loading Logs */}
          <AnimatePresence>
            {isRunning && !result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="max-w-4xl mx-auto mb-16 glass-card rounded-3xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  <span className="text-sm font-bold text-cyan-400 tracking-wider uppercase">System Output Stream</span>
                </div>
                <div className="bg-[#02040A] rounded-2xl border border-white/5 p-5 font-mono text-[13px] text-zinc-400 h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
                  {logs.map((log, i) => (
                    <div key={i} className="mb-1.5 break-words">
                      <span className="text-indigo-500 font-bold mr-3">{'>'}</span>
                      <span className="opacity-90">{log}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Area */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto"
              >
                <div className="glass-card rounded-3xl overflow-hidden">
                  {/* Header */}
                  <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-start flex-wrap gap-4 mb-3">
                      <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">{result.title || "Content Package Synthesized"}</h2>
                      {discordPosted && (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                          <CheckCircle2 className="w-4 h-4" />
                          Broadcasted
                        </div>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-3xl">{result.summary || "Generated successfully by your AI crew."}</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex overflow-x-auto border-b border-white/5 bg-black/20 custom-scrollbar">
                    {[
                      { id: 'blog', label: 'Article Data', icon: AlignLeft },
                      { id: 'twitter', label: 'Thread Sync', icon: Share2 },
                      { id: 'linkedin', label: 'Professional Node', icon: Briefcase },
                      { id: 'email', label: 'Broadcast', icon: Mail },
                      { id: 'discord', label: 'Discord', icon: MessageSquare }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap
                          ${activeTab === tab.id
                            ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10 shadow-[inset_0_-2px_10px_rgba(99,102,241,0.2)]'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                          }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="p-6 md:p-10 min-h-[500px]">
                    <div className="flex justify-end mb-6">
                      <button
                        onClick={() => {
                          const content = activeTab === 'blog' ? result.blog_post :
                            activeTab === 'twitter' ? result.twitter_thread :
                              activeTab === 'linkedin' ? result.linkedin_post :
                                result.email_blurb;
                          copyToClipboard(content, activeTab);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 hover:border-white/20"
                      >
                        {copiedTab === activeTab ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                        {copiedTab === activeTab ? <span className="text-emerald-400">Copied</span> : <span>Extract</span>}
                      </button>
                    </div>

                    <div className="prose prose-invert prose-indigo max-w-none prose-lg">
                      {activeTab === 'blog' && <ReactMarkdown>{result.blog_post}</ReactMarkdown>}
                      {activeTab === 'twitter' && renderSocialCard(result.twitter_thread, 'Twitter', Share2)}
                      {activeTab === 'linkedin' && renderSocialCard(result.linkedin_post, 'LinkedIn', Briefcase)}
                      {activeTab === 'email' && renderSocialCard(result.email_blurb, 'Email', Mail)}
                      {activeTab === 'discord' && (
                        <div className="flex flex-col items-center">
                          {renderSocialCard(discordPreview || result.discord_preview || result.summary || result.title || "Discord Preview", 'Discord', MessageSquare)}
                          <div className="mt-8 flex flex-col items-center">
                            {discordPosted ? (
                              <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/20">
                                <CheckCircle2 className="w-5 h-5" />
                                Posted to Discord
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={handlePublishDiscord}
                                  disabled={isPublishingDiscord}
                                  className="px-8 py-3 bg-gradient-to-r from-[#5865F2] to-[#4752C4] hover:from-[#4752C4] hover:to-[#3C45A5] disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-[0_0_15px_rgba(88,101,242,0.5)] hover:shadow-[0_0_25px_rgba(88,101,242,0.8)] hover:-translate-y-[2px] flex items-center justify-center gap-2"
                                >
                                  {isPublishingDiscord ? <Loader2 className="w-5 h-5 animate-spin" /> : "Approve & Post to Discord"}
                                </button>
                                {discordPublishError && (
                                  <p className="mt-3 text-red-400 text-sm font-medium">{discordPublishError}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
