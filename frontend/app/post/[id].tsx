import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Post ID: {id}</Text>
      {/* You can fetch and display the post details here */}
    </View>
  );
}
