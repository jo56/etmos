
// Get language-specific color coding
export const getLanguageColor = (language: string): string => {
  const colors: { [key: string]: string } = {
    'en': '#3B82F6', // Blue
    'de': '#EF4444', // Red
    'fr': '#10B981', // Green
    'es': '#F59E0B', // Orange
    'it': '#8B5CF6', // Purple
    'pt': '#EC4899', // Pink
    'ru': '#6366F1', // Indigo
    'zh': '#DC2626', // Red-600
    'ja': '#7C3AED', // Purple-600
    'ar': '#059669', // Green-600
    'hi': '#D97706', // Orange-600
    'ko': '#BE185D', // Pink-600
    'tr': '#0D9488', // Teal-600
    'pl': '#7C2D12', // Brown-800
    'nl': '#1E40AF', // Blue-800
    'sv': '#166534', // Green-800
    'da': '#92400E', // Orange-800
    'no': '#1E3A8A', // Blue-900
    'fi': '#14532D', // Green-900
    'la': '#7F1D1D', // Red-900
    'grc': '#581C87', // Purple-900
    'sa': '#78350F', // Orange-900
  };
  return colors[language] || '#6B7280'; // Gray-500 as default
};