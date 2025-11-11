# Prayer Journal - Figma Design Structure

Complete list of all frames and components organized by screen type with node IDs and hierarchy.

## 📱 Screen Organization

### 1. Splash Screen
- **Frame**: `Splash` (Node ID: `2:778`)
  - Container: `2:780`
    - SplashScreen: `2:781`
      - Logo Container: `2:782`
        - Logo: `2:783`
      - Title Container: `2:809`
        - SplashScreen Title: `2:810`
          - Text: `2:811` ("Prayer Journal")
        - Paragraph: `2:812`
          - Text: `2:813` ("Speak. Reflect. Grow.")

---

### 2. Onboarding Flow

#### Onboarding Screen 1
- **Frame**: `Onboarding/1` (Node ID: `1:2`)
  - Onboarding: `1:3`
    - Container: `1:5`
      - Icon Container: `1:6`
        - Icon: `1:7`
      - Heading 1: `1:11`
        - Text: `1:12` ("Speak Your Prayers")
      - Paragraph: `1:13`
        - Text: `1:14` (Description)
    - Footer Container: `1:15`
      - Pagination: `1:16`
        - Dots: `1:17`, `1:18`, `1:19`
      - Continue Button: `1:20`
      - Skip Button: `1:24`

#### Onboarding Screen 2
- **Frame**: `Onboarding/2` (Node ID: `1:27`)
  - Onboarding: `1:28`
    - Container: `1:30`
      - Icon Container: `1:31`
        - Icon: `1:32`
      - Heading 1: `1:36`
        - Text: `1:37` ("See How You Grow")
      - Paragraph: `1:38`
        - Text: `1:39` (Description)
    - Footer Container: `1:40`
      - Pagination: `1:41`
        - Dots: `1:42`, `1:43`, `1:44`
      - Continue Button: `1:45`
      - Skip Button: `1:49`

#### Onboarding Screen 3
- **Frame**: `Onboarding/3` (Node ID: `1:52`)
  - Onboarding: `1:53`
    - Container: `1:55`
      - Icon Container: `1:56`
        - Icon: `1:57`
      - Heading 1: `1:60`
        - Text: `1:61` ("Keep Them Safe")
      - Paragraph: `1:62`
        - Text: `1:63` (Description)
    - Footer Container: `1:64`
      - Pagination: `1:65`
        - Dots: `1:66`, `1:67`, `1:68`
      - Begin Journey Button: `1:69`

#### Onboarding Reminder
- **Frame**: `Onboarding/Reminder` (Node ID: `27:1216`)
  - OnboardingReminder: `27:1217`
    - Container: `27:1219`
      - Clock Icon Container: `27:1233`
        - Icon: `27:1254`
      - Heading 1: `27:1220`
        - Text: `27:1221` ("When would you like to pray each day?")
      - Paragraph: `27:1222`
        - Text: `27:1223` (Description)
      - Time Picker Container: `27:1224`
        - Time Picker: `27:1225`
        - Hint Text: `27:1231`
    - Footer Container: `27:1257`
      - Set Reminder Button: `27:1258`
      - Skip Button: `27:1260`

#### Onboarding Reminder 2 (Confirmation)
- **Frame**: `Onboarding/Reminder2` (Node ID: `77:3293`)
  - OnboardingReminder: `77:3294`
    - Container: `77:3296`
      - Clock Icon Container: `77:3310`
        - Icon: `77:3331`
      - Heading 1: `77:3297`
        - Text: `77:3298` ("When would you like to pray each day?")
      - Paragraph: `77:3299`
        - Text: `77:3300` (Description)
      - Time Picker Container: `77:3301`
        - Time Picker: `77:3302`
        - Hint Text: `77:3308`
    - Footer Container: `77:3334`
      - Set Reminder Button: `77:3335`
      - Skip Button: `77:3337`
    - ReminderConfirmationModal: `77:3340`
      - Success Icon: `77:3343`
      - Heading 2: `77:3352`
        - Text: `77:3353` ("Reminder Set for 7:00 AM")
      - Paragraph: `77:3354`
        - Text: `77:3355` (Description)
      - Got it Button: `77:3357`
      - Change time Button: `77:3359`

---

### 3. Authentication Screens

