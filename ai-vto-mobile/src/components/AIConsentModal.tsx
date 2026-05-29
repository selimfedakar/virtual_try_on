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
          <Text style={styles.title}>Data Processing Consent</Text>
          <Text style={styles.body}>
            To generate your virtual try-on preview, your uploaded photo will be securely transmitted to our AI processing partner,{' '}
            <Text style={styles.highlight}>Fashn.ai</Text>.{'\n\n'}
            This data is exclusively used for clothing visualization and is not stored, sold, or shared for any other purpose. Processing will not begin unless you provide explicit consent.
          </Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataItem}>📤  What is sent: Your uploaded photo</Text>
            <Text style={styles.dataItem}>🤝  Sent to: Fashn.ai (AI processing partner)</Text>
            <Text style={styles.dataItem}>🎯  Purpose: Virtual clothing visualization only</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
              <Text style={styles.agreeText}>I Consent</Text>
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
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: '#18181b', borderRadius: 20, padding: 24,
    width: '100%', borderWidth: 1, borderColor: '#2a2a2a',
  },
  title: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  body: { color: '#a1a1aa', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  highlight: { color: '#4a90d0', fontWeight: '600' },
  dataRow: {
    backgroundColor: '#0f0f0f', borderRadius: 12, padding: 14, gap: 8, marginBottom: 20,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  dataItem: { color: '#d4d4d8', fontSize: 13, lineHeight: 19 },
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
