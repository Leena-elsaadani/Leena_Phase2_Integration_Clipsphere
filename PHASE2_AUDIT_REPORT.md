# ClipSphere Phase 2 Audit Report
**Phase**: Phase 2 – Next.js Integration & Local Media Pipeline  
**Date**: April 16, 2026  
**Project**: ClipSphere (Short-form Video Platform)  
**Repository**: dareen-phase2-fullstack branch

---

## EXECUTIVE SUMMARY

**Overall Status**: 🟡 **70% COMPLETE** — Core infrastructure is in place, but critical features are incomplete or improperly integrated.

### Key Issues
1. ❌ **Video Edit/Delete** — Routes exist but controllers return 501 (Not Implemented)
2. ❌ **Email Notifications** — Service exists but silently disabled without SMTP config
3. ⚠️  **Middleware Auth** — Frontend Next.js middleware does not enforce route protection
4. ⚠️  **Video Update/Delete UI** — Buttons exist on watch page but have no event handlers
5. ⚠️  **Email Preference Check** — Not integrated into notification triggers
6. ✅ **Core Feed, Upload, Video Playback** — Functional for display

---

## SECTION 1: FULL IMPLEMENTATION AUDIT

### 1.1 NEXT.JS & TAILWIND SETUP

| Requirement | Status | Evidence |
|---|---|---|
| **Next.js App Router** | ✅ Fully Implemented | `frontend/` directory with `app/` folder structure; routes exist for login, upload, feed, watch, profile, admin |
| **Responsive Mobile-First Design** | ✅ Fully Implemented | Tailwind configured; grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` for adaptive layout |
| **Navigation System** | ✅ Partially Implemented | No global navbar (Checked `frontend/app/layout.tsx` - no top navigation component) |
| **Tailwind CSS Setup** | ✅ Fully Implemented | `tailwind.config.js` with content paths, extended colors (zinc-950) |
| **Client-Side Security** | ⚠️  Partially Implemented | |
| • JWT Middleware | ❌ Not Enforced | `middleware.ts` exists but is a **no-op** — just returns `NextResponse.next()` |
| • useAuth Hook | ✅ Implemented | Fetches `/users/me` endpoint, stores user state, provides logout method |
| • Auth State Persistence | ⚠️  Limited | Session only persists via HTTP-only cookie; no explicit token refresh logic |
| **State Management** | ✅ Implemented | React hooks (useState, useEffect) used throughout; `useFeed.js` manages infinite scroll state |

**Issues Found**:
- **Middleware Issue**: `middleware.ts` docs state auth is "enforced by Express protectMiddleware", but this defeats the purpose of Next.js middleware. Client-side routes like `/upload` and `/admin` are not protected at the page level — only at the API level.
- **No Global Navigation**: No navbar/header component visible; users cannot easily navigate between pages.

---

### 1.2 LOCAL MINIO INFRASTRUCTURE

| Requirement | Status | Evidence |
|---|---|---|
| **Docker Compose Setup** | ✅ Fully Implemented | `docker-compose.yml` defines mongo, minio, minio_init, backend services |
| **MinIO Console Access** | ✅ Configured | Port 9001 mapped for MinIO console |
| **AWS S3 SDK Integration** | ✅ Fully Implemented | `backend/src/config/s3.js` initializes `S3Client` with MinIO endpoint |
| **Presigned URLs** | ✅ Implemented | `s3Service.js` provides `generateUploadURL()`, `generateDownloadURL()` |
| **Presigned URL Expiry** | ✅ Configured | UPLOAD_EXPIRY (300s), DOWNLOAD_EXPIRY (3600s) from env vars |
| **Object Storage Security** | ✅ Implemented | Files stored privately; served only via presigned URLs |

**Issues Found**: None — MinIO infrastructure and presigned URL generation are working correctly.

---

### 1.3 CONTENT VALIDATION & STORAGE

| Requirement | Status | Evidence |
|---|---|---|
| **Duration Enforcement** | ✅ Fully Implemented | `videoUpload.js` uses ffprobe to validate; rejects > 300s |
| **File Type Filtering** | ✅ Fully Implemented | Multer config only accepts `video/mp4` |
| **File Size Restriction** | ✅ Fully Implemented | Multer `fileSize: MAX_SIZE_BYTES` (default 200MB) |
| **Memory-Based Storage** | ✅ Fully Implemented | Multer uses `memoryStorage()` instead of disk |
| **Object Key Storage** | ✅ Partially Implemented | ObjectKey saved as `videoKey` in MongoDB after successful S3 upload |
| **Atomic Upload** | ✅ Implemented | Rolls back MongoDB if S3 fails; rolls back S3 if MongoDB fails |

**Issues Found**: None — validation pipeline and atomicity are correct.

---

### 1.4 RESPONSIVE DISCOVERY & SCROLLABLE FEEDS

| Requirement | Status | Evidence |
|---|---|---|
| **Grid System (1/2/3-4 cols)** | ✅ Fully Implemented | `feed/page.tsx` uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` |
| **Paginated API** | ✅ Fully Implemented | Backend: `limit` & `skip` query params; Frontend: `useFeed.js` manages pagination state |
| **Infinite Scroll** | ✅ Fully Implemented | `feed/page.tsx` uses IntersectionObserver to detect sentinel; calls `loadMore()` when near bottom |
| **Following Feed** | ✅ Fully Implemented | Route `/videos/following` filters by followed user IDs |
| **Trending Feed** | ✅ Partially Implemented | Route `/videos/trending` sorts by `trendingScore` desc, then `createdAt` desc |
| • Trending Score Calc | ❌ Missing | No backend logic updates `trendingScore`; field remains 0 |
| **Feed Filtering** | ✅ Implemented | Separates public, following, trending tabs |

