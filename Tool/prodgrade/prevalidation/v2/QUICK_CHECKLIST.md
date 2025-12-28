# Quick Production Readiness Checklist
## Taatom Frontend - Play Store & App Store

**Last Updated**: 2025-01-27

---

## 🔴 Critical (Must Fix)

- [ ] **Fix hardcoded development URLs in app.json**
  - Move `API_BASE_URL` to environment variable
  - Move `WEB_SHARE_URL` to environment variable
  - Update EAS build to use production environment

- [ ] **Add Privacy Policy URLs**
  - iOS: Add to `app.json` → `ios.infoPlist.NSPrivacyPolicyURL`
  - Android: Add to Play Console → Store listing
  - Ensure privacy policy is publicly accessible

- [ ] **Secure API Keys**
  - Move Google Maps API key to environment variable
  - Add domain/package restrictions to API keys
  - Remove hardcoded keys from `app.json`

---

## 🟡 High Priority (Should Fix)

- [ ] **Complete App Store Metadata**
  - [ ] Create App Store Connect app record
  - [ ] App description (up to 4000 characters)
  - [ ] Keywords (up to 100 characters)
  - [ ] Screenshots (all required sizes)
  - [ ] App preview video (optional)
  - [ ] Support URL
  - [ ] Marketing URL (optional)

- [ ] **Complete Play Store Metadata**
  - [ ] Create Play Console app record
  - [ ] Short description (up to 80 characters)
  - [ ] Full description (up to 4000 characters)
  - [ ] Screenshots (phone: 2-8, tablet: 1-8)
  - [ ] Feature graphic (1024x500)
  - [ ] App icon (512x512)
  - [ ] Support URL

- [ ] **Content Rating**
  - [ ] Complete IARC rating (Play Store)
  - [ ] Complete age rating questionnaire (App Store)

- [ ] **Data Safety (Play Store)**
  - [ ] Complete data safety section
  - [ ] Data collection practices
  - [ ] Data sharing practices
  - [ ] Security practices

- [ ] **Add Test Suite**
  - [ ] Set up Jest and React Native Testing Library
  - [ ] Add critical path tests (auth, post creation, upload)
  - [ ] Set up CI/CD test integration

- [ ] **Environment Variable Documentation**
  - [ ] Create `.env.example` file
  - [ ] Document all required environment variables
  - [ ] Add production setup guide

- [ ] **Production Deployment Guide**
  - [ ] Document EAS build process
  - [ ] Document environment variable setup
  - [ ] Document store submission process

- [ ] **Error Recovery**
  - [ ] Add retry logic for failed operations
  - [ ] Improve offline error handling
  - [ ] Add user-friendly error messages

- [ ] **Build Verification**
  - [ ] Add automated build verification
  - [ ] Add bundle size monitoring
  - [ ] Add performance budgets

---

## 🟢 Medium Priority

- [ ] **Performance Monitoring**
  - [ ] Set up performance metrics collection
  - [ ] Add performance budgets
  - [ ] Monitor bundle size

- [ ] **Documentation**
  - [ ] API documentation
  - [ ] Architecture documentation
  - [ ] Troubleshooting guide

- [ ] **Dependency Updates**
  - [ ] Run `npm audit`
  - [ ] Update vulnerable dependencies
  - [ ] Verify React 19 compatibility

- [ ] **User Feedback**
  - [ ] Add in-app bug reporting
  - [ ] Add feedback form

---

## 📱 Device Testing Checklist

- [ ] Test on iOS 13.0+ (minimum supported)
- [ ] Test on Android 8.0+ (minimum supported)
- [ ] Test on various screen sizes
- [ ] Test with poor network conditions
- [ ] Test offline functionality
- [ ] Test all permission flows
- [ ] Test authentication flows
- [ ] Test post creation and upload
- [ ] Test image/video playback
- [ ] Test location features
- [ ] Test push notifications
- [ ] Test deep linking
- [ ] Test app updates
- [ ] Test background behavior

---

## 🏪 Store Submission Checklist

### App Store

- [ ] App Store Connect app created
- [ ] All metadata completed
- [ ] Screenshots uploaded
- [ ] Privacy policy URL added
- [ ] Age rating completed
- [ ] TestFlight beta testing completed
- [ ] App review information completed
- [ ] App submitted for review

### Play Store

- [ ] Play Console app created
- [ ] All metadata completed
- [ ] Screenshots uploaded
- [ ] Privacy policy URL added
- [ ] Content rating (IARC) completed
- [ ] Data safety section completed
- [ ] Internal testing completed
- [ ] App submitted for review

---

## ⏱️ Estimated Timeline

- **Critical Issues**: 5 hours
- **High Priority Issues**: 46 hours
- **Total**: ~51 hours (6-7 working days)

---

## 📞 Support Resources

- [Expo Documentation](https://docs.expo.dev/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Sentry Documentation](https://docs.sentry.io/platforms/react-native/)

---

**Status**: 🟡 Needs Attention  
**Next Review**: After critical issues resolved

