import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PhotoOwnershipModal({ visible, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Photo Upload Policy</Text>
          <Text style={styles.body}>
            VTO is a personal fashion shopping tool. Before uploading a photo, please read and confirm the following:
          </Text>
          <View style={styles.itemsBox}>
            <Text style={styles.item}>✓  This photo is of myself</Text>
            <Text style={styles.item}>✓  I will not upload photos of other people without their explicit written consent</Text>
            <Text style={styles.item}>✓  I understand that any misuse results in immediate permanent account suspension and may be reported to authorities</Text>
          </View>
          <Text style={styles.footer}>
            VTO is designed exclusively for personal fashion shopping — to help you visualize clothing items before purchasing. Generating imagery of other individuals without their consent is strictly prohibited.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>I Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  body: { color: '#a1a1aa', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  itemsBox: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  item: { color: '#d4d4d8', fontSize: 13, lineHeight: 20 },
  footer: {
    color: '#52525b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  cancelText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  confirmText: { color: '#000000', fontSize: 15, fontWeight: 'bold' },
});
