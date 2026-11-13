-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class ci.ebimpe.charitas.core.model.** { *; }
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keep class androidx.media3.** { *; }
