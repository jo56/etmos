import React from 'react';
import type { Word, EtymologicalConnection } from '../types';

interface WordDetailsPanelProps {
  word: Word | null;
  connections: Array<{
    connection: EtymologicalConnection;
    relatedWord: Word;
  }>;
  onClose: () => void;
}

const WordDetailsPanel: React.FC<WordDetailsPanelProps> = ({
  word,
  connections,
  onClose
}) => {
  if (!word) return null;

  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'nl': 'Dutch',
    'la': 'Latin',
    'gr': 'Greek'
  };

  const relationshipColors: Record<string, string> = {
    'cognate': 'text-green-600',
    'derivative': 'text-blue-600',
    'borrowing': 'text-orange-600',
    'calque': 'text-purple-600',
    'semantic': 'text-gray-600',
    'phonetic': 'text-brown-600'
  };

  const relationshipLabels: Record<string, string> = {
    'cognate': 'Cognate',
    'derivative': 'Derivative',
    'borrowing': 'Borrowing',
    'calque': 'Calque',
    'semantic': 'Semantic',
    'phonetic': 'Phonetic'
  };

  return (
    <div className="fixed right-4 top-4 w-96 bg-white/95 backdrop-blur-md rounded-lg shadow-2xl border border-slate-200 max-h-[calc(100vh-2rem)] overflow-y-auto z-30">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{word.text}</h2>
            <p className="text-sm text-gray-600">
              {languageNames[word.language] || word.language.toUpperCase()}
              {word.partOfSpeech && ` \u2022 ${word.partOfSpeech}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Simplified Connections */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3">
          Related Words ({connections.length})
        </h3>

        {connections.length === 0 ? (
          <p className="text-gray-500 text-sm">No connections found</p>
        ) : (
          <div className="space-y-2">
            {connections.map(({ connection, relatedWord }, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                {/* Simplified related word info - just word and language */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{relatedWord.text}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({languageNames[relatedWord.language] || relatedWord.language})
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${relationshipColors[connection.relationshipType]} bg-gray-100`}>
                    {relationshipLabels[connection.relationshipType]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default WordDetailsPanel;