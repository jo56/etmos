import NodeCache from 'node-cache';
import { logError } from '../utils/logger';

const cache = new NodeCache({ stdTTL: 7200 });

interface Phonetic {
  text?: string;
  audio?: string;
}

interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryEntry {
  word: string;
  origin: string | null;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

class DictionaryAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = 'https://api.dictionaryapi.dev/api/v2/entries';
  }

  async fetchEntry(word: string, language: string = 'en'): Promise<DictionaryEntry | null> {
    const normalizedWord = (word || '').trim();
    if (!normalizedWord) {
      return null;
    }

    const normalizedLanguage = (language || 'en').toLowerCase();
    const cacheKey = `${normalizedLanguage}:${normalizedWord.toLowerCase()}`;

    const cachedValue = cache.get<DictionaryEntry | null>(cacheKey);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const requestUrl = `${this.baseURL}/${encodeURIComponent(normalizedLanguage)}/${encodeURIComponent(normalizedWord)}`;

    try {
      const response = await fetch(requestUrl);
      if (!response.ok) {
        cache.set(cacheKey, null, 300);
        return null;
      }

      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        cache.set(cacheKey, null, 300);
        return null;
      }

      const entry = payload[0];
      const normalizedEntry: DictionaryEntry = {
        word: entry.word || normalizedWord,
        origin: entry.origin || entry.etymology || null,
        phonetics: Array.isArray(entry.phonetics) ? entry.phonetics : [],
        meanings: Array.isArray(entry.meanings) ? entry.meanings : []
      };

      cache.set(cacheKey, normalizedEntry);
      return normalizedEntry;
    } catch (error) {
      logError(`Dictionary API request failed for "${normalizedWord}"`, error, {
        word: normalizedWord,
        language
      });
      cache.set(cacheKey, null, 300);
      return null;
    }
  }

  extractPrimaryDefinition(entry: DictionaryEntry | null): string | null {
    if (!entry || !Array.isArray(entry.meanings)) {
      return null;
    }

    for (const meaning of entry.meanings) {
      if (meaning && Array.isArray(meaning.definitions)) {
        const firstDefinition = meaning.definitions.find(Boolean);
        if (firstDefinition && typeof firstDefinition.definition === 'string') {
          return firstDefinition.definition;
        }
      }
    }

    return null;
  }

  extractPrimaryPartOfSpeech(entry: DictionaryEntry | null): string | null {
    if (!entry || !Array.isArray(entry.meanings)) {
      return null;
    }

    for (const meaning of entry.meanings) {
      if (meaning && typeof meaning.partOfSpeech === 'string' && meaning.partOfSpeech.trim().length > 0) {
        return meaning.partOfSpeech.trim();
      }
    }

    return null;
  }
}

export default new DictionaryAPI();