**Issues Found**:
- **Trending Score Not Updated**: `trendingScore` field exists but is never incremented. Phase 1 should have "aggregation pipelines" for this, but they're not integrated here.
- **No Lazy Loading Images**: Video cards display thumbnails without optimization.

---

### 1.5 VIDEO INTERACTION & REVIEW UI

| Requirement | Status | Evidence |
|---|---|---|
| **Video Player** | ✅ Fully Implemented | HTML5 `<video>` element with custom controls in `watch/[id]/page.jsx` |
| **Custom Controls** | ✅ Implemented | Play/pause button, progress bar, seek functionality |
| **Duration Overlay** | ✅ Implemented | Displays in top-right corner |
| **Star-Rating System** | ✅ Fully Implemented | `ReviewSection.tsx` shows 5-star picker and submission form |
| **Comment Fields** | ✅ Fully Implemented | `CommentSection.tsx` allows text input and submission |
| **UI Positioning** | ✅ Implemented | Sections below player as required |
| **Dynamic Ownership UI** | ⚠️  Partially Implemented | |
| • Edit Button | ❌ Non-Functional | Button renders but has **no onClick handler** |
| • Delete Button | ❌ Non-Functional | Button renders but has **no onClick handler** |
| • Show Only to Owner/Admin | ✅ Implemented | Correctly checks `isOwner || isAdmin` before rendering |
| **Like/Unlike Real-time Updates** | ✅ Optimistic UI | `LikeButton.tsx` updates UI immediately; syncs API async |
| **Review Submission Real-time** | ✅ Optimistic UI | `ReviewSection.tsx` adds temporarily; replaces after API confirms |
| **Comment Submission Real-time** | ✅ Optimistic UI | `CommentSection.tsx` adds temporarily; replaces after API confirms |

**Issues Found**:
- **Edit/Delete Buttons Non-Functional**: Buttons exist in UI but lack click handlers.
- **Edit/Delete Backend Not Implemented**: Controller functions return 501 Not Implemented.
- **No Edit Modal/Form**: No UI for editing video metadata.
- **No Delete Confirmation**: Delete button could be too easy to trigger accidentally.

---

### 1.6 ENGAGEMENT & EMAIL AUTOMATION

| Requirement | Status | Evidence |
|---|---|---|
| **Email Service** | ⚠️  Partially Implemented | `email.service.js` provides `sendWelcomeEmail()` and `sendEngagementEmail()` |
| **Email Templates** | ✅ Implemented | HTML templates for welcome and engagement emails |
| **Nodemailer Integration** | ✅ Implemented | Configured with SMTP credentials from env |
| **Welcome Email Trigger** | ✅ Implemented | Sent in `register()` via `sendWelcomeEmail()` (non-blocking) |
| **Engagement Email Triggers** | ❌ Not Implemented | No email sent on like, comment, review, or follow |
| **Notification Preferences Check** | ❌ Not Implemented | Service does not query user's `notificationPreferences` before sending |
| **SMTP Configuration** | ⚠️  Silent Failure | If SMTP credentials missing, transporter is `null` and emails silently fail |

**Issues Found**:
- **Engagement Emails Not Sent**: Only welcome email works; no triggers for likes, comments, or follows
- **No Preference Enforcement**: Email service doesn't respect user notification settings
- **Silent Email Failure**: Missing SMTP config doesn't log warning to production; admins won't know why emails aren't sending
- **No Email Fallback**: No in-app notifications if email is disabled

---

### 1.7 ADMIN DASHBOARD UI

| Requirement | Status | Evidence |
|---|---|---|
| **Admin Route Protection** | ✅ Implemented | Backend `/admin/*` routes require `protect` + `restrictTo(['admin'])` |
| **Client-Side Route Guard** | ✅ Implemented | `admin/page.tsx` checks `user.role === 'admin'` and redirects to home |
| **Admin Dashboard Rendering** | ✅ Implemented | Displays stats cards and health metrics |
| **Statistics Display** | ✅ Implemented | Shows total users, total videos, flagged videos, most active users |
| **System Health Metrics** | ✅ Implemented | Shows uptime, memory, database status |
| **Data from Phase 1 Admin Endpoints** | ✅ Implemented | Fetches `/admin/stats` and `/admin/health` |
| **Admin-Only Access** | ✅ Enforced | Both client and server validation |

**Issues Found**: None — admin dashboard is complete.

---

