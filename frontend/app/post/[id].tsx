/* 
 * POST DETAIL PAGE - COMMENTED OUT
 * This page has been temporarily disabled. All navigation to /post/[id] routes to home page instead.
 * To re-enable: Restore the original file content from version control or git history.
 */

import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

// Stub component that redirects to home with postId parameter
export default function PostDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  useEffect(() => {
    // Redirect to home page with postId parameter to scroll to specific post
    if (id) {
      router.replace(`/(tabs)/home?postId=${id}`);
    } else {
      router.replace('/(tabs)/home');
    }
  }, [router, id]);
  
  return null;
}