#### Login Screen
- **Frame**: `Login` (Node ID: `77:3363`)
  - Login: `77:3364`
    - Header Container: `77:3366`
      - Logo Container: `83:3531`
        - Logo: `83:3532`
      - Heading 2: `77:3393`
        - Text: `77:3394` ("Prayer Journal")
    - Form Container: `77:3395`
      - Welcome Text: `77:3396`
        - Text: `77:3397` ("Welcome back")
      - Form: `77:3398`
        - Email Input: `77:3399`
          - Label: `77:3400`
          - Input: `77:3402`
        - Password Input: `77:3404`
          - Label: `77:3405`
          - Input Container: `77:3407`
            - Input: `77:3408`
            - Show/Hide Button: `77:3410`
        - Forgot Password: `77:3414`
        - Sign In Button: `77:3416`
      - Divider: `77:3418`
      - Google Sign In Button: `77:3423`
      - Sign Up Link: `77:3430`

#### Sign Up Screen
- **Frame**: `Sign up` (Node ID: `77:3435`)
  - SignUp: `77:3436`
    - Header Container: `77:3438`
      - Logo Container: `83:3536`
        - Logo: `83:3537`
      - Heading 2: `77:3465`
        - Text: `77:3466` ("Prayer Journal")
    - Form Container: `77:3467`
      - Title: `77:3468`
        - Text: `77:3469` ("Create your account")
      - Form: `77:3470`
        - Name Input: `77:3471`
          - Label: `77:3472`
          - Input: `77:3474`
        - Email Input: `77:3476`
          - Label: `77:3477`
          - Input: `77:3479`
        - Password Input: `77:3481`
          - Label: `77:3482`
          - Input Container: `77:3484`
            - Input: `77:3485`
            - Show/Hide Button: `77:3487`
        - Terms Checkbox: `77:3491`
          - Checkbox: `77:3492`
          - Label: `77:3496`
            - Terms Link: `77:3498`
            - Privacy Policy Link: `77:3501`
        - Create Account Button: `77:3504`
      - Notification Text: `77:3506`
      - Divider: `77:3508`
      - Google Sign In Button: `77:3513`
      - Sign In Link: `77:3520`

---

### 4. Paywall Screen

#### Paywall Light
- **Frame**: `Paywall/Light` (Node ID: `1:74`)
  - Header Container: `1:75`
    - Paywall Title: `1:76`
      - Text: `1:77` ("Your Prayers,")
      - Text: `1:78` ("Preserved in Peace")
    - Paywall Subtitle: `1:79`
      - Text: `1:80` (Description)
  - Plans Container: `1:81`
    - Core Plan Card: `1:82`
      - Plan Header: `1:83`
        - Heading 3: `1:84`
          - Text: `1:85` ("Core Plan")
        - Price Container: `1:86`
          - Price: `1:87`
          - Unit: `1:89`
      - Features List: `1:91`
        - List Items: `1:92`, `1:97`, `1:102`, `1:107`
      - Select Button: `1:112`
    - Core + Forever Card: `1:114`
      - Plan Header: `1:115`
        - Heading 3: `1:116`
          - Text: `1:118` ("Core + Forever")
        - Badge: `1:119`
        - Price Container: `1:121`
          - Price: `1:122`
          - Unit: `1:124`
      - Features List: `1:126`
        - List Items: `1:127`, `1:132`, `1:137`, `1:142`
      - Upgrade Button: `1:147`
      - Badge: `1:149` ("Most Sacred")
  - Footer Text: `1:151`

---

### 5. Pray Screens

#### Pray Light
- **Frame**: `Pray/Light` (Node ID: `1:234`)
  - PrayTab: `1:235`
    - Container: `1:236`
      - Header Container: `1:237`
        - Heading 2: `1:238`
          - Text: `1:239` ("Good evening, Friend")
        - Paragraph: `1:240`
          - Text: `1:241` (Date)
      - Mic Button Container: `1:242`
        - MicButton: `1:243`
          - Icon: `1:244`
        - Paragraph: `1:248`
          - Text: `1:249` ("Tap to begin your prayer...")
      - Set Reminder Button: `1:250`
    - Tab Bar: `1:256`
      - Pray Tab: `1:257`
      - Journal Tab: `1:263`
    - App Header: `1:269`
      - Logo Container: `83:3546`
        - Logo: `83:3547`
      - Heading 3: `1:297`
        - Text: `1:298` ("Prayer Journal")
      - Settings Button: `1:299`

