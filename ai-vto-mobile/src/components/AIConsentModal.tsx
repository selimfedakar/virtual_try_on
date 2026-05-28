import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

interface Props {
  visible: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

export default function AIConsentModal({ visible, onAgree, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>AI Processing Notice</Text>
          <Text style={styles.body}>
            To generate your virtual try-on, your uploaded photo and garment image will be securely transmitted to our AI partner{' '}
            <Text style={styles.highlight}>Fashn.ai</Text> over an encrypted HTTPS connection.{'\n\n'}
            We do not collect biometric or facial recognition data. Your images are used solely to generate a visual try-on result and are not shared with any other third parties or used for advertising.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
              <Text style={styles.agreeText}>I Agree</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: '#18181b', borderRadius: 20, padding: 24,
    width: '100%', borderWidth: 1, borderColor: '#2a2a2a',
  },
  title: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 14 },
  body: { color: '#a1a1aa', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  highlight: { color: '#4a90d0', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 100, alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  cancelText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  agreeBtn: {
    flex: 1, padding: 14, borderRadius: 100, alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  agreeText: { color: '#000000', fontSize: 15, fontWeight: 'bold' },
});