## SECTION 2: ARCHITECTURE & QUALITY REVIEW

### 2.1 Frontend-Backend Integration

| Aspect | Assessment | Details |
|---|---|---|
| **Auth Flow** | ⚠️  Inconsistent | Backend sets HTTP-only cookie; frontend also stores token in localStorage (redundant) |
| **Cookie Handling** | ⚠️  Needs Update | `sameSite: 'lax'` works for same-site, but cross-origin (if applicable) needs `'none'` + `secure: true` |
| **API Wrapper Consistency** | ⚠️  Dual Implementations | Two API files: `lib/api.js` and `services/api.ts` — both add `credentials: include'` |
| **Error Handling** | ✅ Reasonable | Basic try-catch blocks; user-facing error messages shown |
| **Loading States** | ✅ Implemented | Skeleton loaders, spinners, and disabled buttons during async operations |
| **Session Persistence** | ⚠️  Limited | No token refresh on expiry; user gets logged out without graceful handling |

### 2.2 Code Quality Issues

| Issue | Severity | Location | Impact |
|---|---|---|---|
| **Duplicate API Files** | Medium | `lib/api.js` & `services/api.ts` | Confusing; maintenance overhead |
| **501 Not Implemented Endpoints** | Critical | `video.controller.js` updateVideo/deleteVideo | Edit/Delete features don't work |
| **Hardcoded Values** | Low | Various | Magic numbers for timeouts, grid columns, email expiry |
| **No Error Boundaries** | Medium | Frontend pages | One component crash breaks entire page |
| **Unused Imports** | Low | Various | Cleanup needed |
| **Inconsistent Naming** | Low | Models: `owner` vs `uploader` | Confusion in frontend when accessing video creator |
| **No Request Validation** | Low | Frontend forms | Missing client-side validation before API calls |

### 2.3 Missing Integrations

| Feature | Expected | Actual | Gap |
|---|---|---|---|
| **Trending Score Updates** | Auto-increment on engagement | Never incremented; always 0 | Trending feed doesn't work |
| **Email on Engagement** | Send email when liked/commented | Not implemented | Users don't get notifications |
| **Notification Preferences** | Check before sending email | Not checked | Emails sent to everyone (if configured) |
| **Edit Video Pipeline** | UI → API → MongoDB update | UI broken; API not implemented | Cannot edit videos |
| **Delete Video Pipeline** | UI → API → S3 + MongoDB delete | UI broken; API not implemented; Missing S3 cleanup | Cannot delete videos; orphaned S3 files |
| **Video Ownership in Feed** | Show owner profile | Owner populated from `/populate('owner')` | Works for display |
| **Thumbnail Generation** | Extract from video during upload | Not implemented | Default placeholder used |

### 2.4 Production-Readiness Assessment

**Would This Pass Grade Review?** ❌ **No**

**Critical Blockers**:
1. Edit/Delete functionality is completely non-functional
2. Email notification system is incomplete
3. Trending feed doesn't actually trend (score never updates)
4. Middleware doesn't protect routes at Next.js level; relies entirely on backend

**Security Concerns**:
1. No CSRF protection on forms (though cookies have SameSite)
2. No rate limiting on uploads or API requests
3. No input sanitization before DB storage
4. Presigned URLs don't expire quickly enough for sensitive content

**Performance Issues**:
1. Large feed loads entire video list; no pagination server-side optimization
2. No caching of video metadata or user data
3. Email service blocks on send (should be async queue)
4. No CDN setup for video streaming

---

## SECTION 3: PRIORITIZED IMPROVEMENT PLAN

### **CRITICAL ISSUES (Must Fix for Phase Completion)**

#### Issue #1: Video Edit/Delete Not Implemented
**What is Broken**: Edit and delete buttons exist in the UI but:
- Frontend buttons have no `onClick` handlers
- Backend `updateVideo` and `deleteVideo` return 501 Not Implemented

**Why It's Broken**:
- Developers left stubs in the controller
- Frontend didn't wire up callbacks

**Where**:
- Frontend UI: `frontend/app/watch/[id]/page.jsx` (lines ~235-245)
- Backend Controller: `backend/src/controllers/video.controller.js` (lines ~140-150)
- Backend Routes: `backend/src/routes/video.routes.js` (PATCH and DELETE)

**Fix Strategy** (See Section 4 for detailed steps):
1. Implement `updateVideo` controller to handle title/description updates
2. Implement `deleteVideo` controller to remove video from DB and S3
3. Add click handlers to frontend Edit/Delete buttons
4. Create edit modal/form for title/description
5. Add delete confirmation dialog

---

#### Issue #2: Email Notifications Not Sent
**What is Broken**:
- Email service exists but only sends on registration
- No triggers for likes, comments, reviews, follows
- If SMTP credentials missing, emails silently fail; admins don't know

**Why It's Broken**:
- Engagement actions (like, comment, review) don't call email service
- Email service init logs warning if SMTP missing, but it's easy to miss
- No preference checking before send

