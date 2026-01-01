# Storage Audit Report - Taatom Project

## 📋 STEP 1: Database Structure Audit

### ✅ Models with Object Keys (GOOD)
1. **Song Model**
   - `storageKey` ✅
   - `cloudinaryKey` ✅
   - `s3Key` ✅

2. **Post Model**
   - `storageKey` ✅
   - `storageKeys[]` ✅

3. **User Model**
   - `profilePicStorageKey` ✅

4. **Locale Model**
   - `storageKey` ✅
   - `cloudinaryKey` ✅
   - `imageKey` ✅

### ❌ Models Storing Signed URLs (BAD)
1. **Song Model**
   - `cloudinaryUrl` ❌ (signed URL stored)
   - `s3Url` ❌ (signed URL stored)

2. **Post Model**
   - `imageUrl` ❌ (signed URL stored)
   - `images[]` ❌ (signed URLs stored)
   - `videoUrl` ❌ (signed URL stored)

3. **User Model**
   - `profilePic` ❌ (signed URL stored)

4. **Locale Model**
   - `cloudinaryUrl` ❌ (signed URL stored)
   - `imageUrl` ❌ (signed URL stored)

### 🔍 Controllers Saving Signed URLs
1. **songController.js** (line 178-179): Saves `cloudinaryUrl` and `s3Url`
2. **postController.js** (line 712-713): Saves `imageUrl` and `images[]`
3. **profileController.js** (line 323): Saves `profilePicUrl`

### 📊 Summary
- **Object keys ARE being stored** ✅
- **Signed URLs ARE ALSO being stored** ❌
- **Migration Required**: YES
- **Risk Level**: MEDIUM (URLs expire after 7 days)

## 🎯 Solution Strategy
1. Stop saving signed URLs during uploads
2. Generate signed URLs dynamically on API responses
3. Keep legacy URL fields for backward compatibility (read-only)
4. Create centralized media service for URL generation

