'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EditorBlock } from '@/lib/sync/merger';
import { getMiddlePosition } from '@/lib/sync/position';
import { 
  ChevronUp, ChevronDown, Trash, 
  Sparkles, Plus 
} from 'lucide-react';

interface BlockEditorProps {
  blocks: EditorBlock[];
  upsertBlock: (id: string, content: string, type: string, position: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  role: 'owner' | 'editor' | 'viewer';
  onTriggerAutocomplete: (blockId: string, text: string) => Promise<string | null>;
}

export default function BlockEditor({
  blocks,
  upsertBlock,
  deleteBlock,
  role,
  onTriggerAutocomplete,
}: BlockEditorProps) {
  const isReadOnly = role === 'viewer';

  const handleAddBlock = async (index: number) => {
    if (isReadOnly) return;
    
    const prevBlock = index >= 0 ? blocks[index] : null;
    const nextBlock = index + 1 < blocks.length ? blocks[index + 1] : null;
    
    const prevPos = prevBlock ? prevBlock.position : null;
    const nextPos = nextBlock ? nextBlock.position : null;
    
    const newPos = getMiddlePosition(prevPos, nextPos);
    const newId = 'block_' + Math.random().toString(36).substring(2, 15);
    
    await upsertBlock(newId, '', 'paragraph', newPos);
  };

  const handleMoveBlock = async (index: number, direction: 'up' | 'down') => {
    if (isReadOnly) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const block = blocks[index];
    let newPos = '';

    if (direction === 'up') {
      const prevBlock = blocks[index - 1];
      const prevPrevBlock = index - 2 >= 0 ? blocks[index - 2] : null;
      
      const prevPrevPos = prevPrevBlock ? prevPrevBlock.position : null;
      const prevPos = prevBlock.position;
      
      newPos = getMiddlePosition(prevPrevPos, prevPos);
    } else {
      const nextBlock = blocks[index + 1];
      const nextNextBlock = index + 2 < blocks.length ? blocks[index + 2] : null;
      
      const nextPos = nextBlock.position;
      const nextNextPos = nextNextBlock ? nextNextBlock.position : null;
      
      newPos = getMiddlePosition(nextPos, nextNextPos);
    }

    await upsertBlock(block.id, block.content, block.type, newPos);
  };

  return (
    <div className="space-y-6">
      {blocks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-300 rounded-2xl p-6">
          <p className="text-sm text-slate-500 mb-4">This document has no content yet.</p>
          {!isReadOnly && (
            <button
              onClick={() => handleAddBlock(-1)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 mx-auto transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add First Block</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, idx) => (
            <div key={block.id} className="group relative flex items-start gap-3">
              {/* Left drag-like controls (hidden for viewers) */}
              {!isReadOnly && (
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0 pt-2 select-none">
                  <button
                    onClick={() => handleMoveBlock(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100 rounded transition-colors"
                    title="Move block up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMoveBlock(idx, 'down')}
                    disabled={idx === blocks.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100 rounded transition-colors"
                    title="Move block down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Editable Block Content Area */}
              <div className="flex-1">
                <BlockItem
                  block={block}
                  upsertBlock={upsertBlock}
                  isReadOnly={isReadOnly}
                  onTriggerAutocomplete={onTriggerAutocomplete}
                />
              </div>

              {/* Right side contextual options (hidden for viewers) */}
              {!isReadOnly && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0 pt-2">
                  {/* Block Type selector */}
                  <select
                    value={block.type}
                    onChange={async (e) => {
                      await upsertBlock(block.id, block.content, e.target.value, block.position);
                    }}
                    className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white text-slate-600 outline-none"
                  >
                    <option value="paragraph">Text</option>
                    <option value="heading-1">Title H1</option>
                    <option value="heading-2">Sub H2</option>
                    <option value="list-item">Bullet list</option>
                    <option value="code-block">Code box</option>
                  </select>

                  <button
                    onClick={async () => {
                      await deleteBlock(block.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete block"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Bottom quick append button */}
          {!isReadOnly && (
            <button
              onClick={() => handleAddBlock(blocks.length - 1)}
              className="w-full py-2 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-4"
            >
              <Plus className="h-4 w-4" />
              <span>Add block</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Individual block editor item
interface BlockItemProps {
  block: EditorBlock;
  upsertBlock: (id: string, content: string, type: string, position: string) => Promise<void>;
  isReadOnly: boolean;
  onTriggerAutocomplete: (blockId: string, text: string) => Promise<string | null>;
}

function BlockItem({ block, upsertBlock, isReadOnly, onTriggerAutocomplete }: BlockItemProps) {
  const [localContent, setLocalContent] = useState(block.content);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const textareaId = `textarea-${block.id}`;

  // sync if we aren't focused/typing
  useEffect(() => {
    let active = true;
    const el = document.getElementById(textareaId);
    if (document.activeElement !== el && block.content !== localContent) {
      Promise.resolve().then(() => {
        if (active) {
          setLocalContent(block.content);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [block.content, textareaId, localContent]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // auto-grow textarea height
  useEffect(() => {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const resize = () => {
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight + 4}px`;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [localContent, textareaId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // debounce DB operations
    debounceTimer.current = setTimeout(() => {
      upsertBlock(block.id, val, block.type, block.position);
    }, 1000);
  };

  const handleBlur = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (localContent !== block.content) {
      upsertBlock(block.id, localContent, block.type, block.position);
    }
  };

  const handleAIAutocomplete = async () => {
    if (isReadOnly || aiLoading) return;
    setAiLoading(true);
    
    const suggestedText = await onTriggerAutocomplete(block.id, localContent);
    if (suggestedText) {
      const mergedText = localContent.trim() + (localContent.endsWith(' ') ? '' : ' ') + suggestedText.trim();
      setLocalContent(mergedText);
      await upsertBlock(block.id, mergedText, block.type, block.position);
    }
    
    setAiLoading(false);
  };

  const getStyleClasses = () => {
    switch (block.type) {
      case 'heading-1':
        return 'text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight';
      case 'heading-2':
        return 'text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-tight';
      case 'list-item':
        return 'text-sm sm:text-base text-slate-700 list-disc list-inside pl-2 leading-relaxed';
      case 'code-block':
        return 'text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 p-4 rounded-xl block leading-normal w-full overflow-x-auto';
      default: // paragraph
        return 'text-sm sm:text-base text-slate-700 leading-relaxed';
    }
  };

  // render plain text elements in viewer mode
  if (isReadOnly) {
    const renderedContent = localContent.trim() === '' ? (
      <span className="text-slate-300 italic select-none">Empty block</span>
    ) : (
      localContent
    );

    const baseStyle = `w-full py-1.5 select-text break-words whitespace-pre-wrap ${getStyleClasses()} ${
      block.type === 'list-item' ? 'pl-6' : 'px-1'
    }`;

    return (
      <div className="relative w-full">
        {block.type === 'list-item' && (
          <span className="text-slate-400 absolute left-2 top-2 font-bold text-lg select-none">•</span>
        )}
        {block.type === 'heading-1' && <h1 className={baseStyle}>{renderedContent}</h1>}
        {block.type === 'heading-2' && <h2 className={baseStyle}>{renderedContent}</h2>}
        {block.type === 'list-item' && <div className={baseStyle}>{renderedContent}</div>}
        {block.type === 'code-block' && (
          <pre className={baseStyle} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <code>{localContent || ' '}</code>
          </pre>
        )}
        {block.type !== 'heading-1' && block.type !== 'heading-2' && block.type !== 'list-item' && block.type !== 'code-block' && (
          <p className={baseStyle}>{renderedContent}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative group/item flex flex-col w-full">
      <div className="relative flex items-center w-full">
        {block.type === 'list-item' && (
          <span className="text-slate-400 absolute left-2 top-2.5 font-bold text-lg select-none">•</span>
        )}
        
        <textarea
          id={textareaId}
          rows={1}
          value={localContent}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isReadOnly}
          className={`w-full bg-transparent resize-none border-none py-1.5 focus:outline-none focus:ring-0 select-text ${getStyleClasses()} ${
            block.type === 'list-item' ? 'pl-6' : 'px-1'
          } ${isReadOnly ? 'cursor-default' : ''}`}
          placeholder={
            block.type.startsWith('heading') 
              ? 'Heading' 
              : block.type === 'code-block' 
                ? 'write your code log here...' 
                : 'Write something here...'
          }
        />
      </div>

      {/* autocomplete trigger */}
      {!isReadOnly && localContent.trim().length > 3 && (
        <div className="flex justify-end h-0 overflow-visible opacity-0 group-hover/item:opacity-100 transition-opacity select-none">
          <button
            onClick={handleAIAutocomplete}
            disabled={aiLoading}
            className="z-10 p-1 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 rounded-lg flex items-center gap-1 text-[10px] font-semibold cursor-pointer border border-orange-200/50 shadow-sm mr-2 mt-0.5"
            title="Autocomplete text with Gemini"
          >
            {aiLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Autocomplete</span>
          </button>
        </div>
      )}
    </div>
  );
}
