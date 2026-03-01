import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatMessage, Conversation } from '../../services/chat';
import { ChatRoom } from '../../services/websocket/roomManager';

// 聊天状态接口
export interface ChatState {
  // 连接状态
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // 当前用户
  currentUserId: string | null;
  currentUsername: string | null;

  // 房间管理
  rooms: ChatRoom[];
  currentRoomId: string | null;
  joinedRooms: Set<string>;

  // 消息管理
  messages: Map<string, ChatMessage[]>; // roomId -> messages
  unreadCounts: Map<string, number>; // roomId -> unread count
  lastMessageIds: Map<string, string>; // roomId -> last message id

  // 用户状态
  onlineUsers: Map<string, string[]>; // roomId -> user ids
  typingUsers: Map<string, Set<string>>; // roomId -> typing user ids

  // UI状态
  isSidebarVisible: boolean;
  isEmojiPickerVisible: boolean;
  replyToMessage: ChatMessage | null;
  selectedMessages: Set<string>;

  // 加载状态
  loadingStates: Map<string, boolean>; // roomId -> loading
  sendingStates: Map<string, boolean>; // messageId -> sending

  // 错误状态
  errors: Map<string, string>; // operation -> error message
}

// 聊天操作接口
export interface ChatActions {
  // 连接管理
  setConnectionStatus: (status: {
    isConnected: boolean;
    isConnecting: boolean;
    error?: string;
  }) => void;

  // 用户管理
  setCurrentUser: (userId: string, username: string) => void;
  clearCurrentUser: () => void;

  // 房间管理
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (room: ChatRoom) => void;
  updateRoom: (roomId: string, updates: Partial<ChatRoom>) => void;
  removeRoom: (roomId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;

  // 消息管理
  setMessages: (roomId: string, messages: ChatMessage[]) => void;
  addMessage: (roomId: string, message: ChatMessage) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (roomId: string, messageId: string) => void;
  prependMessages: (roomId: string, messages: ChatMessage[]) => void;
  clearMessages: (roomId: string) => void;

  // 未读计数管理
  setUnreadCount: (roomId: string, count: number) => void;
  incrementUnreadCount: (roomId: string) => void;
  clearUnreadCount: (roomId: string) => void;

  // 用户状态管理
  setOnlineUsers: (roomId: string, userIds: string[]) => void;
  addOnlineUser: (roomId: string, userId: string) => void;
  removeOnlineUser: (roomId: string, userId: string) => void;
  setTypingUsers: (roomId: string, userIds: string[]) => void;
  addTypingUser: (roomId: string, userId: string) => void;
  removeTypingUser: (roomId: string, userId: string) => void;

  // UI状态管理
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleEmojiPicker: () => void;
  setEmojiPickerVisible: (visible: boolean) => void;
  setReplyToMessage: (message: ChatMessage | null) => void;
  toggleMessageSelection: (messageId: string) => void;
  clearSelectedMessages: () => void;

  // 加载状态管理
  setLoading: (roomId: string, loading: boolean) => void;
  setSending: (messageId: string, sending: boolean) => void;

  // 错误管理
  setError: (operation: string, error: string) => void;
  clearError: (operation: string) => void;
  clearAllErrors: () => void;

  // 工具方法
  getCurrentRoom: () => ChatRoom | null;
  getRoomMessages: (roomId: string) => ChatMessage[];
  getTotalUnreadCount: () => number;
  getTypingUsersForRoom: (roomId: string) => string[];
  isUserOnline: (roomId: string, userId: string) => boolean;

  // 清理方法
  reset: () => void;
}

// 初始状态
const initialState: ChatState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,

  currentUserId: null,
  currentUsername: null,

  rooms: [],
  currentRoomId: null,
  joinedRooms: new Set(),

  messages: new Map(),
  unreadCounts: new Map(),
  lastMessageIds: new Map(),

  onlineUsers: new Map(),
  typingUsers: new Map(),

  isSidebarVisible: true,
  isEmojiPickerVisible: false,
  replyToMessage: null,
  selectedMessages: new Set(),

  loadingStates: new Map(),
  sendingStates: new Map(),

  errors: new Map(),
};

