import React, { useState } from 'react';
import {
  Alert, StyleSheet, View, TextInput, TouchableOpacity,
  Text, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../src/lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

type Mode = 'signin' | 'signup';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    } else {
      router.replace('/(tabs)/home');
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else if (session) {
      router.replace('/(tabs)/home');
    } else {
      Alert.alert('Check your email', 'We sent a verification link to your inbox.');
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email address in the field above first.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Email sent', 'Check your inbox for a password reset link.');
    }
  }

  const handleSubmit = () => (mode === 'signin' ? signInWithEmail() : signUpWithEmail());

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>VTO</Text>
          </View>
          <Text style={styles.appName}>Virtual Try-On</Text>
          <Text style={styles.appTagline}>AI Fashion Studio</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => setMode('signin')}
          >
            <Text style={mode === 'signin' ? styles.modeBtnTextActive : styles.modeBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={mode === 'signup' ? styles.modeBtnTextActive : styles.modeBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="email@address.com"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Password'}
              placeholderTextColor="#52525b"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryButtonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
            }
          </TouchableOpacity>

          {mode === 'signin' && (
            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.footerText}>_fedakar's product, always for something better!</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, padding: 28, justifyContent: 'center' },

  logoArea: { alignItems: 'center', marginBottom: 44 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#0a1b2e', borderWidth: 1.5, borderColor: '#1e4878',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoBadgeText: { color: '#4a90d0', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  appName: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: 0.4 },
  appTagline: { color: '#52525b', fontSize: 13, marginTop: 4, fontWeight: '500' },

  modeToggle: {
    flexDirection: 'row', backgroundColor: '#111111', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e1e1e', marginBottom: 28, overflow: 'hidden',
  },
  modeBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#ffffff' },
  modeBtnText: { color: '#555', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#000000', fontSize: 14, fontWeight: '700' },

  form: { gap: 18, marginBottom: 24 },
  inputContainer: { gap: 7 },
  label: { color: '#a1a1aa', fontSize: 13, fontWeight: '600', marginLeft: 2 },
  input: {
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 14, padding: 16, color: '#ffffff', fontSize: 16,
  },

  actions: { gap: 14 },
  primaryButton: {
    backgroundColor: '#ffffff', padding: 18, borderRadius: 100, alignItems: 'center',
  },
  primaryButtonText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: '#52525b', fontSize: 14, fontWeight: '500' },

  footerText: {
    color: '#2a2a2a', fontSize: 11, textAlign: 'center',
    paddingBottom: 18, fontStyle: 'italic', letterSpacing: 0.3,
  },
});
