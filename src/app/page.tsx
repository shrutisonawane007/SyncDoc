'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { syncEngine } from '@/lib/sync/syncEngine';
import { 
  FileText, Plus, LogOut, Clock, 
  Trash2, Globe, WifiOff, FileCheck, Share2
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [newTitle, setNewTitle] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState<'connected' | 'offline' | 'error'>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine ? 'connected' : 'offline';
    }
    return 'offline';
  });

  // track network connection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const onOnline = () => setDashboardStatus('connected');
      const onOffline = () => setDashboardStatus('offline');
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  }, []);

  const localDocuments = useLiveQuery(() => 
    db.documents.toArray().then(arr => arr.sort((a, b) => b.updatedAt - a.updatedAt))
  );

  // sync doc metadata when online
  useEffect(() => {
    if (loading || !user || dashboardStatus === 'offline') return;

    async function fetchRemoteDocs() {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          const data = await res.json();
          const remoteDocs = data.documents;

          // don't overwrite docs with pending offline changes
          for (const doc of remoteDocs) {
            const local = await db.documents.get(doc.id);
            if (!local || !local.isOfflineCreated) {
              await db.documents.put({
                id: doc.id,
                title: doc.title,
                ownerId: doc.owner_id,
                version: doc.version,
                lastCompactedLamport: Number(doc.last_compacted_lamport),
                updatedAt: new Date(doc.updated_at).getTime(),
                isOfflineCreated: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync remote documents list:', err);
      }
    }

    fetchRemoteDocs();
  }, [loading, user, dashboardStatus]);

  // auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreateLoading(true);
    const newDocId = crypto.randomUUID();

    try {
      // optimistic local insert
      await db.documents.put({
        id: newDocId,
        title: newTitle.trim(),
        ownerId: user.id,
        version: 1,
        lastCompactedLamport: 0,
        updatedAt: Date.now(),
        isOfflineCreated: true,
      });

      setNewTitle('');
      router.push(`/documents/${newDocId}`);

      // trigger background sync
      syncEngine.triggerSync(newDocId);
    } catch (err) {
      console.error('Failed to create local document:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, isOffline: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) {
      return;
    }

    try {
      await db.documents.delete(docId);
      await db.operations.where('docId').equals(docId).delete();
      await db.syncQueue.where('docId').equals(docId).delete();

      if (dashboardStatus !== 'offline' && !isOffline) {
        await fetch(`/api/documents/${docId}`, {
          method: 'DELETE',
        });
      }
    } catch (err) {
      console.error('Error deleting document:', err);
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
      <header className="sticky top-0 z-30 glass-panel border-b border-card-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 text-white p-2 rounded-lg">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SyncDoc</h1>
            <p className="text-xs text-slate-500 font-medium">Local-First Document Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            dashboardStatus === 'connected' 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-amber-50 text-amber-600'
          }`}>
            {dashboardStatus === 'connected' ? (
              <>
                <Globe className="h-3.5 w-3.5" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline Mode</span>
              </>
            )}
          </div>

          {/* User Details */}
          <div className="flex items-center gap-2 pl-2 border-l border-card-border">
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left text-xs">
              <div className="font-semibold text-slate-700">{user.name}</div>
              <div className="text-slate-400 max-w-[120px] truncate">{user.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-500 hover:text-slate-900 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 space-y-8 animate-fade-in relative z-10">
        {/* Create Document Section */}
        <section className="bg-white border border-card-border p-6 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Create a new document</h2>
          <form onSubmit={handleCreateDocument} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter document title... (e.g. Project Specs, Technical Design)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 px-4 py-3 border border-card-border rounded-xl bg-transparent text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
              disabled={createLoading}
              required
            />
            <button
              type="submit"
              disabled={createLoading || !newTitle.trim()}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {createLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Workspace</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Documents Workspace Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Your Documents</h2>
          
          {!localDocuments ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-40 bg-white border border-card-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : localDocuments.length === 0 ? (
            <div className="text-center py-16 bg-white border border-card-border rounded-2xl">
              <FileCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No documents yet. Create one above to start collaborating!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {localDocuments.map((doc) => {
                const isOwner = doc.ownerId === user.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="group bg-white border border-card-border hover:border-orange-500/50 hover:shadow-md p-5 rounded-2xl flex flex-col justify-between h-44 transition-all cursor-pointer relative"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl">
                          <FileText className="h-5 w-5" />
                        </div>
                        
                        <div className="flex gap-2">
                          {doc.isOfflineCreated && (
                            <span className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <WifiOff className="h-3 w-3" />
                              Unsynced
                            </span>
                          )}
                          {!isOwner && (
                            <span className="flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Share2 className="h-3 w-3" />
                              Shared
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                      </div>
                      
                      {isOwner && (
                        <button
                          onClick={(e) => handleDeleteDocument(doc.id, doc.isOfflineCreated, e)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer Details */}
      <footer className="border-t border-card-border bg-white py-8 px-6 mt-16 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono">
            &copy; 2026 SyncDoc. All Rights Reserved. Built by Shruti Sonawane.
          </div>
          <div className="flex items-center gap-6 font-medium">
            <span className="font-semibold text-slate-700">Developer: Shruti Sonawane</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
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