// 创建聊天Store
export const useChatStore = create<ChatState & ChatActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 连接管理
    setConnectionStatus: (status) => {
      set({
        isConnected: status.isConnected,
        isConnecting: status.isConnecting,
        connectionError: status.error || null,
      });
    },

    // 用户管理
    setCurrentUser: (userId, username) => {
      set({
        currentUserId: userId,
        currentUsername: username,
      });
    },

    clearCurrentUser: () => {
      set({
        currentUserId: null,
        currentUsername: null,
      });
    },

    // 房间管理
    setRooms: (rooms) => {
      set({ rooms });
    },

    addRoom: (room) => {
      set((state) => ({
        rooms: [...state.rooms.filter(r => r.id !== room.id), room],
      }));
    },

    updateRoom: (roomId, updates) => {
      set((state) => ({
        rooms: state.rooms.map(room =>
          room.id === roomId ? { ...room, ...updates } : room
        ),
      }));
    },

    removeRoom: (roomId) => {
      set((state) => {
        const newRooms = state.rooms.filter(room => room.id !== roomId);
        const newJoinedRooms = new Set(state.joinedRooms);
        newJoinedRooms.delete(roomId);

        // 清理相关数据
        const newMessages = new Map(state.messages);
        const newUnreadCounts = new Map(state.unreadCounts);
        const newOnlineUsers = new Map(state.onlineUsers);
        const newTypingUsers = new Map(state.typingUsers);
        const newLoadingStates = new Map(state.loadingStates);

        newMessages.delete(roomId);
        newUnreadCounts.delete(roomId);
        newOnlineUsers.delete(roomId);
        newTypingUsers.delete(roomId);
        newLoadingStates.delete(roomId);

        return {
          rooms: newRooms,
          joinedRooms: newJoinedRooms,
          messages: newMessages,
          unreadCounts: newUnreadCounts,
          onlineUsers: newOnlineUsers,
          typingUsers: newTypingUsers,
          loadingStates: newLoadingStates,
          currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
        };
      });
    },

    setCurrentRoom: (roomId) => {
      set({ currentRoomId: roomId });

      // 清除当前房间的未读计数
      if (roomId) {
        get().clearUnreadCount(roomId);
      }
    },

    joinRoom: (roomId) => {
      set((state) => {
        const newJoinedRooms = new Set(state.joinedRooms);
        newJoinedRooms.add(roomId);
        return { joinedRooms: newJoinedRooms };
      });
    },

    leaveRoom: (roomId) => {
      set((state) => {
        const newJoinedRooms = new Set(state.joinedRooms);
        newJoinedRooms.delete(roomId);
        return {
          joinedRooms: newJoinedRooms,
          currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
        };
      });
    },

    // 消息管理
    setMessages: (roomId, messages) => {
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(roomId, messages);

        const newLastMessageIds = new Map(state.lastMessageIds);
        if (messages.length > 0) {
          newLastMessageIds.set(roomId, messages[messages.length - 1].id);
        }

        return {
          messages: newMessages,
          lastMessageIds: newLastMessageIds,
        };
      });
    },

    addMessage: (roomId, message) => {
      set((state) => {
        const currentMessages = state.messages.get(roomId) || [];
        const newMessages = new Map(state.messages);
        newMessages.set(roomId, [...currentMessages, message]);

        const newLastMessageIds = new Map(state.lastMessageIds);
        newLastMessageIds.set(roomId, message.id);

        // 如果不是当前房间，增加未读计数
        let newUnreadCounts = new Map(state.unreadCounts);
        if (roomId !== state.currentRoomId && message.sender_id !== state.currentUserId) {
          const currentCount = newUnreadCounts.get(roomId) || 0;
          newUnreadCounts.set(roomId, currentCount + 1);
        }

        return {
          messages: newMessages,
          lastMessageIds: newLastMessageIds,
          unreadCounts: newUnreadCounts,
        };
      });
    },

    updateMessage: (roomId, messageId, updates) => {
      set((state) => {
        const currentMessages = state.messages.get(roomId) || [];
        const newMessages = new Map(state.messages);
        newMessages.set(
          roomId,
          currentMessages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          )
        );
        return { messages: newMessages };
      });
    },

    removeMessage: (roomId, messageId) => {
      set((state) => {
        const currentMessages = state.messages.get(roomId) || [];
        const newMessages = new Map(state.messages);
        newMessages.set(
          roomId,
          currentMessages.filter(msg => msg.id !== messageId)
        );
        return { messages: newMessages };
      });
    },

    prependMessages: (roomId, messages) => {
      set((state) => {
        const currentMessages = state.messages.get(roomId) || [];
        const newMessages = new Map(state.messages);
        newMessages.set(roomId, [...messages, ...currentMessages]);
        return { messages: newMessages };
      });
    },

    clearMessages: (roomId) => {
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.delete(roomId);
        return { messages: newMessages };
      });
    },

    // 未读计数管理
    setUnreadCount: (roomId, count) => {
      set((state) => {
        const newUnreadCounts = new Map(state.unreadCounts);
        newUnreadCounts.set(roomId, count);
        return { unreadCounts: newUnreadCounts };
      });
    },

    incrementUnreadCount: (roomId) => {
      set((state) => {
        const newUnreadCounts = new Map(state.unreadCounts);
        const currentCount = newUnreadCounts.get(roomId) || 0;
        newUnreadCounts.set(roomId, currentCount + 1);
        return { unreadCounts: newUnreadCounts };
      });
    },

    clearUnreadCount: (roomId) => {
      set((state) => {
        const newUnreadCounts = new Map(state.unreadCounts);
        newUnreadCounts.set(roomId, 0);
        return { unreadCounts: newUnreadCounts };
      });
    },

    // 用户状态管理
    setOnlineUsers: (roomId, userIds) => {
      set((state) => {
        const newOnlineUsers = new Map(state.onlineUsers);
        newOnlineUsers.set(roomId, userIds);
        return { onlineUsers: newOnlineUsers };
      });
    },

    addOnlineUser: (roomId, userId) => {
      set((state) => {
        const currentUsers = state.onlineUsers.get(roomId) || [];
        const newOnlineUsers = new Map(state.onlineUsers);
        if (!currentUsers.includes(userId)) {
          newOnlineUsers.set(roomId, [...currentUsers, userId]);
        }
        return { onlineUsers: newOnlineUsers };
      });
    },

    removeOnlineUser: (roomId, userId) => {
      set((state) => {
        const currentUsers = state.onlineUsers.get(roomId) || [];
        const newOnlineUsers = new Map(state.onlineUsers);
        newOnlineUsers.set(roomId, currentUsers.filter(id => id !== userId));
        return { onlineUsers: newOnlineUsers };
      });
    },

    setTypingUsers: (roomId, userIds) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        newTypingUsers.set(roomId, new Set(userIds));
        return { typingUsers: newTypingUsers };
      });
    },

    addTypingUser: (roomId, userId) => {
      set((state) => {
        const currentUsers = state.typingUsers.get(roomId) || new Set();
        const newTypingUsers = new Map(state.typingUsers);
        const newSet = new Set(currentUsers);
        newSet.add(userId);
        newTypingUsers.set(roomId, newSet);
        return { typingUsers: newTypingUsers };
      });
    },

    removeTypingUser: (roomId, userId) => {
      set((state) => {
        const currentUsers = state.typingUsers.get(roomId) || new Set();
        const newTypingUsers = new Map(state.typingUsers);
        const newSet = new Set(currentUsers);
        newSet.delete(userId);
        newTypingUsers.set(roomId, newSet);
        return { typingUsers: newTypingUsers };
      });
    },

    // UI状态管理
    toggleSidebar: () => {
      set((state) => ({
        isSidebarVisible: !state.isSidebarVisible,
      }));
    },

    setSidebarVisible: (visible) => {
      set({ isSidebarVisible: visible });
    },

    toggleEmojiPicker: () => {
      set((state) => ({
        isEmojiPickerVisible: !state.isEmojiPickerVisible,
      }));
    },

    setEmojiPickerVisible: (visible) => {
      set({ isEmojiPickerVisible: visible });
    },

    setReplyToMessage: (message) => {
      set({ replyToMessage: message });
    },

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

    clearSelectedMessages: () => {
      set({ selectedMessages: new Set() });
    },

    // 加载状态管理
    setLoading: (roomId, loading) => {
      set((state) => {
        const newLoadingStates = new Map(state.loadingStates);
        newLoadingStates.set(roomId, loading);
        return { loadingStates: newLoadingStates };
      });
    },

    setSending: (messageId, sending) => {
      set((state) => {
        const newSendingStates = new Map(state.sendingStates);
        if (sending) {
          newSendingStates.set(messageId, true);
        } else {
          newSendingStates.delete(messageId);
        }
        return { sendingStates: newSendingStates };
      });
    },

    // 错误管理
    setError: (operation, error) => {
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set(operation, error);
        return { errors: newErrors };
      });
    },

    clearError: (operation) => {
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.delete(operation);
        return { errors: newErrors };
      });
    },

    clearAllErrors: () => {
      set({ errors: new Map() });
    },

    // 工具方法
    getCurrentRoom: () => {
      const state = get();
      return state.rooms.find(room => room.id === state.currentRoomId) || null;
    },

    getRoomMessages: (roomId) => {
      const state = get();
      return state.messages.get(roomId) || [];
    },

    getTotalUnreadCount: () => {
      const state = get();
      let total = 0;
      for (const count of state.unreadCounts.values()) {
        total += count;
      }
      return total;
    },

    getTypingUsersForRoom: (roomId) => {
      const state = get();
      const typingSet = state.typingUsers.get(roomId) || new Set();
      return Array.from(typingSet);
    },

    isUserOnline: (roomId, userId) => {
      const state = get();
      const onlineUsers = state.onlineUsers.get(roomId) || [];
      return onlineUsers.includes(userId);
    },

    // 清理方法
    reset: () => {
      set(initialState);
    },
  }))
);

// 选择器函数
export const chatSelectors = {
  // 获取当前房间
  getCurrentRoom: (state: ChatState) =>
    state.rooms.find(room => room.id === state.currentRoomId) || null,

  // 获取已加入的房间
  getJoinedRooms: (state: ChatState) =>
    state.rooms.filter(room => state.joinedRooms.has(room.id)),

  // 获取房间消息
  getRoomMessages: (state: ChatState, roomId: string) =>
    state.messages.get(roomId) || [],

  // 获取总未读数
  getTotalUnreadCount: (state: ChatState) => {
    let total = 0;
    for (const count of state.unreadCounts.values()) {
      total += count;
    }
    return total;
  },

  // 检查是否有错误
  hasErrors: (state: ChatState) => state.errors.size > 0,

  // 检查是否正在加载
  isLoading: (state: ChatState, roomId?: string) => {
    if (roomId) {
      return state.loadingStates.get(roomId) || false;
    }
    return Array.from(state.loadingStates.values()).some(loading => loading);
  },
};

export default useChatStore;