import type { Word } from '../types';
import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:54330/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async searchEtymology(word: string, language?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('word', word);
    if (language) params.append('language', language);

    return this.request(`/etymology/search?${params}`);
  }

  async getWord(wordText: string, language?: string): Promise<{ word: Word; connections: any[] }> {
    const params = new URLSearchParams();
    if (language) params.append('language', language);

    return this.request<{ word: Word; connections: any[] }>(`/words/${encodeURIComponent(wordText)}?${params}`);
  }

  async getInitialConnections(
    word: string,
    language: string,
    maxNodes: number = 5
  ): Promise<any> {
    try {
      return await this.request(`/etymology/initial`, {
        method: 'POST',
        body: JSON.stringify({
          word,
          language,
          maxNodes
        }),
      });
    } catch (error) {
      // Fallback to existing search endpoint
      logger.warn('New endpoint failed, using fallback...');
      const searchResult = await this.searchEtymology(word, language);

      // Transform the existing format to the new format
      if (searchResult && searchResult.nodes && searchResult.edges) {
        const sourceNode = searchResult.nodes.find((n: any) => n.data.isSource);
        const neighbors = searchResult.nodes.filter((n: any) => !n.data.isSource).slice(0, maxNodes);
        const connections = searchResult.edges.filter((e: any) =>
          neighbors.some((n: any) => n.id === e.target || n.id === e.source)
        );

        return {
          sourceNode: sourceNode || searchResult.nodes[0],
          neighbors,
          connections,
          totalAvailable: searchResult.nodes.length - 1
        };
      }
      throw error;
    }
  }

  async getNeighbors(
    wordId: string,
    maxNodes: number = 4,
    excludeIds: string[] = [],
    currentNeighborCount: number = 0,
    maxNeighbors: number = 10,
    word?: string,
    language?: string
  ): Promise<any> {
    try {
      return await this.request(`/etymology/neighbors`, {
        method: 'POST',
        body: JSON.stringify({
          wordId,
          word,
          language,
          maxNodes,
          excludeIds,
          currentNeighborCount,
          maxNeighbors
        }),
      });
    } catch (error) {
      logger.warn('Neighbors endpoint failed:', error);
      return {
        neighbors: [],
        connections: [],
        totalAvailable: 0
      };
    }
  }
}

export const apiService = new ApiService();
