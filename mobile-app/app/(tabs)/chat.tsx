import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getChatMessages, createChatMessage, type ChatMessage } from '../../src/lib/api';
import { useColors } from '../../src/lib/theme';
import { EventEmitter } from '../../src/lib/events';
import { format, parseISO } from 'date-fns';

function MessageBubble({ message, colors }: { message: ChatMessage; colors: ReturnType<typeof useColors> }) {
  const isUser = message.role === 'user';
  const bubbleBg = isUser ? colors.primary : colors.secondary;
  const textColor = isUser ? colors.primaryForeground : colors.foreground;

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      <View style={[styles.bubble, { backgroundColor: bubbleBg }, isUser && styles.bubbleUser]}>
        {message.image_url && (
          <Image
            source={{ uri: message.image_url.startsWith('http') ? message.image_url : `https://sifxtre.me${message.image_url}` }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        )}
        {message.text && (
          <Text style={[styles.messageText, { color: textColor }]}>{message.text}</Text>
        )}
        <Text style={[styles.timestamp, { color: isUser ? 'rgba(255,255,255,0.6)' : colors.mutedForeground }]}>
          {format(parseISO(message.created_at), 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async (beforeId?: number) => {
    try {
      const data = await getChatMessages({ limit: 30, before_id: beforeId });
      if (beforeId) {
        setMessages((prev) => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages);
      }
      setHasMore(data.has_more);
      setNextBeforeId(data.next_before_id);
    } catch {
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const loadOlderMessages = useCallback(() => {
    if (!hasMore || isLoadingMore || !nextBeforeId) return;
    setIsLoadingMore(true);
    loadMessages(nextBeforeId);
  }, [hasMore, isLoadingMore, nextBeforeId, loadMessages]);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText && !imageUri) return;

    setIsSending(true);
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      text: trimmedText || null,
      image_url: imageUri,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [userMessage, ...prev]);
    setText('');
    setImageUri(null);

    try {
      const response = await createChatMessage(trimmedText, imageUri ?? undefined);
      // Replace optimistic message and add reply
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== userMessage.id);
        return [response.reply, response.message, ...withoutOptimistic];
      });

      // Emit events based on action
      if (response.reply.action) {
        if (response.reply.action.includes('transaction')) EventEmitter.emit('transactions-changed');
        if (response.reply.action.includes('calendar') || response.reply.event_created) EventEmitter.emit('calendar-changed');
      }
    } catch {
      Alert.alert('Error', 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
        inverted
        contentContainerStyle={styles.listContent}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : null}
      />

      {/* Image Preview */}
      {imageUri && (
        <View style={[styles.imagePreview, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(null)}>
            <Ionicons name="close-circle" size={24} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
          <Ionicons name="image-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={takePhoto} style={styles.attachButton}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={text}
          onChangeText={setText}
          placeholder="Message Jarvis..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={isSending || (!text.trim() && !imageUri)}
          style={[styles.sendButton, { backgroundColor: colors.primary }, (isSending || (!text.trim() && !imageUri)) && { opacity: 0.4 }]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 4 },
  messageRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderBottomLeftRadius: 4 },
  bubbleUser: { borderBottomLeftRadius: 24, borderBottomRightRadius: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 8 },
  timestamp: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  imagePreview: { flexDirection: 'row', padding: 8, borderTopWidth: 1 },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  removeImage: { marginLeft: -12, marginTop: -8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, paddingBottom: 12, borderTopWidth: 1, gap: 6 },
  attachButton: { padding: 6, paddingBottom: 8 },
  textInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
  sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
