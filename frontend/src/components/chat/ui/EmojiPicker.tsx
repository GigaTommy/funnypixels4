import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock } from 'lucide-react';

// 表情分类
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    name: '最近',
    icon: '🕐',
    emojis: []
  },
  {
    id: 'smileys',
    name: '笑脸',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬'
    ]
  },
  {
    id: 'people',
    name: '人物',
    icon: '👤',
    emojis: [
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👨‍🦰', '👨‍🦱',
      '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '🧑‍🦰', '👩‍🦱', '🧑‍🦱', '👩‍🦳', '🧑‍🦳', '👩‍🦲',
      '🧑‍🦲', '👱‍♀️', '👱‍♂️', '🧓', '👴', '👵', '🙍', '🙍‍♂️', '🙍‍♀️', '🙎',
      '🙎‍♂️', '🙎‍♀️', '🙅', '🙅‍♂️', '🙅‍♀️', '🙆', '🙆‍♂️', '🙆‍♀️', '💁', '💁‍♂️'
    ]
  },
  {
    id: 'nature',
    name: '自然',
    icon: '🌿',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜'
    ]
  },
  {
    id: 'food',
    name: '食物',
    icon: '🍎',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
      '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
      '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈'
    ]
  },
  {
    id: 'activities',
    name: '活动',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️'
    ]
  },
  {
    id: 'objects',
    name: '物品',
    icon: '💎',
    emojis: [
      '💎', '🔔', '🔕', '🎵', '🎶', '🎤', '🎧', '📻', '🎷', '🪗',
      '🎸', '🎹', '🎺', '🎻', '🪕', '🥁', '🪘', '📱', '📞', '☎️',
      '📟', '📠', '🔋', '🪫', '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️',
      '🖲️', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞️', '📽️', '🎬'
    ]
  }
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export default function EmojiPicker({ onEmojiSelect, className = '' }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentEmojis');
    return saved ? JSON.parse(saved) : ['😀', '😊', '😂', '❤️', '👍', '🎉', '🔥', '💯'];
  });

  // 更新最近使用的表情
  const updateRecentEmojis = useCallback((emoji: string) => {
    setRecentEmojis(prev => {
      const newRecent = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 20);
      localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  const handleEmojiClick = useCallback((emoji: string) => {
    updateRecentEmojis(emoji);
    onEmojiSelect(emoji);
  }, [onEmojiSelect, updateRecentEmojis]);

  // 获取当前分类的表情
  const getCurrentEmojis = useCallback(() => {
    if (activeCategory === 'recent') {
      return recentEmojis;
    }

    const category = EMOJI_CATEGORIES.find(cat => cat.id === activeCategory);
    return category?.emojis || [];
  }, [activeCategory, recentEmojis]);

  // 搜索表情
  const getSearchResults = useCallback(() => {
    if (!searchQuery) return [];

    const allEmojis = EMOJI_CATEGORIES.flatMap(cat => cat.emojis);
    return allEmojis.filter(emoji => {
      // 这里可以添加更复杂的搜索逻辑，比如表情名称匹配
      return emoji.includes(searchQuery);
    });
  }, [searchQuery]);

  const displayEmojis = searchQuery ? getSearchResults() : getCurrentEmojis();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className={`bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden ${className}`}
      style={{ width: '320px', height: '400px' }}
    >
      {/* 搜索框 */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索表情..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* 分类标签 */}
      {!searchQuery && (
        <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex-shrink-0 px-4 py-3 text-lg hover:bg-gray-100 transition-colors ${
                activeCategory === category.id
                  ? 'bg-white border-b-2 border-blue-500'
                  : ''
              }`}
              title={category.name}
            >
              {category.id === 'recent' ? <Clock className="w-5 h-5" /> : category.icon}
            </button>
          ))}
        </div>
      )}

      {/* 表情网格 */}
      <div className="p-3 overflow-y-auto" style={{ height: searchQuery ? '340px' : '300px' }}>
        {displayEmojis.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm">没有找到相关表情</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {displayEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 text-xl hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          点击表情发送 • 最近使用的表情会被记住
        </p>
      </div>
    </motion.div>
  );
}