import React from 'react';
import type { ThemeName } from '../App';

interface ThemeSelectorProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

export const themes = {
  minimalist: {
    name: 'minimalist' as ThemeName,
    displayName: 'Minimalist',
    description: 'Essential forms, maximum clarity',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
    nodeStyles: {
      source: {
        fill: '#0f172a',
        stroke: '#334155',
        strokeWidth: 2,
        filter: 'drop-shadow(0 2px 8px rgba(15, 23, 42, 0.15))',
      },
      expanded: {
        fill: '#334155',
        stroke: '#475569',
        strokeWidth: 1.5,
        filter: 'drop-shadow(0 1px 6px rgba(51, 65, 85, 0.12))',
      },
      default: {
        fill: '#e2e8f0',
        stroke: '#cbd5e1',
        strokeWidth: 1,
        filter: 'drop-shadow(0 1px 3px rgba(226, 232, 240, 0.25))',
      }
    },
    edgeStyles: {
      stroke: '#cbd5e1',
      strokeWidth: 1,
      opacity: 0.6,
    },
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    colors: {
      primary: '#0f172a',
      secondary: '#475569',
      accent: '#3b82f6',
      text: '#1e293b'
    }
  },

  bauhaus: {
    name: 'bauhaus' as ThemeName,
    displayName: 'Bauhaus',
    description: 'Form follows function, geometric purity',
    background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
    nodeStyles: {
      source: {
        fill: '#e53e3e',
        stroke: '#2d3748',
        strokeWidth: 3,
        filter: 'none',
      },
      expanded: {
        fill: '#3182ce',
        stroke: '#2d3748',
        strokeWidth: 2,
        filter: 'none',
      },
      default: {
        fill: '#ecc94b',
        stroke: '#2d3748',
        strokeWidth: 1.5,
        filter: 'none',
      }
    },
    edgeStyles: {
      stroke: '#2d3748',
      strokeWidth: 2,
      opacity: 1,
    },
    fontFamily: "'Futura', 'Century Gothic', sans-serif",
    colors: {
      primary: '#e53e3e',
      secondary: '#3182ce',
      accent: '#ecc94b',
      text: '#2d3748'
    }
  },

  swiss: {
    name: 'swiss' as ThemeName,
    displayName: 'Swiss International',
    description: 'Grid systems, objective typography',
    background: 'linear-gradient(0deg, #ffffff 50%, #f9f9f9 50%)',
    nodeStyles: {
      source: {
        fill: '#1a1a1a',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'none',
      },
      expanded: {
        fill: '#666666',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'none',
      },
      default: {
        fill: '#cccccc',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'none',
      }
    },
    edgeStyles: {
      stroke: '#1a1a1a',
      strokeWidth: 1,
      opacity: 1,
    },
    fontFamily: "'Helvetica Neue', 'Arial', sans-serif",
    colors: {
      primary: '#1a1a1a',
      secondary: '#666666',
      accent: '#e53e3e',
      text: '#1a1a1a'
    }
  },

  brutalist: {
    name: 'brutalist' as ThemeName,
    displayName: 'Brutalist',
    description: 'Raw concrete, monumental forms',
    background: 'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #2d2d2d 100%)',
    nodeStyles: {
      source: {
        fill: '#1a1a1a',
        stroke: '#000000',
        strokeWidth: 4,
        filter: 'drop-shadow(8px 8px 0px #000000)',
      },
      expanded: {
        fill: '#333333',
        stroke: '#000000',
        strokeWidth: 3,
        filter: 'drop-shadow(6px 6px 0px #000000)',
      },
      default: {
        fill: '#666666',
        stroke: '#000000',
        strokeWidth: 2,
        filter: 'drop-shadow(4px 4px 0px #000000)',
      }
    },
    edgeStyles: {
      stroke: '#000000',
      strokeWidth: 3,
      opacity: 1,
    },
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    colors: {
      primary: '#1a1a1a',
      secondary: '#333333',
      accent: '#ffffff',
      text: '#ffffff'
    }
  },

  art_deco: {
    name: 'art_deco' as ThemeName,
    displayName: 'Art Deco',
    description: 'Geometric elegance, luxury materials',
    background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
    nodeStyles: {
      source: {
        fill: '#d4af37',
        stroke: '#b8860b',
        strokeWidth: 2,
        filter: 'drop-shadow(0 2px 8px rgba(212, 175, 55, 0.4))',
      },
      expanded: {
        fill: '#cd853f',
        stroke: '#a0522d',
        strokeWidth: 1.5,
        filter: 'drop-shadow(0 1px 6px rgba(205, 133, 63, 0.3))',
      },
      default: {
        fill: '#2c3e50',
        stroke: '#34495e',
        strokeWidth: 1,
        filter: 'drop-shadow(0 1px 4px rgba(44, 62, 80, 0.2))',
      }
    },
    edgeStyles: {
      stroke: '#d4af37',
      strokeWidth: 1.5,
      opacity: 0.8,
    },
    fontFamily: "'Poiret One', 'Optima', sans-serif",
    colors: {
      primary: '#d4af37',
      secondary: '#cd853f',
      accent: '#2c3e50',
      text: '#ecf0f1'
    }
  },

  constructivist: {
    name: 'constructivist' as ThemeName,
    displayName: 'Constructivist',
    description: 'Revolutionary geometry, dynamic angles',
    background: 'linear-gradient(45deg, #ffffff 25%, #f5f5f5 25%, #f5f5f5 50%, #ffffff 50%, #ffffff 75%, #f5f5f5 75%)',
    nodeStyles: {
      source: {
        fill: '#e53e3e',
        stroke: '#000000',
        strokeWidth: 2,
        filter: 'none',
      },
      expanded: {
        fill: '#000000',
        stroke: '#e53e3e',
        strokeWidth: 2,
        filter: 'none',
      },
      default: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1.5,
        filter: 'none',
      }
    },
    edgeStyles: {
      stroke: '#000000',
      strokeWidth: 2,
      opacity: 1,
    },
    fontFamily: "'Rodchenko', 'Futura', sans-serif",
    colors: {
      primary: '#e53e3e',
      secondary: '#000000',
      accent: '#ffffff',
      text: '#000000'
    }
  },

  memphis: {
    name: 'memphis' as ThemeName,
    displayName: 'Memphis',
    description: 'Postmodern patterns, bold contrasts',
    background: 'linear-gradient(45deg, #ff6b9d 25%, transparent 25%), linear-gradient(-45deg, #ff6b9d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ff6b9d 75%), linear-gradient(-45deg, transparent 75%, #ff6b9d 75%), #ffeaa7',
    nodeStyles: {
      source: {
        fill: '#fd79a8',
        stroke: '#2d3436',
        strokeWidth: 3,
        filter: 'none',
      },
      expanded: {
        fill: '#00b894',
        stroke: '#2d3436',
        strokeWidth: 2.5,
        filter: 'none',
      },
      default: {
        fill: '#fdcb6e',
        stroke: '#2d3436',
        strokeWidth: 2,
        filter: 'none',
      }
    },
    edgeStyles: {
      stroke: '#2d3436',
      strokeWidth: 4,
      opacity: 1,
      strokeDasharray: '8,4',
    },
    fontFamily: "'Archivo Black', 'Impact', sans-serif",
    colors: {
      primary: '#fd79a8',
      secondary: '#00b894',
      accent: '#fdcb6e',
      text: '#2d3436'
    }
  },

  japanese: {
    name: 'japanese' as ThemeName,
    displayName: 'Japanese',
    description: 'Ma space, subtle harmony',
    background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
    nodeStyles: {
      source: {
        fill: '#2c3e50',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 1px 3px rgba(44, 62, 80, 0.2))',
      },
      expanded: {
        fill: '#34495e',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 1px 2px rgba(52, 73, 94, 0.15))',
      },
      default: {
        fill: '#ecf0f1',
        stroke: '#bdc3c7',
        strokeWidth: 0.5,
        filter: 'drop-shadow(0 0.5px 1px rgba(189, 195, 199, 0.1))',
      }
    },
    edgeStyles: {
      stroke: '#95a5a6',
      strokeWidth: 1,
      opacity: 0.4,
    },
    fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', sans-serif",
    colors: {
      primary: '#2c3e50',
      secondary: '#34495e',
      accent: '#e74c3c',
      text: '#2c3e50'
    }
  },

  scandinavian: {
    name: 'scandinavian' as ThemeName,
    displayName: 'Scandinavian',
    description: 'Light woods, functional beauty',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
    nodeStyles: {
      source: {
        fill: '#2c3e50',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 2px 4px rgba(44, 62, 80, 0.1))',
      },
      expanded: {
        fill: '#95a5a6',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 1px 3px rgba(149, 165, 166, 0.1))',
      },
      default: {
        fill: '#ecf0f1',
        stroke: '#bdc3c7',
        strokeWidth: 0.5,
        filter: 'drop-shadow(0 1px 2px rgba(189, 195, 199, 0.05))',
      }
    },
    edgeStyles: {
      stroke: '#bdc3c7',
      strokeWidth: 1,
      opacity: 0.6,
    },
    fontFamily: "'Source Sans Pro', 'Open Sans', sans-serif",
    colors: {
      primary: '#2c3e50',
      secondary: '#95a5a6',
      accent: '#3498db',
      text: '#2c3e50'
    }
  },

  modernist: {
    name: 'modernist' as ThemeName,
    displayName: 'Modernist',
    description: 'Less is more, rational clarity',
    background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
    nodeStyles: {
      source: {
        fill: '#1a202c',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 1px 3px rgba(26, 32, 44, 0.12))',
      },
      expanded: {
        fill: '#4a5568',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 1px 2px rgba(74, 85, 104, 0.1))',
      },
      default: {
        fill: '#e2e8f0',
        stroke: 'none',
        strokeWidth: 0,
        filter: 'drop-shadow(0 0.5px 1px rgba(226, 232, 240, 0.08))',
      }
    },
    edgeStyles: {
      stroke: '#cbd5e0',
      strokeWidth: 1,
      opacity: 0.5,
    },
    fontFamily: "'Mies', 'Helvetica Neue', sans-serif",
    colors: {
      primary: '#1a202c',
      secondary: '#4a5568',
      accent: '#3182ce',
      text: '#1a202c'
    }
  },

  deconstructivist: {
    name: 'deconstructivist' as ThemeName,
    displayName: 'Deconstructivist',
    description: 'Fragmented forms, unstable geometry',
    background: 'linear-gradient(23deg, #f8f9fa 25%, transparent 25%), linear-gradient(67deg, #f8f9fa 25%, transparent 25%), linear-gradient(113deg, #f8f9fa 25%, transparent 25%), #ffffff',
    nodeStyles: {
      source: {
        fill: '#2d3748',
        stroke: '#1a202c',
        strokeWidth: 2,
        filter: 'drop-shadow(2px -1px 0px #000000) drop-shadow(-1px 2px 0px #4a5568)',
      },
      expanded: {
        fill: '#4a5568',
        stroke: '#2d3748',
        strokeWidth: 1.5,
        filter: 'drop-shadow(1px -0.5px 0px #000000) drop-shadow(-0.5px 1px 0px #718096)',
      },
      default: {
        fill: '#e2e8f0',
        stroke: '#a0aec0',
        strokeWidth: 1,
        filter: 'drop-shadow(0.5px -0.25px 0px #4a5568)',
      }
    },
    edgeStyles: {
      stroke: '#4a5568',
      strokeWidth: 2,
      opacity: 0.8,
      strokeDasharray: '3,1,1,3',
    },
    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
    colors: {
      primary: '#2d3748',
      secondary: '#4a5568',
      accent: '#e53e3e',
      text: '#1a202c'
    }
  },


  origami: {
    name: 'origami' as ThemeName,
    displayName: 'Origami Paper',
    description: 'Folded paper with geometric creases',
    background: 'conic-gradient(from 0deg at 50% 50%, rgba(255, 182, 193, 0.1) 0deg, rgba(255, 218, 185, 0.1) 72deg, rgba(255, 255, 255, 0.05) 144deg, rgba(240, 248, 255, 0.1) 216deg, rgba(255, 192, 203, 0.1) 288deg, rgba(255, 182, 193, 0.1) 360deg), linear-gradient(135deg, #fefefe 0%, #f9fafb 50%, #f3f4f6 100%)',
    nodeStyles: {
      source: {
        fill: '#f87171',
        stroke: '#ef4444',
        strokeWidth: 2,
        filter: 'drop-shadow(2px 4px 8px rgba(239, 68, 68, 0.3)) drop-shadow(-1px -2px 4px rgba(255, 255, 255, 0.8))',
        clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)',
        transform: 'perspective(100px) rotateX(15deg) rotateY(-10deg)',
      },
      expanded: {
        fill: '#fb923c',
        stroke: '#f97316',
        strokeWidth: 2,
        filter: 'drop-shadow(1.5px 3px 6px rgba(249, 115, 22, 0.25)) drop-shadow(-0.8px -1.5px 3px rgba(255, 255, 255, 0.7))',
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)',
        transform: 'perspective(80px) rotateX(12deg) rotateY(-8deg)',
      },
      default: {
        fill: '#fbbf24',
        stroke: '#f59e0b',
        strokeWidth: 1.5,
        filter: 'drop-shadow(1px 2px 4px rgba(245, 158, 11, 0.2)) drop-shadow(-0.5px -1px 2px rgba(255, 255, 255, 0.6))',
        clipPath: 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)',
        transform: 'perspective(60px) rotateX(10deg) rotateY(-6deg)',
      }
    },
    edgeStyles: {
      stroke: '#fb923c',
      strokeWidth: 3,
      opacity: 0.7,
      strokeLinecap: 'round',
      strokeDasharray: '0,8,4,8',
      filter: 'drop-shadow(1px 2px 3px rgba(251, 146, 60, 0.2))',
    },
    fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', sans-serif",
    colors: {
      primary: '#f87171',
      secondary: '#fb923c',
      accent: '#fbbf24',
      text: '#374151'
    }
  },





};

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="flex flex-col items-center">
      <p className="text-slate-500 font-light mb-8">Choose your visual theme</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-w-6xl">
        {Object.values(themes).map((theme) => (
          <button
            key={theme.name}
            onClick={() => onThemeChange(theme.name)}
            className={`
              relative px-4 py-3 rounded-lg transition-all duration-200 font-light min-h-[80px]
              ${currentTheme === theme.name
                ? 'bg-slate-900 text-white shadow-lg scale-105 border-2 border-blue-400'
                : 'bg-white/50 text-slate-700 hover:bg-white/70 hover:text-slate-900 shadow-sm hover:shadow-md border border-slate-200'
              }
            `}
          >
            <div className="text-center">
              <div className="font-medium mb-1 text-sm">{theme.displayName}</div>
              <div className="text-xs opacity-75 leading-tight">{theme.description}</div>
            </div>
            {currentTheme === theme.name && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
            )}
          </button>
        ))}
      </div>
      <div className="mt-6 text-xs text-slate-400 text-center max-w-2xl">
        Experience dramatic visual transformations - from neural networks to ancient manuscripts
      </div>
    </div>
  );
};

export default ThemeSelector;