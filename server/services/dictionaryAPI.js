const NodeCache = require('node-cache');

// Cache dictionary responses for two hours to limit external calls.
const cache = new NodeCache({ stdTTL: 7200 });

class DictionaryAPI {
  constructor() {
    this.baseURL = 'https://api.dictionaryapi.dev/api/v2/entries';
  }

  async fetchEntry(word, language = 'en') {
    const normalizedWord = (word || '').trim();
    if (!normalizedWord) {
      return null;
    }

    const normalizedLanguage = (language || 'en').toLowerCase();
    const cacheKey = `${normalizedLanguage}:${normalizedWord.toLowerCase()}`;

    const cachedValue = cache.get(cacheKey);
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
      const normalizedEntry = {
        word: entry.word || normalizedWord,
        origin: entry.origin || entry.etymology || null,
        phonetics: Array.isArray(entry.phonetics) ? entry.phonetics : [],
        meanings: Array.isArray(entry.meanings) ? entry.meanings : []
      };

      cache.set(cacheKey, normalizedEntry);
      return normalizedEntry;
    } catch (error) {
      console.error(`Dictionary API request failed for "${normalizedWord}":`, error);
      cache.set(cacheKey, null, 300);
      return null;
    }
  }

  extractPrimaryDefinition(entry) {
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

  extractPrimaryPartOfSpeech(entry) {
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

module.exports = new DictionaryAPI();
