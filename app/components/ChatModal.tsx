import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type ChatMessage = {
  message: string;
  sender: string;
  timestamp?: string;
};

type Props = {
  visible: boolean;
  messages: ChatMessage[];
  quickReplies: string[];
  chatInput: string;
  onChangeInput: (value: string) => void;
  onSend: () => void;
  onQuickReply: (reply: string) => void;
  onClose: () => void;
};

export default function ChatModal({
  visible,
  messages,
  quickReplies,
  chatInput,
  onChangeInput,
  onSend,
  onQuickReply,
  onClose,
}: Props) {
  const { isDarkMode, isRTL } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  return (
    <View style={styles.chatModal}>
      <View style={styles.chatModalCard}>
        <View style={styles.chatModalHeader}>
          <Text style={styles.chatModalTitle}>{t('chat_with_passenger')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.chatModalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.chatMessages}>
          {messages.map((msg, idx) => (
            <View
              key={idx}
              style={[
                styles.chatMessage,
                msg.sender === 'driver' ? styles.driverMessage : styles.passengerMessage,
              ]}
            >
              <Text style={styles.messageText}>{msg.message}</Text>
            </View>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesContainer}>
          {quickReplies.map((reply, idx) => (
            <TouchableOpacity key={idx} style={styles.quickReplyButton} onPress={() => onQuickReply(reply)}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={onChangeInput}
            placeholder={t('chat_type_message')}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.chatSendButton} onPress={onSend}>
            <Text style={styles.chatSendButtonText}>{t('send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  chatModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 2000,
  },
  chatModalCard: {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
    paddingBottom: 10,
  },
  chatModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
  },
  chatModalClose: {
    fontSize: 20,
    color: isDarkMode ? '#94a3b8' : '#64748b',
    padding: 4,
  },
  chatMessages: {
    maxHeight: 300,
    marginBottom: 10,
  },
  chatMessage: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    maxWidth: '80%',
  },
  driverMessage: {
    backgroundColor: '#38bdf8',
    alignSelf: 'flex-end',
  },
  passengerMessage: {
    backgroundColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
    alignSelf: 'flex-start',
  },
  messageText: {
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    fontSize: 14,
    lineHeight: 20,
  },
  quickRepliesContainer: {
    maxHeight: 40,
    marginBottom: 10,
  },
  quickReplyButton: {
    backgroundColor: isDarkMode ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(56,189,248,0.3)' : '#7dd3fc',
  },
  quickReplyText: {
    color: isDarkMode ? '#7dd3fc' : '#0c4a6e',
    fontSize: 13,
    fontWeight: '600',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.3)' : '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
  },
  chatSendButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chatSendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
