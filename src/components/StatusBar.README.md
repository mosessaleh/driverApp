# 🎨 StatusBar Component - TrafikTaxa Driver App

## نظرة عامة

مكون شريط الحالة الجديد هو تصميم عصري ومتكامل لعرض حالة السائق في تطبيق TrafikTaxa. يتميز بتصميم بصري جذاب، رسوم متحركة سلسة، ودعم كامل للوضع المظلم والفاتح.

---

## ✨ المميزات الرئيسية

### 1. 🎭 حالات متعددة مع ألوان مميزة

| الحالة | اللون | الأيقونة | الوصف |
|--------|-------|----------|-------|
| `offline` | 🔴 أحمر | power-off | السائق غير متصل |
| `online` | 🟢 أخضر | radio-outline | السائق متصل ومتاح |
| `busy` | 🟡 أصفر | pause-circle | السائق متصل لكن مشغول |
| `banned` | ⛔ أحمر غامق | ban | السائق محظور مؤقتاً |
| `on_ride` | 🔵 أزرق | car | السائق في رحلة حالياً |

### 2. 🎬 رسوم متحركة

- **نبضة الحالة**: عندما يكون السائق `online` أو `on_ride`، تظهر نبضة متحركة حول الأيقونة
- **نبضة الاتصال**: مؤشر الاتصال يظهر نبضة خضراء عند الاتصال
- **انزلاق الدخول**: الشريط ينزلق من الأعلى عند التحميل
- **تغيير سلس**: انتقال سلس بين الحالات المختلفة

### 3. 📊 معلومات إضافية

- ⏱️ **وقت الوردية**: عرض الوقت المنقضي بتنسيق `4h 30m`
- 📈 **شريط التقدم**: يظهر التقدم نحو 11 ساعة (تحذير عند 80%)
- 🔔 **عداد الرسائل**: يظهر عدد الرسائل غير المقروءة
- 🌐 **مؤشر الاتصال**: يظهر حالة الاتصال بالسيرفر

### 4. 🎨 دعم الوضع المظلم

يتكيف التصميم تلقائياً مع الوضع المظلم/الفاتح للتطبيق.

---

## 📁 الملفات

```
src/components/
├── StatusBar.tsx           # المكون الرئيسي
├── StatusBarExpanded.tsx   # العرض الموسع (Modal)
├── StatusBarExample.tsx    # مثال على الاستخدام
└── StatusBar.README.md     # هذا الملف
```

---

## 🚀 كيفية الاستخدام

### 1. الاستخدام الأساسي

```tsx
import { StatusBar, DriverStatus } from '../src/components/StatusBar';
import { StatusBarExpanded } from '../src/components/StatusBarExpanded';

function Dashboard() {
  const [showExpanded, setShowExpanded] = useState(false);
  
  // تحديد حالة السائق
  const getDriverStatus = (): DriverStatus => {
    if (bannedUntil) return 'banned';
    if (activeRide) return 'on_ride';
    if (!driverOnline) return 'offline';
    if (driverBusy) return 'busy';
    return 'online';
  };

  return (
    <View>
      {/* شريط الحالة الرئيسي */}
      <StatusBar
        status={getDriverStatus()}
        shiftElapsedTime={shiftElapsedTime}
        isSocketConnected={isSocketConnected}
        banCountdown={banCountdown}
        unreadMessages={unreadMessagesCount}
        onPress={() => setShowExpanded(true)}
      />
      
      {/* العرض الموسع (Modal) */}
      <StatusBarExpanded
        visible={showExpanded}
        onClose={() => setShowExpanded(false)}
        status={getDriverStatus()}
        shiftElapsedTime={shiftElapsedTime}
        shiftStartTime={shiftStartTime}
        isSocketConnected={isSocketConnected}
        currentLocation={currentLocation}
        locationPermission={locationPermission}
        isTracking={isTracking}
        totalRidesToday={10}
        earningsToday={450}
        rating={4.8}
      />
    </View>
  );
}
```

### 2. الخصائص (Props)

#### StatusBar

| الخاصية | النوع | الافتراضي | الوصف |
|---------|-------|-----------|-------|
| `status` | `DriverStatus` | مطلوب | حالة السائق الحالية |
| `shiftElapsedTime` | `string` | مطلوب | وقت الوردية (HH:MM:SS) |
| `isSocketConnected` | `boolean` | مطلوب | حالة الاتصال بالسيرفر |
| `banCountdown` | `number` | `0` | الوقت المتبقي للحظر (ثواني) |
| `unreadMessages` | `number` | `0` | عدد الرسائل غير المقروءة |
| `onPress` | `() => void` | `undefined` | عند الضغط على الشريط |
| `expanded` | `boolean` | `false` | هل الشريط موسع؟ |

#### StatusBarExpanded

| الخاصية | النوع | الافتراضي | الوصف |
|---------|-------|-----------|-------|
| `visible` | `boolean` | مطلوب | إظهار/إخفاء الـ Modal |
| `onClose` | `() => void` | مطلوب | دالة الإغلاق |
| `status` | `DriverStatus` | مطلوب | حالة السائق |
| `shiftElapsedTime` | `string` | مطلوب | وقت الوردية |
| `shiftStartTime` | `string \| null` | `null` | وقت بدء الوردية |
| `isSocketConnected` | `boolean` | مطلوب | حالة الاتصال |
| `currentLocation` | `{lat, lng} \| null` | `null` | الموقع الحالي |
| `locationPermission` | `boolean` | `false` | إذن الموقع |
| `isTracking` | `boolean` | `false` | تتبع الموقع نشط؟ |
| `totalRidesToday` | `number` | `0` | عدد الرحلات اليوم |
| `earningsToday` | `number` | `0` | الأرباح اليوم |
| `rating` | `number` | `4.8` | التقييم |

