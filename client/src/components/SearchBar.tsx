import React, { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (word: string, language: string) => void;
  isLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading = false
}) => {
  const [word, setWord] = useState('');
  const language = 'en'; // Fixed to English only

  const handleSearch = useCallback(() => {
    if (word.trim().length > 0) {
      onSearch(word.trim(), language);
    }
  }, [onSearch, word, language]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };


  return (
    <div className="w-full max-w-lg mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="enter a word"
            className="w-full px-6 py-4 text-lg border-0 rounded-lg bg-white/60 backdrop-blur-sm focus:outline-none focus:bg-white/80 transition-all duration-200 placeholder-gray-400 shadow-sm"
            style={{
              color: '#374151',
              fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', sans-serif",
              fontWeight: '400'
            }}
            disabled={isLoading}
          />

        </div>
      </form>
    </div>
  );
};

export default SearchBar;