**Where**:
- `backend/src/services/email.service.js` (initialization and sendEngagementEmail)
- `backend/src/services/like.service.js`, `comment.service.js`, `review.service.js` (no email triggers)
- `backend/src/models/user.model.js` (notificationPreferences exist but unused)

**Fix Strategy** (See Section 4 for detailed steps):
1. Add email triggers in like, comment, review services
2. Check user's `notificationPreferences` before sending
3. Add clear logging if SMTP not configured
4. Queue emails async (don't block API responses)

---

#### Issue #3: Trending Feed Doesn't Work
**What is Broken**:
- Trending feed returns videos sorted by `trendingScore` desc, but score is always 0
- No logic updates `trendingScore`

**Why It's Broken**:
- Phase 1 should have "aggregation pipelines" to calculate engagement score
- Phase 2 assumes this exists; it doesn't

**Where**:
- `backend/src/services/Videoservice.js` `getTrendingFeed()` sorts by trendingScore
- Nowhere in the codebase increments trendingScore

**Fix Strategy** (See Section 4 for detailed steps):
1. Calculate engagement score from likes, comments, reviews count
2. Update `trendingScore` on each engagement event (like, comment, review added)
3. Or: Implement MongoDB aggregation pipeline in getTrendingFeed() to calculate on-the-fly

---

#### Issue #4: Frontend Middleware Not Protecting Routes
**What is Broken**:
- Users can navigate to `/upload`, `/admin`, `/profile` even if not logged in
- Next.js middleware is a no-op
- Route protection only happens at API level (backend rejects on protect middleware)

**Why It's Broken**:
- Middleware chosen to allow API to handle auth (per comment), but this breaks Next.js patterns
- Allows unauthenticated users to see protected page UI briefly before redirect

**Where**:
- `frontend/middleware.ts` (just returns `NextResponse.next()`)

**Fix Strategy** (See Section 4 for detailed steps):
1. Either: Enforce auth in middleware and redirect to login
2. Or: Keep backend-only, add client-side navigation guards in page components

---

### **HIGH-PRIORITY ISSUES (Should Fix for Full Compliance)**

#### Issue #5: Edit/Delete UI Not Wired
**What is Broken**: Edit/Delete buttons render but don't do anything
**Where**: `frontend/app/watch/[id]/page.jsx` lines ~235-245
**Fix**: Add onClick handlers calling API update/delete endpoints

#### Issue #6: No Thumbnail Generation
**What is Broken**: Videos display placeholder thumbnail, not extracted frame
**Where**: `frontend/components/VideoCard.jsx` shows `video.thumbnailKey`; never created
**Fix**: Extract frame at 1-3s during upload; save to MinIO; reference in DB

#### Issue #7: No Navigation Sidebar/Navbar
**What is Broken**: Users cannot easily navigate between pages; no app-wide nav
**Where**: `frontend/app/layout.tsx` has no <Nav /> component
**Fix**: Create navigation component with links to feed, upload, profile, admin

---

### **MEDIUM-PRIORITY ISSUES (Nice to Have)**

#### Issue #8: Engagement Email Preferences Not Respected
**What is Broken**: Email service doesn't check user's notificationPreferences
**Fix**: Query user document and check preferences before sending

#### Issue #9: SMTP Config Silent Failure
**What is Broken**: Missing SMTP env vars silently disable email
**Fix**: Add explicit warning log; suggest fallback behavior

#### Issue #10: Video Edit Form Not Designed
**What is Broken**: No UI for editing video title/description
**Fix**: Create modal with form fields for title, description, visibility

---

## SECTION 4: STEP-BY-STEP FIXING GUIDE

### **DEPENDENCY ORDER**

```
Phase 1 (Critical):
├─ Fix Issue #1 (Edit/Delete Implementation)
├─ Fix Issue #2 (Email Engagement Triggers)
└─ Fix Issue #4 (Frontend Middleware or Route Guards)

Phase 2 (High Priority):
├─ Fix Issue #3 (Trending Score Calculation)
├─ Fix Issue #5 (Edit/Delete UI Wiring)
├─ Fix Issue #7 (Navigation Component)
└─ Fix Issue #6 (Thumbnail Generation)

Phase 3 (Medium Priority):
├─ Fix Issue #8 (Notification Preferences Check)
└─ Fix Issue #9 (SMTP Config Logging)
```

---

### **PHASE 1: CRITICAL FIXES**

#### **STEP 1: Implement Video Update Controller**

**File**: `backend/src/controllers/video.controller.js`

**Current Code** (lines ~140-145):
```javascript
export const updateVideo = async (req, res) => {
  res.status(501).json({
    status: 'error',
    message: 'Update video not implemented',
  });
};
```

**Required Changes**:
1. Extract `title`, `description`, `visibility` from `req.body`
2. Find video by `req.params.id`
3. Check ownership (middleware already did this)
4. Update MongoDB fields
5. Return updated video

**Implementation**:
```javascript
export const updateVideo = async (req, res, next) => {
  try {
    const { title, description, visibility } = req.body;
    const videoId = req.params.id;

    // Ownership check already done by middleware
    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        title: title?.trim() || undefined,
        description: description?.trim() || undefined,
        status: visibility && ['public', 'private'].includes(visibility) 
          ? visibility 
          : undefined,
      },
      { runValidators: true, new: true }
    );

    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      data: video,
    });
  } catch (err) {
    next(err);
  }
};
```

**Testing**:
```bash
# Assuming authenticated user; video owner calls:
curl -X PATCH http://localhost:5000/api/v1/videos/VIDEO_ID \
  -H "Cookie: token=JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title", "description": "New Desc"}'
```

---

#### **STEP 2: Implement Video Delete Controller**

**File**: `backend/src/controllers/video.controller.js`

**Current Code** (lines ~148-153):
```javascript
export const deleteVideo = async (req, res) => {
  res.status(501).json({
    status: 'error',
    message: 'Delete video not implemented',
  });
};
```

**Required Changes**:
1. Find video by ID
2. Delete from MongoDB
3. Delete object from S3 using stored `videoKey`
4. Return success

**Implementation**:
```javascript
export const deleteVideo = async (req, res, next) => {
  try {
    const videoId = req.params.id;

    // Ownership check already done by middleware
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    // Delete from S3
    if (video.videoKey) {
      try {
        await deleteObject(video.videoKey);
      } catch (s3Err) {
        // Log but don't fail; DB record is more important
        console.error('Failed to delete S3 object:', s3Err.message);
      }
    }

    // Delete from MongoDB
    await Video.findByIdAndDelete(videoId);

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
```

**Required Imports** (at top of file):
```javascript
import { deleteObject } from '../services/s3Service.js';
```

**Testing**:
```bash
curl -X DELETE http://localhost:5000/api/v1/videos/VIDEO_ID \
  -H "Cookie: token=JWT_TOKEN"
```

---

#### **STEP 3: Add Frontend Edit/Delete Click Handlers**

**File**: `frontend/app/watch/[id]/page.jsx`

**Current Code** (lines ~235-245):
```javascript
{(isOwner || isAdmin) && (
  <>
    <button style={{ padding: '8px 16px', ... }}>
      ✏️ Edit
    </button>
    <button style={{ padding: '8px 16px', ... }}>
      🗑️ Delete
    </button>
  </>
)}
```

**Required Changes**:
1. Add state for edit modal visibility
2. Add state for delete confirmation
3. Implement `handleEdit()` to open modal
4. Implement `handleDelete()` to confirm and call API
5. Create edit modal form or use inline edit

**Implementation** (add to component state section):
```javascript
const [editMode, setEditMode] = useState(false);
const [editTitle, setEditTitle] = useState(videoMeta?.title || '');
const [editDesc, setEditDesc] = useState(videoMeta?.description || '');
const [editVis, setEditVis] = useState(videoMeta?.status || 'public');
const [editLoading, setEditLoading] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);

const handleEditSave = async () => {
  if (!editTitle.trim()) {
    alert('Title cannot be empty');
    return;
  }
  setEditLoading(true);
  try {
    const res = await api(`/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDesc.trim(),
        visibility: editVis,
      }),
    });
    setVideoMeta(res.data.data);
    setEditMode(false);
  } catch (err) {
    alert(`Edit failed: ${err.message}`);
  } finally {
    setEditLoading(false);
  }
};

