import React from 'react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  mainTitle: string;
  onMainTitleChange: (newTitle: string) => void;
  subtitle: string;
  onSubtitleChange: (newSubtitle: string) => void;
  isMusicLoaded: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  isMusicPlaying,
  onToggleMusic,
  mainTitle,
  onMainTitleChange,
  subtitle,
  onSubtitleChange,
  isMusicLoaded,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in-0 duration-500" onClick={onClose}>
      <div 
        className="bg-gray-900/80 border border-yellow-500/20 rounded-lg p-6 sm:p-8 w-full max-w-sm sm:max-w-md text-white font-sans relative shadow-2xl shadow-yellow-500/10 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <button onClick={onClose} className="absolute top-2 right-3 text-2xl font-bold text-gray-400 hover:text-white transition-colors">&times;</button>
        <h2 className="text-2xl font-serif text-yellow-400 mb-6 tracking-widest text-center">Settings</h2>
        
        <div className="space-y-6">
          {/* Music Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Background Music</label>
            <button 
              onClick={onToggleMusic} 
              disabled={!isMusicLoaded}
              className="w-full bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-100 border border-yellow-500/30 px-4 py-2 rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMusicPlaying ? 'Pause Music' : 'Play Music'}
            </button>
          </div>
          
          {/* Main Title Input */}
          <div>
            <label htmlFor="main-title" className="block text-sm font-medium text-gray-300 mb-2">Main Title</label>
            <input
              id="main-title"
              type="text"
              value={mainTitle}
              onChange={(e) => onMainTitleChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
            />
          </div>

          {/* Subtitle Input */}
          <div>
            <label htmlFor="subtitle" className="block text-sm font-medium text-gray-300 mb-2">Subtitle</label>
            <input
              id="subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => onSubtitleChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
              placeholder="e.g., Make a wish"
            />
          </div>
        </div>
      </div>
    </div>
  );
};