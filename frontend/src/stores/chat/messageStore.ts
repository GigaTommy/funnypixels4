import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { ChatMessage } from '../../services/chat';
import { logger } from '../../utils/logger';

// 消息草稿
export interface MessageDraft {
  roomId: string;
  content: string;
  messageType: 'text' | 'emoji' | 'image' | 'location';
  metadata?: Record<string, any>;
  replyToMessageId?: string;
  lastModified: number;
}

// 消息搜索结果
export interface MessageSearchResult {
  message: ChatMessage;
  roomId: string;
  matchedText: string;
  context: ChatMessage[];
}

// 消息统计接口
export interface MessageStats {
  totalMessages: number;
  todayMessages: number;
  unreadCount: number;
  lastMessageTime: number;
}

// 消息状态接口
export interface MessageState {
  // 消息草稿
  drafts: Map<string, MessageDraft>; // roomId -> draft

  // 消息搜索
  searchQuery: string;
  searchResults: MessageSearchResult[];
  isSearching: boolean;
  searchHistory: string[];

  // 消息编辑
  editingMessageId: string | null;
  editingContent: string;

  // 消息引用/回复
  replyToMessage: ChatMessage | null;
  quotedMessage: ChatMessage | null;

  // 消息选择（多选操作）
  selectedMessages: Set<string>;
  selectionMode: boolean;

  // 输入状态
  typingStates: Map<string, {
    isTyping: boolean;
    lastActivity: number;
    timeout?: NodeJS.Timeout;
  }>; // roomId -> typing state

  // 消息过滤和排序
  messageFilters: {
    messageType?: string;
    sender?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };

  // 临时消息（发送中的消息）
  pendingMessages: Map<string, ChatMessage>; // messageId -> message
  failedMessages: Map<string, { message: ChatMessage; error: string }>; // messageId -> failed message

  // 消息统计
  messageStats: Map<string, {
    totalMessages: number;
    todayMessages: number;
    unreadCount: number;
    lastMessageTime: number;
  }>; // roomId -> stats
}

// 消息操作接口
export interface MessageActions {
  // 草稿管理
  saveDraft: (roomId: string, content: string, messageType?: string, metadata?: any) => void;
  getDraft: (roomId: string) => MessageDraft | null;
  clearDraft: (roomId: string) => void;
  hasDraft: (roomId: string) => boolean;

  // 搜索管理
  setSearchQuery: (query: string) => void;
  performSearch: (query: string, roomIds?: string[]) => Promise<void>;
  clearSearch: () => void;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;

  // 消息编辑
  startEditing: (messageId: string, content: string) => void;
  updateEditingContent: (content: string) => void;
  finishEditing: () => void;
  cancelEditing: () => void;

  // 消息引用/回复
  setReplyToMessage: (message: ChatMessage | null) => void;
  setQuotedMessage: (message: ChatMessage | null) => void;
  clearReferences: () => void;

  // 消息选择
  toggleMessageSelection: (messageId: string) => void;
  selectMessage: (messageId: string) => void;
  deselectMessage: (messageId: string) => void;
  selectAllMessages: (roomId: string) => void;
  clearSelection: () => void;
  setSelectionMode: (enabled: boolean) => void;

  // 输入状态管理
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  isTyping: (roomId: string) => boolean;

  // 过滤管理
  setMessageFilters: (filters: Partial<MessageState['messageFilters']>) => void;
  clearFilters: () => void;

  // 临时消息管理
  addPendingMessage: (message: ChatMessage) => void;
  removePendingMessage: (messageId: string) => void;
  addFailedMessage: (message: ChatMessage, error: string) => void;
  removeFailedMessage: (messageId: string) => void;
  retryFailedMessage: (messageId: string) => ChatMessage | null;

  // 统计管理
  updateMessageStats: (roomId: string, stats: Partial<MessageStats>) => void;
  incrementMessageCount: (roomId: string) => void;
  getMessageStats: (roomId: string) => MessageStats | null;

  // 工具方法
  getSelectedMessagesCount: () => number;
  hasAnyDrafts: () => boolean;
  getTypingTimeout: (roomId: string) => number;

  // 清理方法
  reset: () => void;
  clearRoomData: (roomId: string) => void;
}

// 初始状态
const initialState: MessageState = {
  drafts: new Map(),
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  searchHistory: [],
  editingMessageId: null,
  editingContent: '',
  replyToMessage: null,
  quotedMessage: null,
  selectedMessages: new Set(),
  selectionMode: false,
  typingStates: new Map(),
  messageFilters: {},
  pendingMessages: new Map(),
  failedMessages: new Map(),
  messageStats: new Map(),
};

