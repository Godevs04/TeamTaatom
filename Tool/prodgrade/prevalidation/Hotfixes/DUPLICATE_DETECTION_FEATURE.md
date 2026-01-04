# Locale Duplicate Detection Feature

## ✅ Implementation Complete

This feature automatically detects when you're adding or editing a locale that matches an existing one based on coordinates.

## What Was Added

### 1. Google Maps Geocoding Utility (`superAdmin/src/utils/geocoding.js`)
- `geocodeAddress()` - Converts address strings to coordinates
- `calculateDistance()` - Calculates distance between coordinates
- `areCoordinatesNearby()` - Checks if coordinates are within a radius (default 500m)
- `buildAddressString()` - Builds address string from form data

### 2. Duplicate Detection Logic
- **Automatic geocoding** when form fields change (name, city, country)
- **Debounced requests** (1 second delay) to minimize API calls
- **500-meter radius** for matching existing locales
- **Visual indicators** showing geocoding in progress

### 3. Confirmation Modal
- Shows existing locale details when a match is found
- Displays coordinates and location information
- Two options:
  - **Use Existing Locale Data**: Populates all form fields
  - **Continue with Current Input**: Proceeds with new locale

### 4. Form Integration
- Added to **Add Locale** form
- Added to **Edit Locale** form
- Loading indicators during geocoding
- Warning messages when matches are found

## How to Use

### Setup (One-time)

1. **Get Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable **Geocoding API**
   - Create an API key

2. **Add to Environment**:
   ```bash
   # In superAdmin/.env
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Restart Dev Server**:
   ```bash
   npm run dev
   ```

### Using the Feature

1. **Open Add/Edit Locale form**
2. **Enter location information**:
   - Name (e.g., "Museum of Anthropology")
   - City (e.g., "Vancouver")
   - Country (e.g., "Canada")
   - Country Code (e.g., "CA")
3. **Wait 1 second** - system automatically geocodes
4. **If match found**:
   - Confirmation modal appears
   - Review existing locale details
   - Choose to use existing data or continue

## Technical Details

### Matching Algorithm
- Geocodes the entered address
- Checks all existing locales for coordinates within **500 meters**
- Finds the **closest match** if multiple exist
- Excludes the current locale when editing

### Performance
- **Debouncing**: 1 second delay prevents excessive API calls
- **Caching**: Geocoded coordinates stored in state
- **Error handling**: Gracefully handles API failures

### API Usage
- Only geocodes when minimum required fields are present:
  - Name
  - City
  - Country OR Country Code
- Skips geocoding if fields are empty

## Files Modified

1. `superAdmin/src/pages/Locales.jsx`
   - Added duplicate detection state
   - Added geocoding effects
   - Added confirmation modal
   - Added visual indicators

2. `superAdmin/src/utils/geocoding.js` (NEW)
   - Geocoding utility functions
   - Distance calculation
   - Coordinate matching logic

3. `superAdmin/GOOGLE_MAPS_SETUP.md` (NEW)
   - Setup instructions
   - Troubleshooting guide

## Environment Variable

Required in `superAdmin/.env`:
```env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Benefits

✅ **Prevents duplicates** - Detects similar places before creation
✅ **Saves time** - One-click population of existing data
✅ **Improves data quality** - Ensures consistent location data
✅ **User-friendly** - Clear confirmation with existing locale details

## Notes

- The feature works in both **Add** and **Edit** modes
- When editing, the current locale is excluded from matches
- Geocoding only occurs when sufficient information is provided
- The system gracefully handles API failures