const handleDelete = async () => {
  setDeleteLoading(true);
  try {
    await api(`/videos/${id}`, { method: 'DELETE' });
    router.push('/feed');
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
    setDeleteConfirm(false);
  } finally {
    setDeleteLoading(false);
  }
};
```

**Update Button Code**:
```javascript
{(isOwner || isAdmin) && (
  <>
    <button 
      onClick={() => setEditMode(!editMode)}
      disabled={editLoading}
      style={{ padding: '8px 16px', ... }}
    >
      ✏️ Edit
    </button>
    <button 
      onClick={() => setDeleteConfirm(true)}
      disabled={deleteLoading}
      style={{ padding: '8px 16px', ... }}
    >
      🗑️ Delete
    </button>
  </>
)}
```

**Add Edit Form** (before video info section):
```javascript
{editMode && (
  <div style={{ background: '#1a1a1a', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
    <h3 style={{ marginTop: 0, color: '#f9fafb' }}>Edit Video</h3>
    <input
      type="text"
      value={editTitle}
      onChange={(e) => setEditTitle(e.target.value)}
      placeholder="Title"
      style={{ width: '100%', marginBottom: '10px', padding: '8px', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f9fafb' }}
    />
    <textarea
      value={editDesc}
      onChange={(e) => setEditDesc(e.target.value)}
      placeholder="Description"
      style={{ width: '100%', marginBottom: '10px', padding: '8px', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f9fafb' }}
    />
    <select
      value={editVis}
      onChange={(e) => setEditVis(e.target.value)}
      style={{ marginBottom: '10px', padding: '8px', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f9fafb' }}
    >
      <option value="public">Public</option>
      <option value="private">Private</option>
    </select>
    <div style={{ display: 'flex', gap: '10px' }}>
      <button
        onClick={handleEditSave}
        disabled={editLoading}
        style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: editLoading ? 'not-allowed' : 'pointer' }}
      >
        {editLoading ? 'Saving...' : 'Save'}
      </button>
      <button
        onClick={() => setEditMode(false)}
        style={{ padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Add Delete Confirmation Modal** (before video info section):
```javascript
{deleteConfirm && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '2rem', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      <h3 style={{ marginTop: 0, color: '#f9fafb' }}>Delete Video?</h3>
      <p style={{ color: '#9ca3af' }}>This action cannot be undone. Are you sure?</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setDeleteConfirm(false)}
          disabled={deleteLoading}
          style={{ padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteLoading}
          style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}
        >
          {deleteLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
)}
```

**Testing**:
1. Navigate to a video you own
2. Click "Edit" — form should appear
3. Change title/description, click "Save"
4. Click "Delete" — confirmation dialog appears
5. Confirm — video should be deleted, redirect to feed

---

#### **STEP 4: Add Email Triggers for Engagement**

**File**: `backend/src/services/like.service.js`

**Add this import at top**:
```javascript
import { sendEngagementEmail } from './email.service.js';
import User from '../models/user.model.js';
```

**Find the `addLike()` function and add email trigger** (after DB update, before return):
```javascript
// Send engagement email
try {
  const liker = await User.findById(userId).select('username email');
  const video = await Video.findById(videoId).select('owner title').populate('owner', 'email username notificationPreferences');
  
  if (video?.owner && liker) {
    const recipientPrefs = video.owner.notificationPreferences || {};
    if (recipientPrefs.newLike !== false) { // Default true if not set
      await sendEngagementEmail(
        video.owner.email,
        video.owner.username,
        liker.username,
        'liked',
        video.title
      );
    }
  }
} catch (emailErr) {
  console.error('Failed to send like email:', emailErr.message);
  // Don't throw; email is not critical
}
```

**File**: `backend/src/services/comment.service.js`

**Similar addition after creating comment**:
```javascript
// Send engagement email
try {
  const commenter = await User.findById(userId).select('username email');
  const video = await Video.findById(videoId).select('owner title').populate('owner', 'email username notificationPreferences');
  
  if (video?.owner && commenter) {
    const recipientPrefs = video.owner.notificationPreferences || {};
    if (recipientPrefs.newComment !== false) {
      await sendEngagementEmail(
        video.owner.email,
        video.owner.username,
        commenter.username,
        'commented on',
        video.title
      );
    }
  }
} catch (emailErr) {
  console.error('Failed to send comment email:', emailErr.message);
}
```

**File**: `backend/src/services/review.service.js`

**Similar addition after creating review**.

---

#### **STEP 5: Fix Frontend Middleware Auth**

**File**: `frontend/middleware.ts`

**Option A: Enforce Auth in Middleware** (Recommended)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // Protected routes that require authentication
  const protectedRoutes = ['/upload', '/profile', '/admin'];
  
  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    url.pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // Check for token in cookie
    const token = req.cookies.get('token')?.value;
    
    if (!token) {
      // Redirect to login, preserving intended destination
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/upload/:path*', '/admin/:path*'],
};
```

**Testing**:
1. Log out (clear token cookie)
2. Try to navigate to `/upload`
3. Should redirect to `/login`

---

### **PHASE 2: HIGH PRIORITY FIXES**

#### **STEP 6: Fix Trending Score Calculation**

**Option A: Update Score on Each Engagement** (Recommended for real-time)

**File**: `backend/src/services/like.service.js`

**After adding like**, update trending score:
```javascript
// Update trending score
await Video.findByIdAndUpdate(videoId, {
  $inc: { trendingScore: 10 } // Increment by 10 for each like
});
```

**File**: `backend/src/services/comment.service.js`

**After adding comment**:
```javascript
await Video.findByIdAndUpdate(videoId, {
  $inc: { trendingScore: 5 }
});
```

**File**: `backend/src/services/review.service.js`

**After adding review**:
```javascript
await Video.findByIdAndUpdate(videoId, {
  $inc: { trendingScore: 15 } // Higher weight for reviews
});
```

**Option B: Calculate on Query** (Better for consistency)

**File**: `backend/src/services/Videoservice.js`

**Modify `getTrendingFeed()`**:
```javascript
async function getTrendingFeed(limit = 10, skip = 0) {
  const [videos, total] = await Promise.all([
    Video.aggregate([
      { $match: { status: 'public' } },
      {
        $lookup: {
          from: 'likes',
          localField: '_id',
          foreignField: 'video',
          as: 'likesData',
        },
      },
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'video',
          as: 'commentsData',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'video',
          as: 'reviewsData',
        },
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: [{ $size: '$likesData' }, 10] },
              { $multiply: [{ $size: '$commentsData' }, 5] },
              { $multiply: [{ $size: '$reviewsData' }, 15] },
            ],
          },
        },
      },
      { $sort: { engagementScore: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          description: 1,
          owner: { username: 1, avatarUrl: 1 },
          duration: 1,
          status: 1,
          viewsCount: 1,
          createdAt: 1,
        },
      },
    ]),
    Video.countDocuments({ status: 'public' }),
  ]);
  return { videos, total };
}
```

---

#### **STEP 7: Add Global Navigation Component**

**File**: `frontend/app/layout.tsx`

**Current layout likely missing nav; add this after opening body**:

```typescript
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ClipSphere',
  description: 'Short-form video platform',
}

function NavBar() {
  return (
    <nav style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          ClipSphere
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link href="/feed" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.95rem' }}>Feed</Link>
          <Link href="/upload" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.95rem' }}>Upload</Link>
          <Link href="/profile" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.95rem' }}>Profile</Link>
          <Link href="/admin" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.95rem' }}>Admin</Link>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
```

**Alternatively**: Create a separate `Navbar.tsx` component and import it.

---

#### **STEP 8: Generate Thumbnails on Upload**

**File**: `backend/src/services/Videoservice.js`

**After uploading video to MinIO, add thumbnail extraction** (in `uploadVideo()` function):

```javascript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Readable } from 'stream';

ffmpeg.setFfmpegPath(ffmpegPath);

async function uploadVideo({ uploaderId, title, description, tags, visibility, buffer, videoMeta }) {
  const objectKey = `videos/${uuidv4()}.mp4`;
  
  // 1. Upload video
  await uploadBuffer(objectKey, buffer, videoMeta.mimeType);

  // 2. Extract thumbnail at 2 seconds
  let thumbnailKey = null;
  try {
    const thumbnailBuffer = await extractThumbnail(buffer, 2); // 2 second mark
    if (thumbnailBuffer) {
      thumbnailKey = `thumbnails/${uuidv4()}.jpg`;
      await uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/jpeg');
    }
  } catch (thumbErr) {
    console.warn('Failed to extract thumbnail:', thumbErr.message);
    // Proceed without thumbnail
  }

  // 3. Save to MongoDB
  const status = visibility === 'private' ? 'private' : 'public';

  let video;
  try {
    video = await Video.create({
      owner: uploaderId,
      title,
      description: description || '',
      videoKey: objectKey,
      thumbnailKey, // Add this
      duration: videoMeta.duration,
      status,
      viewsCount: 0,
      trendingScore: 0,
    });
  } catch (dbErr) {
    await deleteObject(objectKey).catch(() => {});
    if (thumbnailKey) await deleteObject(thumbnailKey).catch(() => {});
    throw dbErr;
  }

  return video;
}

/**
 * Extract a single frame at specified seconds as JPEG
 */
function extractThumbnail(buffer, seconds) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = Readable.from(buffer);
    
    ffmpeg(stream)
      .screenshots({
        timestamps: [seconds],
        filename: 'thumbnail.jpg',
        folder: '/tmp',
        size: '320x180',
      })
      .on('end', () => {
        // Read the generated file and return as buffer
        // (Simplified; in production use proper temp file handling)
        resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
      })
      .on('error', (err) => reject(err));
  });
}
```

**Update Video Model** to include `thumbnailKey`:

**File**: `backend/src/models/video.model.js`

```javascript
thumbnailKey: {
  type: String,
  default: null,
},
```

**Update Frontend VideoCard** to use thumbnail:

**File**: `frontend/components/VideoCard.jsx`

```javascript
const thumbnailSrc =
  video.thumbnailKey
    ? `${process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL}/thumbnails/${video.thumbnailKey}`
    : '/placeholder-thumbnail.svg';
```

---

### **PHASE 3: MEDIUM PRIORITY FIXES**

#### **STEP 9: Check Notification Preferences Before Email**

**File**: `backend/src/services/email.service.js`

**Modify `sendEngagementEmail()` to accept user preferences**:

```javascript
export const sendEngagementEmail = async (
  recipientEmail,
  recipientUsername,
  actorUsername,
  action,
  videoTitle,
  notifyType = 'newEngagement' // 'newLike', 'newComment', 'newReview'
) => {
  if (!transporter) return;

  // Fetch user and check preferences
  try {
    const User = (await import('../models/user.model.js')).default;
    const user = await User.findOne({ email: recipientEmail }).select('notificationPreferences');
    
    if (!user) return; // User not found
    
    const prefs = user.notificationPreferences || {};
    
    // Map action to preference key
    const prefKey = notifyType === 'newLike' ? 'newLike' 
                  : notifyType === 'newComment' ? 'newComment'
                  : 'newEngagement';
    
    if (prefs[prefKey] === false) {
      // User disabled this notification type
      return;
    }
  } catch (err) {
    console.error('Failed to check notification preferences:', err.message);
    // Continue; default is to send
  }

  // ... rest of email sending logic
};
```

**Update all call sites** to include notifyType parameter.

---

#### **STEP 10: Add SMTP Config Warning**

**File**: `backend/src/services/email.service.js`

**At the top, after transporter initialization**:

```javascript
if (!env.SMTP_USER || !env.SMTP_PASS) {
  console.warn('⚠️  Email service disabled: Missing SMTP_USER or SMTP_PASS env vars');
  console.warn('   Email notifications will not be sent.');
  console.warn('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable email.');
}
```

---

## SECTION 5: TESTING CHECKLIST

After implementing fixes, verify each feature:

### **Phase 1 (Critical)**

- [ ] **Edit Video**
  - [ ] Logged-in user can click Edit button
  - [ ] Form appears with current title/description
  - [ ] Changes are saved to DB
  - [ ] Video card shows updated title in feed
  - [ ] Non-owner cannot edit

- [ ] **Delete Video**
  - [ ] Logged-in owner can click Delete
  - [ ] Confirmation dialog appears
  - [ ] Clicking Confirm removes video from feed
  - [ ] S3 object is deleted (check MinIO console)
  - [ ] Non-owner cannot delete

- [ ] **Email Engagement**
  - [ ] Configure SMTP env vars
  - [ ] Like a video → owner receives email
  - [ ] Comment on video → owner receives email
  - [ ] Review/rate video → owner receives email
  - [ ] Disabled preferences prevent email

- [ ] **Frontend Auth Routes**
  - [ ] Logged-out user navigates to `/upload` → redirected to `/login`
  - [ ] Logged-out user navigates to `/admin` → redirected to `/login`
  - [ ] Logged-in user can access `/upload`
  - [ ] Non-admin cannot access `/admin`

### **Phase 2 (High Priority)**

- [ ] **Trending Feed**
  - [ ] Trending tab shows videos (not empty)
  - [ ] Videos with more likes appear higher
  - [ ] Trending score updates when liking/commenting

- [ ] **Navigation**
  - [ ] Navbar visible on all pages
  - [ ] Links work and navigate correctly
  - [ ] Navbar is responsive on mobile

- [ ] **Thumbnails**
  - [ ] Video upload generates thumbnail
  - [ ] Thumbnail appears in feed cards
  - [ ] Placeholder shown if extraction fails

### **Phase 3 (Medium Priority)**

- [ ] **Notification Preferences**
  - [ ] User can disable notification types
  - [ ] Disabled types don't send emails

- [ ] **SMTP Logging**
  - [ ] Warning logged if SMTP not configured
  - [ ] Message suggests required env vars

---

## SECTION 6: SUMMARY TABLE

| Feature | Required | Implemented | Status | Effort |
|---|---|---|---|---|
| **Next.js Scaffolding** | ✅ | ✅ | Complete | — |
| **Tailwind + Responsive Grid** | ✅ | ✅ | Complete | — |
| **Frontend Auth Middleware** | ✅ | ⚠️  | Needs Fix | 30 min |
| **useAuth Hook** | ✅ | ✅ | Complete | — |
| **MinIO + Presigned URLs** | ✅ | ✅ | Complete | — |
| **Video Duration Validation** | ✅ | ✅ | Complete | — |
| **File Type/Size Filtering** | ✅ | ✅ | Complete | — |
| **Responsive Feed Grid** | ✅ | ✅ | Complete | — |
| **Paginated APIs** | ✅ | ✅ | Complete | — |
| **Infinite Scroll** | ✅ | ✅ | Complete | — |
| **Public Feed** | ✅ | ✅ | Complete | — |
| **Following Feed** | ✅ | ✅ | Complete | — |
| **Trending Feed** | ✅ | ⚠️  | Needs Fix | 1-2 hours |
| **Trending Score Calculation** | ✅ | ❌ | Missing | 1 hour |
| **Video Player** | ✅ | ✅ | Complete | — |
| **Custom Controls** | ✅ | ✅ | Complete | — |
| **Star Rating System** | ✅ | ✅ | Complete | — |
| **Comments** | ✅ | ✅ | Complete | — |
| **Like/Unlike** | ✅ | ✅ | Complete | — |
| **Optimistic UI Updates** | ✅ | ✅ | Complete | — |
| **Dynamic Ownership UI (Edit/Delete Buttons)** | ✅ | ⚠️  | Partially Impl | 2 hours |
| **Video Edit Controller** | ✅ | ❌ | Missing | 30 min |
| **Video Delete Controller** | ✅ | ❌ | Missing | 30 min |
| **Email Welcome** | ✅ | ✅ | Complete | — |
| **Email on Engagement** | ✅ | ❌ | Missing | 1.5 hours |
| **Notification Preferences** | ✅ | ⚠️  | Not Enforced | 30 min |
| **Admin Dashboard** | ✅ | ✅ | Complete | — |
| **Admin Route Protection** | ✅ | ✅ | Complete | — |
| **Global Navigation** | ✅ | ❌ | Missing | 1 hour |
| **Thumbnail Generation** | ✅ | ❌ | Missing | 2 hours |

---

## CONCLUSION

**Current Implementation Status**: 70% complete

**Must-Fix to Reach 95%**: 
- Implement video edit/delete (2 hours)
- Add email engagement triggers (1.5 hours)
- Fix frontend auth middleware (30 min)
- Calculate trending scores (1-2 hours)
- **Total: ~5-7 hours**

**Nice-to-Have for Polish** (another 4-5 hours):
- Thumbnail generation
- Global navigation
- Notification preference enforcement
- SMTP logging

**Estimated Total Time to Full Phase Completion**: 9-12 hours

---