// 创建消息Store
export const useMessageStore = create<MessageState & MessageActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // 草稿管理
      saveDraft: (roomId, content, messageType = 'text', metadata) => {
        set((state) => {
          const newDrafts = new Map(state.drafts);
          newDrafts.set(roomId, {
            roomId,
            content: content.trim(),
            messageType: messageType as any,
            metadata,
            replyToMessageId: state.replyToMessage?.id,
            lastModified: Date.now(),
          });
          return { drafts: newDrafts };
        });
      },

      getDraft: (roomId) => {
        return get().drafts.get(roomId) || null;
      },

      clearDraft: (roomId) => {
        set((state) => {
          const newDrafts = new Map(state.drafts);
          newDrafts.delete(roomId);
          return { drafts: newDrafts };
        });
      },

      hasDraft: (roomId) => {
        const draft = get().drafts.get(roomId);
        return draft ? draft.content.length > 0 : false;
      },

      // 搜索管理
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      performSearch: async (query, roomIds) => {
        set({ isSearching: true, searchQuery: query });

        try {
          // 这里应该调用搜索API
          // 暂时使用本地搜索逻辑
          const results: MessageSearchResult[] = [];

          // TODO: 实现实际的搜索逻辑
          await new Promise(resolve => setTimeout(resolve, 500)); // 模拟搜索延迟

          set({
            searchResults: results,
            isSearching: false
          });

          // 添加到搜索历史
          get().addToSearchHistory(query);

        } catch (error) {
          logger.error('Search failed:', error);
          set({ isSearching: false, searchResults: [] });
        }
      },

      clearSearch: () => {
        set({
          searchQuery: '',
          searchResults: [],
          isSearching: false,
        });
      },

      addToSearchHistory: (query) => {
        set((state) => {
          const newHistory = [query, ...state.searchHistory.filter(q => q !== query)].slice(0, 10);
          return { searchHistory: newHistory };
        });
      },

      clearSearchHistory: () => {
        set({ searchHistory: [] });
      },

      // 消息编辑
      startEditing: (messageId, content) => {
        set({
          editingMessageId: messageId,
          editingContent: content,
        });
      },

      updateEditingContent: (content) => {
        set({ editingContent: content });
      },

      finishEditing: () => {
        set({
          editingMessageId: null,
          editingContent: '',
        });
      },

      cancelEditing: () => {
        set({
          editingMessageId: null,
          editingContent: '',
        });
      },

      // 消息引用/回复
      setReplyToMessage: (message) => {
        set({ replyToMessage: message });
      },

      setQuotedMessage: (message) => {
        set({ quotedMessage: message });
      },

      clearReferences: () => {
        set({
          replyToMessage: null,
          quotedMessage: null,
        });
      },

      // 消息选择
      toggleMessageSelection: (messageId) => {
        set((state) => {
          const newSelectedMessages = new Set(state.selectedMessages);
          if (newSelectedMessages.has(messageId)) {
            newSelectedMessages.delete(messageId);
          } else {
            newSelectedMessages.add(messageId);
          }
          return { selectedMessages: newSelectedMessages };
        });
      },

      selectMessage: (messageId) => {
        set((state) => {
          const newSelectedMessages = new Set(state.selectedMessages);
          newSelectedMessages.add(messageId);
          return { selectedMessages: newSelectedMessages };
        });
      },

      deselectMessage: (messageId) => {
        set((state) => {
          const newSelectedMessages = new Set(state.selectedMessages);
          newSelectedMessages.delete(messageId);
          return { selectedMessages: newSelectedMessages };
        });
      },

      selectAllMessages: (roomId) => {
        // TODO: 获取房间所有消息ID并选中
        logger.debug('Select all messages for room:', roomId);
      },

      clearSelection: () => {
        set({ selectedMessages: new Set() });
      },

      setSelectionMode: (enabled) => {
        set({
          selectionMode: enabled,
          selectedMessages: enabled ? get().selectedMessages : new Set(),
        });
      },

      // 输入状态管理
      startTyping: (roomId) => {
        set((state) => {
          const newTypingStates = new Map(state.typingStates);
          const currentState = newTypingStates.get(roomId);

          // 清除之前的超时
          if (currentState?.timeout) {
            clearTimeout(currentState.timeout);
          }

          // 设置新的输入状态和超时
          const timeout = setTimeout(() => {
            get().stopTyping(roomId);
          }, 3000); // 3秒后自动停止

          newTypingStates.set(roomId, {
            isTyping: true,
            lastActivity: Date.now(),
            timeout,
          });

          return { typingStates: newTypingStates };
        });
      },

      stopTyping: (roomId) => {
        set((state) => {
          const newTypingStates = new Map(state.typingStates);
          const currentState = newTypingStates.get(roomId);

          if (currentState?.timeout) {
            clearTimeout(currentState.timeout);
          }

          newTypingStates.set(roomId, {
            isTyping: false,
            lastActivity: Date.now(),
          });

          return { typingStates: newTypingStates };
        });
      },

      isTyping: (roomId) => {
        const typingState = get().typingStates.get(roomId);
        return typingState?.isTyping || false;
      },

      // 过滤管理
      setMessageFilters: (filters) => {
        set((state) => ({
          messageFilters: { ...state.messageFilters, ...filters },
        }));
      },

      clearFilters: () => {
        set({ messageFilters: {} });
      },

      // 临时消息管理
      addPendingMessage: (message) => {
        set((state) => {
          const newPendingMessages = new Map(state.pendingMessages);
          newPendingMessages.set(message.id, message);
          return { pendingMessages: newPendingMessages };
        });
      },

      removePendingMessage: (messageId) => {
        set((state) => {
          const newPendingMessages = new Map(state.pendingMessages);
          newPendingMessages.delete(messageId);
          return { pendingMessages: newPendingMessages };
        });
      },

      addFailedMessage: (message, error) => {
        set((state) => {
          const newFailedMessages = new Map(state.failedMessages);
          newFailedMessages.set(message.id, { message, error });
          return { failedMessages: newFailedMessages };
        });
      },

      removeFailedMessage: (messageId) => {
        set((state) => {
          const newFailedMessages = new Map(state.failedMessages);
          newFailedMessages.delete(messageId);
          return { failedMessages: newFailedMessages };
        });
      },

      retryFailedMessage: (messageId) => {
        const failedMessage = get().failedMessages.get(messageId);
        if (failedMessage) {
          get().removeFailedMessage(messageId);
          return failedMessage.message;
        }
        return null;
      },

      // 统计管理
      updateMessageStats: (roomId, stats) => {
        set((state) => {
          const newMessageStats = new Map(state.messageStats);
          const currentStats = newMessageStats.get(roomId) || {
            totalMessages: 0,
            todayMessages: 0,
            unreadCount: 0,
            lastMessageTime: 0,
          };
          newMessageStats.set(roomId, { ...currentStats, ...stats });
          return { messageStats: newMessageStats };
        });
      },

      incrementMessageCount: (roomId) => {
        const now = Date.now();
        const today = new Date(now).toDateString();

        set((state) => {
          const newMessageStats = new Map(state.messageStats);
          const currentStats = newMessageStats.get(roomId) || {
            totalMessages: 0,
            todayMessages: 0,
            unreadCount: 0,
            lastMessageTime: 0,
          };

          // 检查是否是今天的消息
          const isToday = new Date(currentStats.lastMessageTime).toDateString() === today;

          newMessageStats.set(roomId, {
            ...currentStats,
            totalMessages: currentStats.totalMessages + 1,
            todayMessages: isToday ? currentStats.todayMessages + 1 : 1,
            lastMessageTime: now,
          });

          return { messageStats: newMessageStats };
        });
      },

      getMessageStats: (roomId) => {
        return get().messageStats.get(roomId) || null;
      },

      // 工具方法
      getSelectedMessagesCount: () => {
        return get().selectedMessages.size;
      },

      hasAnyDrafts: () => {
        for (const draft of get().drafts.values()) {
          if (draft.content.length > 0) {
            return true;
          }
        }
        return false;
      },

      getTypingTimeout: (roomId) => {
        const typingState = get().typingStates.get(roomId);
        if (typingState?.isTyping) {
          return Math.max(0, 3000 - (Date.now() - typingState.lastActivity));
        }
        return 0;
      },

      // 清理方法
      reset: () => {
        // 清理所有timeout
        const typingStates = get().typingStates;
        for (const state of typingStates.values()) {
          if (state.timeout) {
            clearTimeout(state.timeout);
          }
        }

        set(initialState);
      },

      clearRoomData: (roomId) => {
        set((state) => {
          const newDrafts = new Map(state.drafts);
          const newTypingStates = new Map(state.typingStates);
          const newMessageStats = new Map(state.messageStats);

          // 清理该房间的输入状态timeout
          const typingState = newTypingStates.get(roomId);
          if (typingState?.timeout) {
            clearTimeout(typingState.timeout);
          }

          newDrafts.delete(roomId);
          newTypingStates.delete(roomId);
          newMessageStats.delete(roomId);

          return {
            drafts: newDrafts,
            typingStates: newTypingStates,
            messageStats: newMessageStats,
          };
        });
      },
    })),
    { name: 'message-store' }
  )
);

// 选择器函数
export const messageSelectors = {
  // 获取房间草稿
  getRoomDraft: (state: MessageState, roomId: string) =>
    state.drafts.get(roomId) || null,

  // 检查是否有草稿
  hasRoomDraft: (state: MessageState, roomId: string) => {
    const draft = state.drafts.get(roomId);
    return draft ? draft.content.length > 0 : false;
  },

  // 获取选中消息数量
  getSelectedCount: (state: MessageState) => state.selectedMessages.size,

  // 检查是否正在输入
  isRoomTyping: (state: MessageState, roomId: string) => {
    const typingState = state.typingStates.get(roomId);
    return typingState?.isTyping || false;
  },

  // 获取待发送消息
  getPendingMessages: (state: MessageState) =>
    Array.from(state.pendingMessages.values()),

  // 获取发送失败的消息
  getFailedMessages: (state: MessageState) =>
    Array.from(state.failedMessages.values()),

  // 检查是否有活跃过滤器
  hasActiveFilters: (state: MessageState) =>
    Object.keys(state.messageFilters).length > 0,
};

export default useMessageStore;