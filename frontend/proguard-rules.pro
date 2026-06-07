# Custom ProGuard Rules for React Native Fabric / New Architecture
# Keep all ViewManagers and EventDispatchers to prevent ClassLinker::FindClass crashes during executeMount
-keep public class * extends com.facebook.react.uimanager.ViewManager {
    public <init>(...);
    public <init>();
}
-keep public class * extends com.facebook.react.uimanager.events.EventDispatcher {
    public <init>(...);
    public <init>();
}

# Keep Fabric specific classes
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.yoga.** { *; }

# Keep common libraries that might lack Fabric proguard rules
-keep class org.reactnative.maskedview.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class expo.modules.blur.** { *; }
-keep class expo.modules.lineargradient.** { *; }