---

## 🎨 نظام الألوان

### ألوان الحالات

```typescript
const statusConfig = {
  offline: {
    color: '#dc3545',      // أحمر
    gradient: ['#dc3545', '#c82333'],
  },
  online: {
    color: '#28a745',      // أخضر
    gradient: ['#28a745', '#23913d'],
  },
  busy: {
    color: '#ffc107',      // أصفر
    gradient: ['#ffc107', '#e6ad06'],
  },
  banned: {
    color: '#bd2130',      // أحمر غامق
    gradient: ['#bd2130', '#a71d2a'],
  },
  on_ride: {
    color: '#17a2b8',      // أزرق
    gradient: ['#17a2b8', '#148a9c'],
  },
};
```

---

## 📱 لقطات الشاشة (Descriptions)

### الشريط العادي
```
┌─────────────────────────────────────────────────────────┐
│ [🔴]  Offline        00:00          ● Connected        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [🟢~] Online-Available  4h 30m      ● Connected    [💬3]│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [🟡]  Busy            6h 15m        ● Connected        │
└─────────────────────────────────────────────────────────┘
```

### العرض الموسع
```
┌────────────────────────────────────────┐
│ [🟢]    Online - Available        [✕]  │
│         Searching for rides...         │
├────────────────────────────────────────┤
│ ⏱️ Shift Timer                         │
│    [ 4 ] : [ 30 ] : [ 15 ]             │
│    hours   minutes   seconds           │
│                                        │
│    Progress: ████████░░ 73%            │
│    Remaining: 3h 45m                   │
├────────────────────────────────────────┤
│ 🚗 12    💰 450 DKK    ⭐ 4.8          │
├────────────────────────────────────────┤
│ 📶 Connection Status                   │
│    ● Connected to server               │
│    ● Location permission granted       │
│    ● Location tracking active          │
└────────────────────────────────────────┘
```

---

## 🔧 التخصيص

### تغيير الألوان

يمكن تعديل الألوان من ملف `src/theme/index.ts`:

```typescript
export const colors = {
  success: {
    500: '#28a745',  // تغيير لون Online
  },
  danger: {
    500: '#dc3545',  // تغيير لون Offline
  },
  warning: {
    500: '#ffc107',  // تغيير لون Busy
  },
  info: {
    500: '#17a2b8',  // تغيير لون On Ride
  },
};
```

### إضافة حالة جديدة

1. أضف الحالة إلى نوع `DriverStatus`:
```typescript
export type DriverStatus = 'offline' | 'online' | 'busy' | 'banned' | 'on_ride' | 'new_status';
```

2. أضف الإعدادات في `statusConfig`:
```typescript
const statusConfig = {
  new_status: {
    icon: 'new-icon',
    iconFamily: 'Ionicons',
    color: '#purple',
    gradient: ['#purple', '#dark-purple'],
    labelKey: 'status_new',
    pulse: true,
  },
};
```

---

## 🌐 الترجمة

أضف هذه المفاتيح إلى ملفات الترجمة:

```json
{
  "status_offline": "Offline",
  "status_online_available": "Online - Available",
  "status_busy": "Busy",
  "status_banned": "Banned",
  "status_on_ride": "On Ride",
  "status_offline_desc": "You are currently offline",
  "status_online_desc": "Searching for rides...",
  "status_busy_desc": "You are on a break",
  "status_banned_desc": "Account temporarily suspended",
  "status_on_ride_desc": "Currently on a ride",
  "connected": "Connected",
  "disconnected": "Disconnected",
  "shift_timer": "Shift Timer",
  "hours": "Hours",
  "minutes": "Minutes",
  "seconds": "Seconds",
  "shift_progress": "Shift Progress",
  "remaining": "Remaining",
  "started_at": "Started at",
  "rides_today": "Rides",
  "earnings_today": "Earnings",
  "rating": "Rating",
  "connection_status": "Connection Status",
  "connected_to_server": "Connected to server",
  "disconnected_from_server": "Disconnected from server",
  "location_permission_granted": "Location permission granted",
  "location_permission_denied": "Location permission denied",
  "location_tracking_active": "Location tracking active",
  "location_tracking_inactive": "Location tracking inactive",
  "current_location": "Current Location",
  "latitude": "Latitude",
  "longitude": "Longitude",
  "shift_warning_message": "Approaching 11-hour limit!"
}
```

---

## ⚡ الأداء

- يستخدم `useNativeDriver` للرسوم المتحركة لأداء أفضل
- لا يؤثر على أداء الخريطة أو المكونات الأخرى
- يستخدم `React.memo` بشكل ضمني للتقليل من إعادة الرسم

---

## 🐛 استكشاف الأخطاء

### المشكلة: الأيقونات لا تظهر
**الحل**: تأكد من تثبيت `@expo/vector-icons`:
```bash
npm install @expo/vector-icons
```

### المشكلة: الألوان لا تتغير
**الحل**: تأكد من تمرير `status` بشكل صحيح واستخدام إحدى القيم المحددة.

### المشكلة: الـ Modal لا يظهر
**الحل**: تأكد من أن `StatusBarExpanded` يُعرض خارج `ScrollView` الرئيسي.

---

## 📞 دعم

للأسئلة أو المشاكل، يرجى التواصل مع فريق التطوير.

---

**تم التطوير بواسطة:** TrafikTaxa Dev Team  
**الإصدار:** 1.0.0  
**آخر تحديث:** يناير 2026