#### Pray Dark
- **Frame**: `Pray/ Dark` (Node ID: `57:3149`)
  - Similar structure to Pray Light with dark theme
  - PrayTab: `57:3150`
    - Container: `57:3151`
    - Tab Bar: `57:3171`
    - App Header: `57:3184`

#### Pray Recording Light
- **Frame**: `Pray/Recording Light` (Node ID: `1:304`)
  - PrayTab: `1:305`
    - Container: `1:306`
      - Header: `1:307`
        - Heading 2: `1:308`
        - Paragraph: `1:310`
      - Recording MicButton: `1:312`
        - Timer Container: `1:313`
          - Recording Indicator: `1:314`
          - Timer Text: `1:315`
        - Mic Icon: `1:320`
        - Stop Button: `1:323`
    - Tab Bar: `1:326`
    - App Header: `1:339`

#### Pray Recording Dark
- **Frame**: `Pray/Recording Dark` (Node ID: `57:3080`)
  - Similar structure to Recording Light with dark theme
  - PrayTab: `57:3081`
    - Container: `57:3082`
      - Recording MicButton: `57:3088`

#### Pray Saved Light
- **Frame**: `Pray/Saved Light` (Node ID: `83:3567`)
  - App: `83:3568`
    - PrayTab: `83:3570`
      - Container: `83:3571`
        - Header: `83:3572`
        - MicButton: `83:3577`
        - Saved Container: `83:3582`
          - Success Card: `83:3583`
            - Icon: `83:3584`
            - Heading 4: `83:3588`
              - Text: `83:3589` ("Prayer Saved")
            - Paragraph: `83:3590`
          - Transcript Preview: `83:3592`
            - Paragraph: `83:3593`
            - Paragraph: `83:3595`
            - View Full Transcript Button: `83:3597`
        - Set Reminder Button: `83:3599`
      - Success Toast: `83:3652`
    - Tab Bar: `83:3605`
    - App Header: `83:3618`

#### Pray Saved Dark
- **Frame**: `Pray/ Saved Dark` (Node ID: `57:2986`)
  - Similar structure to Saved Light with dark theme
  - App: `57:2987`
    - PrayTab: `57:2989`
      - Success Toast: `57:3071`

---

### 6. Journal Screens

#### Journal Light
- **Frame**: `Journal/Light` (Node ID: `5:910`)
  - JournalTab: `5:911`
    - Header Container: `5:912`
      - JournalTab Header: `5:913`
        - Heading 2: `5:915`
          - Text: `5:916` ("Your Prayer Journey")
        - Paragraph: `5:917`
          - Text: `5:918` ("You've prayed 10 days this month")
        - Streak Container: `5:919`
          - Icon: `5:920`
          - StreakChip: `5:922`
            - Text: `5:923` ("10 days")
      - ProgressBar: `5:924`
    - MonthCalendar: `5:926`
      - Header: `5:927`
        - Prev Button: `5:928`
        - Month Heading: `5:931`
        - Next Button: `5:933`
      - Weekday Headers: `5:936`
      - Calendar Grid: `5:951`
        - Date Buttons: `5:952` - `5:1024`
    - Reflection Card: `5:1025`
      - Weekly Reflection: `5:1026`
        - Icon: `5:1027`
        - Heading 3: `5:1034`
          - Text: `5:1035` ("Finding Peace in Uncertainty")
        - Paragraph: `5:1036`
        - Reflection Text: `5:1038`
        - Quote Card: `5:1040`
    - Recent Prayers: `5:1049`
      - Heading 3: `5:1050`
      - Prayer Cards: `5:1053`, `5:1066`, `5:1079`
    - Monthly Reflection: `5:1092`
    - Upgrade CTA: `5:1107`
    - Tab Bar: `5:1117`
    - App Header: `5:1130`

#### Journal Dark
- **Frame**: `Journal/Dark` (Node ID: `57:2551`)
  - Similar structure to Journal Light with dark theme
  - JournalTab: `57:2552`

#### Journal Entry Light
- **Frame**: `Journal/Entry Light` (Node ID: `5:1165`)
  - JournalTab: `5:1166`
    - (Same structure as Journal Light)
    - Modal Overlay: `5:1422`
      - DialogHeader: `5:1423`
        - PrayerModal: `5:1424`
          - Heading: `5:1425`
          - Date: `5:1428`
          - Close Button: `5:1430`
      - PrayerModal Content: `5:1436`
        - Audio Player: `5:1437`
          - Play Button: `5:1439`
          - Time Display: `5:1442`
          - Progress Bar: `5:1448`
        - Transcript Section: `5:1450`
          - Heading 4: `5:1451`
          - Paragraph: `5:1453`
        - Upgrade CTA: `5:1455`

