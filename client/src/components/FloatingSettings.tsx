import React, { useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import type { GraphState, GraphSettings } from '../types';
import type { ThemeName } from '../App';

interface FloatingSettingsProps {
  sourceWord: string;
  sourceLanguage: string;
  graphState: GraphState;
  updateSettings: (settings: Partial<GraphSettings>) => void;
  onNewSearch: (word: string, language: string) => void;
  onClearGraph: () => void;
  onThemeChange: (theme: ThemeName) => void;
  currentTheme: ThemeName;
  isLoading: boolean;
  nodeCount: number;
  edgeCount: number;
}

const FloatingSettings: React.FC<FloatingSettingsProps> = ({
  sourceWord,
  sourceLanguage,
  graphState,
  updateSettings,
  onNewSearch,
  onClearGraph,
  isLoading,
  nodeCount,
  edgeCount
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && !isExpanded) {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Main floating panel */}
      <div className={`
        fixed top-6 left-6 z-30 transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-80' : 'w-40'}
      `}>
        <div className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden">
          {/* Header */}
          <div className={`${isExpanded ? 'p-5' : 'p-6'}`}>
            {!isExpanded ? (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-16 h-16 flex items-center justify-center transition-all hover:opacity-70"
                  style={{
                    background: 'none',
                    border: 'none'
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    style={{ opacity: 0.8 }}
                  >
                    {/* Outer ring */}
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="1.5"
                    />
                    {/* Inner animated progress ring */}
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeDasharray="63"
                      strokeDashoffset="32"
                      transform="rotate(-90 12 12)"
                      opacity="0.6"
                    />
                    {/* Center dot */}
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="#374151"
                      opacity="0.8"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-8 h-8 flex items-center justify-center transition-all hover:opacity-70"
                  style={{
                    background: 'none',
                    border: 'none'
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    className="transition-transform rotate-180"
                    style={{ opacity: 0.8 }}
                  >
                    {/* Outer ring */}
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="1.5"
                    />
                    {/* Inner animated progress ring */}
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeDasharray="63"
                      strokeDashoffset="32"
                      transform="rotate(-90 12 12)"
                      opacity="0.6"
                    />
                    {/* Center dot */}
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="#374151"
                      opacity="0.8"
                    />
                  </svg>
                </button>
                <div className="flex items-center space-x-2">
                  <div className="text-gray-700 text-sm font-medium">
                    {sourceWord} ({sourceLanguage})
                  </div>
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-5 pb-5 pt-0 space-y-6" style={{ paddingLeft: '8px' }}>
              {/* Search */}
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-3">Search New Word</label>
                <SearchBar
                  onSearch={onNewSearch}
                  isLoading={isLoading}
                />
              </div>

              {/* Graph Settings */}
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-3">Graph Settings</label>
                <div className="space-y-5">
                  <div className="relative">
                    <span className="text-slate-600 text-xs font-medium">Max Neighbors: </span>
                    <span
                      contentEditable
                      suppressContentEditableWarning={true}
                      onKeyDown={(e) => {
                        // Only allow numbers, backspace, delete, and arrow keys
                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                          e.preventDefault();
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onInput={(e) => {
                        const text = e.currentTarget.textContent || '';
                        // Remove any non-digit characters
                        const cleanText = text.replace(/[^0-9]/g, '');

                        if (cleanText !== text) {
                          e.currentTarget.textContent = cleanText;
                          // Move cursor to end
                          const range = document.createRange();
                          const sel = window.getSelection();
                          range.selectNodeContents(e.currentTarget);
                          range.collapse(false);
                          sel?.removeAllRanges();
                          sel?.addRange(range);
                        }

                      }}
                      onBlur={(e) => {
                        const text = e.currentTarget.textContent || '';
                        const value = parseInt(text);
                        if (!isNaN(value) && value >= 1 && value <= 20) {
                          updateSettings({ maxNeighbors: value });
                        } else {
                          // Reset to current valid value if invalid input
                          e.currentTarget.textContent = graphState.settings.maxNeighbors.toString();
                        }
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLSpanElement).style.borderBottom = '2px dotted #6b7280'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLSpanElement).style.borderBottom = 'none'}
                      className="text-slate-700 text-lg font-bold cursor-text"
                    >
                      {graphState.settings.maxNeighbors}
                    </span>
                  </div>
                  <div className="flex items-end gap-6">
                  </div>
                </div>
              </div>

              {/* Graph Stats */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-slate-600 text-xs font-medium mb-2">Graph Statistics</div>
                <div className="text-slate-700 text-sm font-medium">
                  {nodeCount} nodes {'\u2022'} {edgeCount} connections
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2">
                <button
                  onClick={onClearGraph}
                  className="w-full px-4 py-3.5 bg-gray-50/80 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100/80 transition-colors flex items-center justify-center space-x-2 border border-gray-100/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Clear Graph</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
};

export default FloatingSettings;