import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 2 }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderTopWidth: 1,
          borderTopColor: '#3a3a3a',
          elevation: 0,
          height: 82,
        },
        tabBarBackground: () => (
          <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#707070',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 6,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Try On',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Fit',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📏" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Closet',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stylist"
        options={{
          title: 'Stylist',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🪄" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: 'Share',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginTop: 3,
  },
});
