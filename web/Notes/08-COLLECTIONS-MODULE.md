# Collections Module – Developer Guide

Documentation for the **Collections** module (trip/photo collections).

---

## 1. Purpose & User Flow

- **Screens:** `app/collections/index.tsx` (list), `app/collections/create.tsx` (create), `app/collections/[id].tsx` (detail).
- **Purpose:** User-created collections (e.g. trip albums): create, rename, set public/private, add/remove posts, reorder posts; view collection with cover and post grid.
- **User flow:** Open Collections → create new or tap existing → in detail add/remove/reorder posts; edit name/description/visibility.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **List** | `getCollections(userId?)` → list of collections. |
| **Create** | `createCollection({ name, description?, isPublic? })`. |
| **Detail** | `getCollection(collectionId)` → collection with posts array. |
| **Update** | `updateCollection(collectionId, { name?, description?, isPublic? })`. |
| **Delete** | `deleteCollection(collectionId)` with confirmation. |
| **Add post** | `addPostToCollection(collectionId, postId)`. |
| **Remove post** | `removePostFromCollection(collectionId, postId)`. |
| **Reorder** | `reorderCollectionPosts(collectionId, postIds[])`. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/collections` | List collections (optional query: userId). |
| POST | `/api/v1/collections` | Create (body: name, description?, isPublic?). |
| GET | `/api/v1/collections/${collectionId}` | Get one collection with posts. |
| PUT | `/api/v1/collections/${collectionId}` | Update. |
| DELETE | `/api/v1/collections/${collectionId}` | Delete. |
| POST | `/api/v1/collections/${collectionId}/posts` | Add post (body: { postId }). |
| DELETE | `/api/v1/collections/${collectionId}/posts/${postId}` | Remove post. |
| PUT | `/api/v1/collections/${collectionId}/reorder` | Reorder (body: { postIds }). |

---

## 4. Types & Schemas

**Collection:** _id, name, description?, user, posts (PostType[]), coverImage?, isPublic, order?, createdAt, updatedAt.

**CreateCollectionData:** name, description?, isPublic?.

**UpdateCollectionData:** name?, description?, isPublic?.

---

## 5. File Map

| File | Role |
|------|------|
| `app/collections/index.tsx` | List collections. |
| `app/collections/create.tsx` | Create form. |
| `app/collections/[id].tsx` | Detail, add/remove/reorder posts. |
| `services/collections.ts` | All collection API calls. |
| `types/post.ts` | PostType for posts in collection. |

---

## 6. Collection type – full schema (technical)

**Collection:** _id, name, description?, user ({ _id, fullName, profilePic, username? }), posts (PostType[]), coverImage?, isPublic (boolean), order?, createdAt, updatedAt.

**CreateCollectionData:** name (required), description?, isPublic?.

**UpdateCollectionData:** name?, description?, isPublic?.

---

## 7. Add/remove post (functional)

- **Add:** User in collection detail picks a post (from feed or profile); call addPostToCollection(collectionId, postId). Backend returns updated collection; frontend updates state or refetches getCollection(collectionId).
- **Remove:** From collection detail, remove button on a post; call removePostFromCollection(collectionId, postId); update local state (filter out post) or refetch.
- **Reorder:** If UI supports drag-and-drop order, collect new order of postIds and call reorderCollectionPosts(collectionId, postIds). Backend reorders; frontend updates list.

---

## 8. Delete collection (functional)

- Confirmation (showDestructiveConfirm): "Delete this collection? Posts won't be deleted." On confirm deleteCollection(collectionId); on success navigate back to list and showSuccess. On error showError.

---

## 9. List & create flow (step-by-step)

- **List:** getCollections() (no userId = current user's collections). Display name, cover (first post image or coverImage), post count; tap → navigate to [id].
- **Create:** create.tsx form: name (required), description, isPublic toggle; onSubmit createCollection({ name, description, isPublic }); on success navigate to new collection [id] or list with showSuccess.

---

*Posts: [02-POST-MODULE.md](./02-POST-MODULE.md). API: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*
