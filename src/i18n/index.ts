import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Common
      "back": "Back",
      "loading": "Loading...",
      "error": "Error",
      "retry": "Retry",
      "save": "Save",
      "cancel": "Cancel",
      "ok": "OK",
      "yes": "Yes",
      "no": "No",

      // Dashboard
      "dashboard": "Dashboard",
      "online": "Online",
      "offline": "Offline",
      "busy": "Busy",
      "available": "Available",
      "searching_trips": "Searching for trips",
      "pickup": "Pickup",
      "dropoff": "Dropoff",
      "ride_id": "Ride #{{id}}",
      "price": "Price",
      "distance": "Distance",
      "from": "From",
      "to": "To",
      "hold_to_pickup": "Hold to Pick Up",
      "hold_to_dropoff": "Hold to Drop Off",
      "nav": "NAV",
      "chat": "Chat",
      "end_shift": "End Shift",
      "shift_time": "Shift Time",
      "connection": "Connection",

      // Menu
      "profile": "Profile",
      "history": "History",
      "settings": "Settings",
      "analytics": "Analytics",
      "pause": "Pause",
      "end_pause": "End Pause",

      // Analytics
      "total_rides": "Total Rides",
      "earnings": "Earnings",
      "rating": "Rating",
      "daily_earnings": "Daily Earnings",
      "rides_by_hour": "Rides by Hour",
      "insights": "Insights",
      "peak_hours": "Peak Hours",
      "top_areas": "Top Areas",
      "busiest_day": "Busiest Day",

      // Profile
      "personal_info": "Personal Information",
      "company_info": "Company Information",
      "vehicle_info": "Vehicle Information",
      "actions": "Actions",
      "change_password": "Change Password",
      "full_name": "Full Name",
      "username": "Username",
      "phone": "Phone",
      "email": "Email",
      "company_name": "Company Name",
      "company_phone": "Company Phone",
      "company_email": "Company Email",
      "license_plate": "License Plate",
      "vehicle_type": "Vehicle Type",
      "capacity": "Capacity",

      // Settings
      "notification_settings": "Notification Settings",
      "sound_settings": "Sound Settings",
      "appearance_settings": "Appearance Settings",
      "general_settings": "General Settings",
      "new_ride_notifications": "New Ride Notifications",
      "message_notifications": "Message Notifications",
      "ride_update_notifications": "Ride Update Notifications",
      "vibration": "Vibration",
      "message_sound": "Message Sound",
      "pickup_dropoff_sound": "Pickup & Dropoff Sound",
      "dark_mode": "Dark Mode",
      "language": "Language",
      "clear_cache": "Clear Cache",
      "report_issue": "Report Issue",
      "contact_support": "Contact Support",
      "app_version": "App Version",

      // Status messages
      "banned": "Banned",
      "seconds": "s",
      "vehicle_required": "Location permission required",
      "getting_location": "Getting location...",
    }
  },
  ar: {
    translation: {
      // Common
      "back": "رجوع",
      "loading": "جارٍ التحميل...",
      "error": "خطأ",
      "retry": "إعادة المحاولة",
      "save": "حفظ",
      "cancel": "إلغاء",
      "ok": "موافق",
      "yes": "نعم",
      "no": "لا",

      // Dashboard
      "dashboard": "لوحة التحكم",
      "online": "متصل",
      "offline": "غير متصل",
      "busy": "مشغول",
      "available": "متاح",
      "searching_trips": "البحث عن رحلات",
      "pickup": "الاستلام",
      "dropoff": "التسليم",
      "ride_id": "الرحلة #{{id}}",
      "price": "السعر",
      "distance": "المسافة",
      "from": "من",
      "to": "إلى",
      "hold_to_pickup": "اضغط مطولاً للاستلام",
      "hold_to_dropoff": "اضغط مطولاً للتسليم",
      "nav": "خريطة",
      "chat": "دردشة",
      "end_shift": "إنهاء الوردية",
      "shift_time": "وقت الوردية",
      "connection": "الاتصال",

      // Menu
      "profile": "الملف الشخصي",
      "history": "التاريخ",
      "settings": "الإعدادات",
      "analytics": "التحليلات",
      "pause": "إيقاف مؤقت",
      "end_pause": "إنهاء الإيقاف",

      // Analytics
      "total_rides": "إجمالي الرحلات",
      "earnings": "الإيرادات",
      "rating": "التقييم",
      "daily_earnings": "الإيرادات اليومية",
      "rides_by_hour": "الرحلات بالساعة",
      "insights": "الرؤى",
      "peak_hours": "أوقات الذروة",
      "top_areas": "أفضل المناطق",
      "busiest_day": "أكثر الأيام ازدحاماً",

      // Profile
      "personal_info": "المعلومات الشخصية",
      "company_info": "معلومات الشركة",
      "vehicle_info": "معلومات السيارة",
      "actions": "الإجراءات",
      "change_password": "تغيير كلمة المرور",
      "full_name": "الاسم الكامل",
      "username": "اسم المستخدم",
      "phone": "الهاتف",
      "email": "البريد الإلكتروني",
      "company_name": "اسم الشركة",
      "company_phone": "هاتف الشركة",
      "company_email": "بريد الشركة",
      "license_plate": "رقم اللوحة",
      "vehicle_type": "نوع السيارة",
      "capacity": "السعة",

      // Settings
      "notification_settings": "إعدادات الإشعارات",
      "sound_settings": "إعدادات الصوت",
      "appearance_settings": "إعدادات المظهر",
      "general_settings": "الإعدادات العامة",
      "new_ride_notifications": "إشعارات الرحلات الجديدة",
      "message_notifications": "إشعارات الرسائل",
      "ride_update_notifications": "إشعارات تحديثات الرحلات",
      "vibration": "الاهتزاز",
      "message_sound": "صوت الرسائل",
      "pickup_dropoff_sound": "صوت الاستلام والتسليم",
      "dark_mode": "الوضع المظلم",
      "language": "اللغة",
      "clear_cache": "مسح الذاكرة المؤقتة",
      "report_issue": "الإبلاغ عن مشكلة",
      "contact_support": "اتصال بالدعم",
      "app_version": "إصدار التطبيق",

      // Status messages
      "banned": "محظور",
      "seconds": "ث",
      "vehicle_required": "مطلوب إذن الموقع",
      "getting_location": "جارٍ الحصول على الموقع...",
    }
  },
  da: {
    translation: {
      // Common
      "back": "Tilbage",
      "loading": "Indlæser...",
      "error": "Fejl",
      "retry": "Prøv igen",
      "save": "Gem",
      "cancel": "Annuller",
      "ok": "OK",
      "yes": "Ja",
      "no": "Nej",

      // Dashboard
      "dashboard": "Dashboard",
      "online": "Online",
      "offline": "Offline",
      "busy": "Optaget",
      "available": "Tilgængelig",
      "searching_trips": "Søger efter ture",
      "pickup": "Afhentning",
      "dropoff": "Afsætning",
      "ride_id": "Tur #{{id}}",
      "price": "Pris",
      "distance": "Afstand",
      "from": "Fra",
      "to": "Til",
      "hold_to_pickup": "Hold for at afhente",
      "hold_to_dropoff": "Hold for at afsætte",
      "nav": "NAV",
      "chat": "Chat",
      "end_shift": "Afslut vagt",
      "shift_time": "Vagt tid",
      "connection": "Forbindelse",

      // Menu
      "profile": "Profil",
      "history": "Historik",
      "settings": "Indstillinger",
      "analytics": "Analyse",
      "pause": "Pause",
      "end_pause": "Afslut pause",

      // Analytics
      "total_rides": "Samlede ture",
      "earnings": "Indtjening",
      "rating": "Bedømmelse",
      "daily_earnings": "Daglig indtjening",
      "rides_by_hour": "Ture pr. time",
      "insights": "Indsigter",
      "peak_hours": "Spidstimer",
      "top_areas": "Topområder",
      "busiest_day": "Travlest dag",

      // Profile
      "personal_info": "Personlige oplysninger",
      "company_info": "Firma oplysninger",
      "vehicle_info": "Køretøjsoplysninger",
      "actions": "Handlinger",
      "change_password": "Skift adgangskode",
      "full_name": "Fulde navn",
      "username": "Brugernavn",
      "phone": "Telefon",
      "email": "Email",
      "company_name": "Firmanavn",
      "company_phone": "Firma telefon",
      "company_email": "Firma email",
      "license_plate": "Nummerplade",
      "vehicle_type": "Køretøjstype",
      "capacity": "Kapacitet",

      // Settings
      "notification_settings": "Notifikationsindstillinger",
      "sound_settings": "Lydindstillinger",
      "appearance_settings": "Udseende indstillinger",
      "general_settings": "Generelle indstillinger",
      "new_ride_notifications": "Nye tur notifikationer",
      "message_notifications": "Besked notifikationer",
      "ride_update_notifications": "Tur opdatering notifikationer",
      "vibration": "Vibration",
      "message_sound": "Besked lyd",
      "pickup_dropoff_sound": "Afhentning/afsætning lyd",
      "dark_mode": "Mørk tilstand",
      "language": "Sprog",
      "clear_cache": "Ryd cache",
      "report_issue": "Rapporter problem",
      "contact_support": "Kontakt support",
      "app_version": "App version",

      // Status messages
      "banned": "Udelukket",
      "seconds": "s",
      "vehicle_required": "Lokation tilladelse påkrævet",
      "getting_location": "Henter lokation...",
    }
  }
};

// Initialize i18n
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;