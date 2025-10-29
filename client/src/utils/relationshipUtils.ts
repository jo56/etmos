
export interface RelationshipInfo {
  category: string;
  displayName: string;
  detailedDescription: string;
  confidence: number;
  etymologicalContext?: string;
  sharedRoot?: string;
  origin?: string;
}

/**
 * Generate enhanced relationship descriptions for tooltips
 */
export const getRelationshipDescription = (
  relationshipType: string,
  confidence: number,
  notes?: string,
  origin?: string,
  sharedRoot?: string
): RelationshipInfo => {

  const baseConfidence = Math.round(confidence * 100);

  // Enhanced descriptions based on relationship type
  const relationshipDescriptions: Record<string, (notes?: string, origin?: string, sharedRoot?: string) => RelationshipInfo> = {
    'cognate': (notes, origin, sharedRoot) => ({
      category: 'Cognate',
      displayName: 'cognate',
      detailedDescription: `These words descend from the same ancestral word and have evolved separately in their respective languages. They share a common etymological origin and often show systematic sound correspondences.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'cognate_germanic': (notes, origin, sharedRoot) => ({
      category: 'Germanic',
      displayName: 'Germanic cognate',
      detailedDescription: `These words derive from the same Proto-Germanic root and demonstrate the regular sound changes that occurred as Germanic languages diverged. Germanic cognates often show distinctive patterns like Grimm's Law.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'cognate_romance': (notes, origin, sharedRoot) => ({
      category: 'Romance',
      displayName: 'Romance cognate',
      detailedDescription: `These words stem from the same Latin root and evolved through the regular phonetic changes that shaped the Romance languages. They preserve Latin etymology through systematic transformations.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'cognate_slavic': (notes, origin, sharedRoot) => ({
      category: 'Slavic',
      displayName: 'Slavic cognate',
      detailedDescription: `These words descend from the same Proto-Slavic ancestor and show the characteristic sound changes of Slavic languages, including palatalization and vowel shifts.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'cognate_celtic': (notes, origin, sharedRoot) => ({
      category: 'Celtic',
      displayName: 'Celtic cognate',
      detailedDescription: `These words trace back to the same Proto-Celtic root and exhibit the distinctive sound changes of Celtic languages, including lenition and initial consonant mutations.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'cognate_ancient': (notes, origin, sharedRoot) => ({
      category: 'Ancient',
      displayName: 'ancient cognate',
      detailedDescription: `These words share an ancient common ancestor, often from classical languages like Sanskrit, Greek, or early forms of modern languages. They demonstrate deep etymological connections across language families.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'derivative': (notes, origin, sharedRoot) => ({
      category: 'Derived',
      displayName: 'derivative',
      detailedDescription: `One word is derived from the other through morphological processes such as affixation, compounding, or semantic extension. This represents a direct etymological relationship.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'pie_derivative': (notes, origin, sharedRoot) => ({
      category: 'PIE Derivative',
      displayName: 'PIE derivative',
      detailedDescription: `This word derives from a Proto-Indo-European root, representing one of the deepest traceable etymological connections. PIE roots are reconstructed forms that explain similarities across Indo-European languages.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'forms_part_of': (notes, origin, sharedRoot) => ({
      category: 'Component',
      displayName: 'forms part of',
      detailedDescription: `The source word forms all or part of the target word, indicating morphological composition. This shows how complex words are built from simpler etymological elements.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'source_of': (notes, origin, sharedRoot) => ({
      category: 'Source',
      displayName: 'source of',
      detailedDescription: `The source word is the etymological origin of the target word, showing direct derivational history. This represents a clear path of word formation.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'borrowing': (notes, origin, sharedRoot) => ({
      category: 'Borrowed',
      displayName: 'borrowing',
      detailedDescription: `One word was borrowed from another language, representing linguistic contact and cultural exchange. Borrowings often retain some phonological features of the source language.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'compound': (notes, origin, sharedRoot) => ({
      category: 'Compound',
      displayName: 'compound',
      detailedDescription: `This word is formed by combining two or more etymologically distinct elements. Compounds show how languages create new vocabulary from existing morphological material.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    }),

    'shortened_from': (notes, origin, sharedRoot) => ({
      category: 'Shortened',
      displayName: 'shortened from',
      detailedDescription: `This word is a shortened form of a longer word through processes like clipping, abbreviation, or truncation. This represents modern word formation processes.`,
      confidence: baseConfidence,
      etymologicalContext: notes,
      sharedRoot,
      origin
    })
  };

  // Get the appropriate description function
  const descriptionFunc = relationshipDescriptions[relationshipType] ||
    relationshipDescriptions['cognate']; // fallback

  return descriptionFunc(notes, origin, sharedRoot);
};

/**
 * Extract and format shared root information for display
 */
export const formatSharedRoot = (sharedRoot?: string): string | null => {
  if (!sharedRoot) return null;

  // Extract proto-form if present
  const protoMatch = sharedRoot.match(/\*[\p{L}\p{M}'-]+/u);
  if (protoMatch) {
    return protoMatch[0];
  }

  // Clean up shared root for display
  return sharedRoot
    .replace(/^Proto-Germanic/i, '*Germanic')
    .replace(/^Proto-Indo-European|^PIE/i, '*PIE')
    .replace(/^Proto-Slavic/i, '*Slavic')
    .replace(/^Proto-Celtic/i, '*Celtic')
    .replace(/^Proto-Romance|^Latin\s+/i, '*Latin')
    .replace(/^Proto-/i, '*')
    .substring(0, 20); // Slightly longer for better context
};

/**
 * Format etymology context for display in tooltips
 */
export const formatEtymologyContext = (
  notes?: string,
  confidence?: number,
  origin?: string,
  sharedRoot?: string
): string => {
  const parts: string[] = [];

  // Add confidence if available
  if (confidence) {
    parts.push(`${Math.round(confidence * 100)}% confidence`);
  }

  // Add formatted shared root
  const formattedRoot = formatSharedRoot(sharedRoot);
  if (formattedRoot) {
    parts.push(`Shared root: ${formattedRoot}`);
  } else if (origin && origin !== 'common origin' && origin !== 'common etymological origin') {
    // Clean up origin for display
    const cleanOrigin = origin.substring(0, 30) + (origin.length > 30 ? '...' : '');
    parts.push(`Origin: ${cleanOrigin}`);
  }

  // Add notes if available (truncated)
  if (notes && notes.trim() !== '') {
    const cleanNotes = notes.length > 100 ? notes.substring(0, 100) + '...' : notes;
    parts.push(cleanNotes);
  }

  return parts.join(' \u2022 ');
};