export interface EdgeStyle {
  color: string;
  width: number;
  dash: string;
  label: string;
  category: string; // For tooltip consistency
}

// Get edge styling based on relationship type
export const getEdgeStyle = (relationshipType: string): EdgeStyle => {
  const baseStyles: Record<string, EdgeStyle> = {
    'cognate': { color: '#f87171', width: 3, dash: '', label: 'cognate', category: 'Cognate' },
    'cognate_germanic': { color: '#fb923c', width: 3, dash: '', label: 'Germanic', category: 'Germanic' },
    'cognate_romance': { color: '#ef4444', width: 3, dash: '', label: 'Romance', category: 'Romance' },
    'cognate_slavic': { color: '#f97316', width: 3, dash: '', label: 'Slavic', category: 'Slavic' },
    'cognate_celtic': { color: '#fbbf24', width: 3, dash: '', label: 'Celtic', category: 'Celtic' },
    'cognate_ancient': { color: '#d97706', width: 3, dash: '', label: 'Ancient', category: 'Ancient' },
    'derivative': { color: '#fb923c', width: 2, dash: '5,2', label: 'derived', category: 'Derived' },
    'pie_derivative': { color: '#8b5cf6', width: 2, dash: '5,2', label: 'PIE', category: 'PIE Derivative' },
    'forms_part_of': { color: '#06b6d4', width: 2, dash: '8,2', label: 'component', category: 'Component' },
    'source_of': { color: '#10b981', width: 2, dash: '6,3', label: 'source', category: 'Source' },
    'borrowing': { color: '#f87171', width: 2, dash: '3,3', label: 'borrowed', category: 'Borrowed' },
    'compound': { color: '#fbbf24', width: 2, dash: '8,2', label: 'compound', category: 'Compound' },
    'shortened_from': { color: '#64748b', width: 2, dash: '4,4', label: 'shortened', category: 'Shortened' },
    'shortened_to': { color: '#64748b', width: 2, dash: '4,4', label: 'shortened', category: 'Shortened' },
    // Language family specific cognates
    'iranian': { color: '#d97706', width: 2, dash: '', label: 'Iranian', category: 'Iranian' },
    'indic': { color: '#ef4444', width: 2, dash: '', label: 'Indic', category: 'Indic' },
    'turkic': { color: '#f97316', width: 2, dash: '', label: 'Turkic', category: 'Turkic' },
    'finno_ugric': { color: '#fbbf24', width: 2, dash: '', label: 'Finno-Ugric', category: 'Finno-Ugric' },
    'japonic': { color: '#f87171', width: 2, dash: '', label: 'Japonic', category: 'Japonic' },
    'koreanic': { color: '#f87171', width: 2, dash: '', label: 'Koreanic', category: 'Koreanic' },
    'sino_tibetan': { color: '#ef4444', width: 2, dash: '', label: 'Sino-Tibetan', category: 'Sino-Tibetan' },
    'semitic': { color: '#f97316', width: 2, dash: '', label: 'Semitic', category: 'Semitic' },
    'related': { color: '#9ca3af', width: 1, dash: '2,2', label: 'related', category: 'Related' }
  };

  return baseStyles[relationshipType] || baseStyles['related'];
};