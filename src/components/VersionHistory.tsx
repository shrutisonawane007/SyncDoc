'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EditorBlock } from '@/lib/sync/merger';
import { Clock, Plus, RefreshCw, Eye, CornerUpLeft, X } from 'lucide-react';

interface VersionSnapshot {
  id: string;
  version_name: string;
  content_snapshot: string;
  lamport: number;
  created_at: string;
}

interface VersionHistoryProps {
  docId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  blocks: EditorBlock[];
  upsertBlock: (id: string, content: string, type: string, position: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
}

export default function VersionHistory({
  docId,
  role,
  blocks,
  upsertBlock,
  deleteBlock,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Preview State
  const [previewVersion, setPreviewVersion] = useState<VersionSnapshot | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<EditorBlock[]>([]);

  const isReadOnly = role === 'viewer';

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch version snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    let active = true;
    if (docId) {
      const load = async () => {
        await Promise.resolve();
        if (active) {
          fetchVersions();
        }
      };
      load();
    }
    return () => {
      active = false;
    };
  }, [docId, fetchVersions]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim() || isReadOnly) return;

    setSaveLoading(true);
    try {
      const serialized = JSON.stringify(blocks);
      const res = await fetch(`/api/documents/${docId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionName: newVersionName.trim(),
          contentSnapshot: serialized,
          lamport: Date.now(), // Use current timestamp as Lamport checkpoint for snapshots
        }),
      });

      if (res.ok) {
        setNewVersionName('');
        await fetchVersions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save version checkpoint.');
      }
    } catch (err) {
      console.error('Error creating snapshot:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePreview = (version: VersionSnapshot) => {
    try {
      const parsed = JSON.parse(version.content_snapshot) as EditorBlock[];
      setPreviewBlocks(parsed);
      setPreviewVersion(version);
    } catch (err) {
      console.error('Failed to parse version snapshot content:', err);
    }
  };

  const handleRestore = async (version: VersionSnapshot) => {
    if (isReadOnly) return;
    if (!confirm(`Are you sure you want to restore the document to the state of "${version.version_name}"? This will create new operations updating the current document.`)) {
      return;
    }

    try {
      const targetBlocks = JSON.parse(version.content_snapshot) as EditorBlock[];
      
      // Determine what edits are needed to convert active blocks to target blocks
      const targetBlockIds = new Set(targetBlocks.map(tb => tb.id));

      // 1. Delete blocks that exist now but are NOT in the historical snapshot
      for (const cb of blocks) {
        if (!targetBlockIds.has(cb.id)) {
          await deleteBlock(cb.id);
        }
      }

      // 2. Add or update blocks that are in the historical snapshot
      for (const tb of targetBlocks) {
        await upsertBlock(tb.id, tb.content, tb.type, tb.position);
      }

      // Close preview if open
      setPreviewVersion(null);
      alert('Document state successfully restored!');
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
      alert('Failed to restore snapshot: ' + err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Snapshot Form */}
      {!isReadOnly && (
        <form onSubmit={handleCreateSnapshot} className="space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Create Checkpoint
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. V1 - Initial Draft"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-transparent focus:ring-1 focus:ring-orange-500 focus:outline-none"
              disabled={saveLoading}
              required
            />
            <button
              type="submit"
              disabled={saveLoading || !newVersionName.trim()}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors"
            >
              {saveLoading ? (
                <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>
      )}

      {/* Timeline List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Version Timeline
          </label>
          <button 
            onClick={fetchVersions}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Refresh history"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>

        {loading && versions.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading timeline...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No checkpoints saved yet.
          </div>
        ) : (
          <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5">
            {versions.map((ver) => (
              <div key={ver.id} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-white" />
                
                <div>
                  <h4 className="text-xs font-bold text-slate-700 truncate">
                    {ver.version_name}
                  </h4>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(ver.created_at).toLocaleString()}</span>
                  </div>
                  
                  {/* Actions overlay */}
                  <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handlePreview(ver)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold rounded transition-colors cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                    
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRestore(ver)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-600 text-[10px] font-semibold rounded transition-colors cursor-pointer"
                      >
                        <CornerUpLeft className="h-3 w-3" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot Preview Modal Dialog */}
      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-card-border max-w-2xl w-full max-h-[80vh] flex flex-col rounded-2xl shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-card-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Preview: {previewVersion.version_name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Saved on {new Date(previewVersion.created_at).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setPreviewVersion(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {previewBlocks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center">Empty Snapshot</p>
              ) : (
                previewBlocks.map((b) => (
                  <div key={b.id} className="border-b border-slate-50 pb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      {b.type}
                    </span>
                    <p className={`text-slate-700 text-sm whitespace-pre-wrap ${
                      b.type.startsWith('heading') ? 'font-bold' : b.type === 'code-block' ? 'font-mono text-xs bg-slate-50 border border-slate-200 text-slate-800 p-2 rounded' : ''
                    }`}>
                      {b.content || <em className="text-slate-400 text-xs">No text</em>}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-card-border flex justify-end gap-2">
              <button
                onClick={() => setPreviewVersion(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Close Preview
              </button>
              
              {!isReadOnly && (
                <button
                  onClick={() => handleRestore(previewVersion)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CornerUpLeft className="h-3.5 w-3.5" />
                  <span>Restore Snapshot</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
