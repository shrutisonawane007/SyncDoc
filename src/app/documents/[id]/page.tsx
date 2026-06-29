'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDocument } from '@/hooks/useDocument';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import BlockEditor from '@/components/BlockEditor';
import VersionHistory from '@/components/VersionHistory';
import { 
  ArrowLeft, LogOut, Users, Clock, Sparkles, 
  Send, UserPlus, Globe, WifiOff, RefreshCw, AlertCircle, FileText
} from 'lucide-react';

export default function DocumentWorkspace() {
  const { id: docId } = useParams() as { id: string };
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [rightPanelTab, setRightPanelTab] = useState<'versions' | 'ai'>('versions');
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'collaborators' | 'timeline' | 'ai'>('editor');
  
  interface Collaborator {
    user_id: string;
    email: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
  }
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<'editor' | 'viewer'>('editor');
  const [collabLoading, setCollabLoading] = useState(false);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'ai'; text: string }[]>([]);
  const [aiWorking, setAiWorking] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const {
    document: doc,
    syncStatus,
    updateTitle,
    upsertBlock,
    deleteBlock,
    forceSync,
    clientId,
  } = useDocument(docId, user?.id || null);

  const [localTitle, setLocalTitle] = useState('');
  useEffect(() => {
    let active = true;
    if (doc && doc.title !== localTitle) {
      Promise.resolve().then(() => {
        if (active) {
          setLocalTitle(doc.title);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [doc, localTitle]);

  // verify and cache server state
  useEffect(() => {
    if (authLoading || !user || !docId) return;

    async function verifyAccessAndCache() {
      if (!navigator.onLine) return;

      try {
        const res = await fetch(`/api/documents/${docId}`);
        if (res.ok) {
          const data = await res.json();
          const d = data.document;
          
          await db.documents.put({
            id: d.id,
            title: d.title,
            ownerId: d.owner_id,
            version: d.version,
            lastCompactedLamport: d.last_compacted_lamport,
            updatedAt: new Date(d.updated_at).getTime(),
            isOfflineCreated: false,
            role: d.role,
          });
        } else {
          if (res.status === 401) {
            router.push('/auth');
            return;
          }
          
          if (res.status === 403) {
            console.error('Access denied or document not found on the server.');
            alert('Access denied: You do not have permission to view this document, or it has been deleted.');
            
            // clear cached data if unauthorized
            await db.documents.delete(docId);
            await db.operations.where('docId').equals(docId).delete();
            await db.syncQueue.where('docId').equals(docId).delete();
            await db.versions.where('docId').equals(docId).delete();
            
            router.push('/');
          } else {
            console.error('Document check returned status:', res.status);
            router.push('/');
          }
        }
      } catch (err) {
        console.error('Failed to verify document access with server:', err);
      }
    }

    verifyAccessAndCache();
  }, [docId, authLoading, user, router]);

  const fetchCollaboratorsList = useCallback(async () => {
    if (!docId || navigator.onLine === false) return;
    try {
      const res = await fetch(`/api/documents/${docId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators || []);
      }
    } catch (err) {
      console.error('Failed to fetch collaborators:', err);
    }
  }, [docId]);

  useEffect(() => {
    let active = true;
    if (docId && navigator.onLine) {
      const load = async () => {
        await Promise.resolve();
        if (active) {
          fetchCollaboratorsList();
        }
      };
      load();
    }
    return () => {
      active = false;
    };
  }, [docId, fetchCollaboratorsList]);

  // auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-500 font-medium">Checking workspace session...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background min-h-screen">
        <div className="flex flex-col items-center gap-3 text-center p-6 max-w-sm">
          <AlertCircle className="h-12 w-12 text-slate-300 animate-pulse" />
          <h2 className="text-base font-bold text-slate-700">Initializing document sync</h2>
          <p className="text-xs text-slate-400">Please wait while we set up the offline synchronization state cache...</p>
        </div>
      </div>
    );
  }

  const role = (doc.ownerId === user.id ? 'owner' : doc.role || 'viewer') as 'owner' | 'editor' | 'viewer';
  const isReadOnly = role === 'viewer';

  const handleTitleBlur = () => {
    if (isReadOnly) return;
    if (localTitle.trim() && localTitle !== doc.title) {
      updateTitle(localTitle.trim());
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim() || role !== 'owner') return;

    setCollabLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: collabEmail.toLowerCase().trim(),
          role: collabRole,
        }),
      });

      if (res.ok) {
        setCollabEmail('');
        await fetchCollaboratorsList();
        alert('Collaborator added successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to invite collaborator.');
      }
    } catch (err) {
      console.error('Invite failed:', err);
      alert('An unexpected error occurred during invite.');
    } finally {
      setCollabLoading(false);
    }
  };

  // block autocomplete
  const triggerBlockAutocomplete = async (blockId: string, content: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/documents/${docId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autocomplete',
          blockContent: content,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.result;
      }
      return null;
    } catch (err) {
      console.error('Autocomplete request failed:', err);
      return null;
    }
  };

  // summarize document
  const handleSummarizeDocument = async () => {
    if (aiWorking) return;
    
    const fullDocText = doc.blocks.map(b => b.content).join('\n\n');
    if (!fullDocText.trim()) {
      alert('Cannot summarize an empty document.');
      return;
    }

    setAiWorking(true);
    try {
      const res = await fetch(`/api/documents/${docId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize',
          documentContent: fullDocText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSummaryText(data.result);
      } else {
        alert('Summarization failed.');
      }
    } catch (err) {
      console.error('AI summary failed:', err);
    } finally {
      setAiWorking(false);
    }
  };

  // chat with AI about document content
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || aiWorking) return;

    const userMsg = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setAiWorking(true);

    const fullDocText = doc.blocks.map(b => b.content).join('\n\n');

    try {
      const res = await fetch(`/api/documents/${docId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          documentContent: fullDocText || '[Empty Document]',
          message: userMsg,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.result }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'ai', text: 'Error: AI assistant could not parse request.' }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Network Error: Failed to connect to AI server.' }]);
    } finally {
      setAiWorking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-br from-orange-50/80 via-slate-50 to-orange-100/50 relative overflow-hidden">
      {/* Simple ambient light orange/gold gradient color background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-orange-100/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(216,180,106,0.02),transparent_40%)]" />
      </div>
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-card-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          {/* Document Title input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              disabled={isReadOnly}
              className={`text-base font-bold bg-transparent border-none focus:outline-none focus:ring-0 max-w-[200px] sm:max-w-xs md:max-w-md ${
                isReadOnly ? 'cursor-default' : 'hover:bg-slate-100 rounded px-1'
              }`}
              placeholder="Untitled Document"
            />
            
            {/* User Access Role Badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
              role === 'owner' 
                ? 'bg-red-50 text-red-600' 
                : role === 'editor' 
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-slate-100 text-slate-500'
            }`}>
              {role}
            </span>
          </div>
        </div>

        {/* Sync & Connection Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
            syncStatus === 'connected' 
              ? 'bg-emerald-50 text-emerald-600' 
              : syncStatus === 'syncing' 
                ? 'bg-orange-50 text-orange-600 animate-pulse'
                : syncStatus === 'offline'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-600'
          }`}>
            {syncStatus === 'connected' && <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            {syncStatus === 'syncing' && <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />}
            {syncStatus === 'offline' && <WifiOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            {syncStatus === 'error' && <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            <span className="hidden sm:inline ml-0.5">{syncStatus}</span>
          </div>

          <button
            onClick={() => forceSync()}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            title="Force Sync"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>

          <button
            onClick={logout}
            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-full relative z-10">
        {/* Left Panel: Collaborators list (collapsible on mobile) */}
        <aside className={`w-full lg:w-64 bg-sidebar-bg text-sidebar-text border-b lg:border-b-0 lg:border-r border-sidebar-border p-5 pb-20 lg:pb-5 flex flex-col justify-between shrink-0 overflow-y-auto lg:max-h-none ${
          activeMobileTab === 'collaborators' ? 'flex flex-1 max-h-none' : 'hidden lg:flex'
        }`}>
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-sidebar-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Collaborators
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold">
                      O
                    </div>
                    <span className="font-semibold text-slate-200">Document Owner</span>
                  </div>
                  <span className="text-[10px] text-sidebar-muted italic">owner</span>
                </div>
                
                {collaborators.map((c) => (
                  <div key={c.user_id} className="flex items-center justify-between text-xs py-1 border-t border-slate-700/50 pt-1">
                    <div className="flex items-center gap-2 truncate">
                      <div className="h-6 w-6 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-300 truncate" title={c.email}>
                        {c.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-sidebar-muted shrink-0">{c.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Collaborator (Owners only) */}
            {role === 'owner' && navigator.onLine && (
              <div className="border-t border-slate-700/50 pt-4">
                <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1">
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite Collaborator
                </h4>
                <form onSubmit={handleInviteCollaborator} className="space-y-2">
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-sidebar-border rounded bg-slate-800/50 text-white focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    disabled={collabLoading}
                    required
                  />
                  <div className="flex gap-2">
                    <select
                      value={collabRole}
                      onChange={(e) => setCollabRole(e.target.value as 'editor' | 'viewer')}
                      className="text-[10px] border border-sidebar-border rounded px-1.5 bg-slate-800/80 text-slate-200 outline-none flex-1"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      disabled={collabLoading || !collabEmail.trim()}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      {collabLoading ? 'Sending...' : 'Invite'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
          
          <div className="hidden lg:block text-[10px] text-sidebar-muted font-mono mt-8 border-t border-slate-700/50 pt-4">
            Client ID: {clientId.substring(0, 12)}...
          </div>
        </aside>

        {/* Middle Column: Document Editor Canvas */}
        <main className={`flex-1 overflow-y-auto px-6 py-8 pb-20 sm:px-12 bg-white/95 relative z-10 lg:max-h-none ${
          activeMobileTab === 'editor' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-semibold text-orange-600 tracking-wider uppercase mb-1">
                Document Canvas
              </h2>
              <p className="text-xs text-slate-400">
                Type directly into blocks. Changes save locally instantly and synchronize in the background.
              </p>
            </div>
            
            {/* Editor Interface */}
            <BlockEditor
              blocks={doc.blocks}
              upsertBlock={upsertBlock}
              deleteBlock={deleteBlock}
              role={role}
              onTriggerAutocomplete={triggerBlockAutocomplete}
            />
          </div>
        </main>

        {/* Right Column: Tabbed controls for Versions and AI Assistant */}
        <aside className={`w-full lg:w-80 bg-sidebar-bg text-sidebar-text border-t lg:border-t-0 lg:border-l border-sidebar-border flex flex-col overflow-hidden lg:max-h-none relative z-10 ${
          activeMobileTab === 'timeline' || activeMobileTab === 'ai' ? 'flex flex-1 max-h-none' : 'hidden lg:flex'
        }`}>
          {/* Tabs header */}
          <div className="flex border-b border-sidebar-border shrink-0 bg-slate-800/40">
            <button
              onClick={() => setRightPanelTab('versions')}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightPanelTab === 'versions'
                  ? 'border-orange-500 text-orange-400 bg-slate-800/20'
                  : 'border-transparent text-sidebar-muted hover:text-sidebar-text'
              }`}
            >
              <Clock className="h-4 w-4" />
              Timeline
            </button>
            <button
              onClick={() => setRightPanelTab('ai')}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightPanelTab === 'ai'
                  ? 'border-orange-500 text-orange-400 bg-slate-800/20'
                  : 'border-transparent text-sidebar-muted hover:text-sidebar-text'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              AI Assistant
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-5 pb-20 lg:pb-5">
            {rightPanelTab === 'versions' ? (
              <VersionHistory
                docId={docId}
                userId={user.id}
                role={role}
                blocks={doc.blocks}
                upsertBlock={upsertBlock}
                deleteBlock={deleteBlock}
              />
            ) : (
              <div className="space-y-6">
                {/* AI Summarizer */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-sidebar-muted uppercase tracking-wider">
                    Document Summarizer
                  </label>
                  <button
                    onClick={handleSummarizeDocument}
                    disabled={aiWorking || doc.blocks.length === 0}
                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {aiWorking ? (
                      <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>Summarize Document</span>
                  </button>

                  {summaryText && (
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap select-text">
                      {summaryText}
                    </div>
                  )}
                </div>

                {/* AI Chat Assistant */}
                <div className="space-y-3 border-t border-slate-700/50 pt-4 flex flex-col h-[280px]">
                  <label className="block text-xs font-bold text-sidebar-muted uppercase tracking-wider shrink-0">
                    Ask Gemini about Doc
                  </label>
                  
                  {/* Chat dialog logs */}
                  <div className="flex-1 overflow-y-auto bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 space-y-2 select-text">
                    {chatHistory.length === 0 ? (
                      <div className="text-[10px] text-sidebar-muted text-center py-8">
                        Ask questions about the document formatting, contents, or topics.
                      </div>
                    ) : (
                      chatHistory.map((chat, idx) => (
                        <div key={idx} className={`text-xs p-2 rounded-lg ${
                          chat.sender === 'user'
                            ? 'bg-orange-500/10 text-orange-400 text-right ml-6 border border-orange-500/20'
                            : 'bg-slate-800 border border-slate-700 text-slate-200 mr-6'
                        }`}>
                          <div className="font-semibold text-[9px] text-sidebar-muted mb-0.5 uppercase tracking-wide">
                            {chat.sender === 'user' ? 'You' : 'Gemini'}
                          </div>
                          <span className="whitespace-pre-wrap">{chat.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Ask AI..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-sidebar-border rounded-lg bg-slate-800/50 text-white focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      disabled={aiWorking}
                      required
                    />
                    <button
                      type="submit"
                      disabled={aiWorking || !chatMessage.trim()}
                      className="p-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Fixed Mobile Tab Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-card-border py-3 px-4 flex items-center justify-around z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] select-none">
        <button
          onClick={() => setActiveMobileTab('editor')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeMobileTab === 'editor' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText className="h-5 w-5" />
          <span>Editor</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('collaborators')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeMobileTab === 'collaborators' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="h-5 w-5" />
          <span>People</span>
        </button>
        <button
          onClick={() => {
            setActiveMobileTab('timeline');
            setRightPanelTab('versions');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeMobileTab === 'timeline' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span>Timeline</span>
        </button>
        <button
          onClick={() => {
            setActiveMobileTab('ai');
            setRightPanelTab('ai');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeMobileTab === 'ai' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Sparkles className="h-5 w-5" />
          <span>AI Assistant</span>
        </button>
      </div>

      {/* Footer details (Hidden on mobile) */}
      <footer className="hidden lg:block border-t border-card-border bg-white py-6 px-6 text-center text-xs text-slate-500 shrink-0 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono">
            &copy; 2026 SyncDoc. All Rights Reserved. Built by Shruti Sonawane.
          </div>
          <div className="flex items-center gap-6 font-medium">
            <span className="font-semibold text-slate-700">Developer: Shruti Sonawane</span>
            <a 
              href="https://github.com/shrutisonawane007" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 hover:text-orange-600 transition-colors"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              <span>GitHub</span>
            </a>
            <a 
              href="https://www.linkedin.com/in/shruti-sonawane-231550388/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 hover:text-orange-600 transition-colors"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