#### Journal Entry Dark
- **Frame**: `Journal/Entry Dark` (Node ID: `57:2242`)
  - Similar structure to Entry Light with dark theme
  - JournalTab: `57:2243`
    - Modal Overlay: `57:2498`
      - DialogHeader: `57:2499`
      - PrayerModal: `57:2512`

---

### 7. Settings Screens

#### Settings Light
- **Frame**: `Settings/Light` (Node ID: `10:1667`)
  - PrayTab: `10:1668`
    - (Pray screen content)
  - Settings Sheet: `10:1739`
    - SheetHeader: `10:1740`
      - Heading 2: `10:1741`
        - Text: `10:1742` ("Settings")
      - Paragraph: `10:1743`
    - SettingsSheet: `10:1745`
      - Appearance Section: `10:1746`
        - Heading 4: `10:1747`
        - Dark Mode Toggle: `10:1749`
      - Notifications Section: `10:1768`
        - Heading 4: `10:1769`
        - Daily Reminder Toggle: `10:1771`
        - Reminder Time Picker: `10:1784`
        - Set Reminder Button: `10:1789`
      - Privacy Section: `10:1791`
        - Heading 4: `10:1792`
        - Delete Audio Files Toggle: `10:1794`
      - Subscription Section: `10:1809`
        - Heading 4: `10:1810`
        - Plan Display: `10:1812`
        - Manage Subscription Button: `10:1822`
      - Support & Legal Section: `10:1824`
        - Heading 4: `10:1825`
        - Help & Support Button: `10:1828`
        - Privacy Policy Button: `10:1835`
        - Terms of Service Button: `10:1840`
      - Version Text: `10:1849`
    - Close Button: `10:1851`

#### Settings Dark
- **Frame**: `Settings/Dark` (Node ID: `57:2804`)
  - Similar structure to Settings Light with dark theme
  - PrayTab: `57:2805`
  - Settings Sheet: `57:2876`
    - SheetHeader: `57:2877`
    - SettingsSheet: `57:2882`

---

## 📦 Reusable Components

### Common Components
- **Logo**: Multiple instances across screens
  - Light versions: `83:3546`, `83:3531`, `83:3536`, `83:3555`, `83:3559`, `83:3563`
  - Dark versions: `83:3674`, `83:3678`, `83:3682`, `83:3686`, `83:3690`, `83:3694`

### Tab Navigation
- **Tab Bar**: `Primitive.div` containing two `Primitive.button` elements
  - Pray Tab
  - Journal Tab

### App Header
- **App Header**: Contains Logo, Title, and Settings Button
- Consistent structure across all main screens

### Cards
- **PrayerCard**: Used in Journal screens for displaying prayer entries
- **ReflectionCard**: Used for weekly/monthly reflections
- **Plan Card**: Used in Paywall screen

### Buttons
- **MicButton**: Large circular button for prayer recording
- **Primary Button**: Main action buttons
- **Secondary Button**: Alternative actions
- **Toggle Switch**: Used in Settings for preferences

### Forms
- **Input**: Text input fields with labels
- **Time Picker**: For selecting reminder times
- **Checkbox**: For terms acceptance

---

## 🎨 Design System Notes

### Color Themes
- **Light Theme**: Used in screens with `/Light` suffix
- **Dark Theme**: Used in screens with `/Dark` suffix

### Screen Variants
Each main screen has both Light and Dark variants:
- Pray (Light/Dark)
- Pray Recording (Light/Dark)
- Pray Saved (Light/Dark)
- Journal (Light/Dark)
- Journal Entry (Light/Dark)
- Settings (Light/Dark)

### Navigation Flow
1. Splash → Onboarding (1, 2, 3) → Reminder → Reminder2
2. Login/Sign Up → Main App
3. Main App: Pray ↔ Journal (via Tab Bar)
4. Settings accessible from any main screen
5. Paywall accessible from upgrade prompts

---

## 📝 Notes
- All node IDs are in format `X:YYYY` where X is the page/frame ID and YYYY is the component ID
- Components are nested hierarchically within frames
- Many components share similar IDs across light/dark variants
- Modal overlays (like Journal Entry) appear on top of base screens

