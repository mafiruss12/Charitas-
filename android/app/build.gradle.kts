import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

fun resolveBackendUrl(propName: String, fallback: String = ""): String {
    val fromProp = (project.findProperty(propName) as String?)?.trim().orEmpty()
    val fromEnv = System.getenv(propName)?.trim().orEmpty()
    return fromProp.ifBlank { fromEnv }.ifBlank { fallback }.trimEnd('/')
}

val apiBaseUrl = resolveBackendUrl("CHARITAS_API_BASE_URL")
val debugApiBaseUrl = resolveBackendUrl("CHARITAS_DEBUG_API_BASE_URL", apiBaseUrl)
val isReleaseBackendConfigured = apiBaseUrl.startsWith("https://")
val isDebugBackendConfigured = debugApiBaseUrl.startsWith("https://") ||
    debugApiBaseUrl.startsWith("http://10.0.2.2") ||
    debugApiBaseUrl.startsWith("http://localhost") ||
    debugApiBaseUrl.startsWith("http://127.0.0.1")

val signingKeystorePath = System.getenv("SIGNING_KEYSTORE_PATH")?.trim().orEmpty()
val signingKeystorePassword = System.getenv("SIGNING_KEYSTORE_PASSWORD")?.trim().orEmpty()
val signingKeyAlias = System.getenv("SIGNING_KEY_ALIAS")?.trim().orEmpty()
val signingKeyPassword = System.getenv("SIGNING_KEY_PASSWORD")?.trim().orEmpty()
val allowDebugSigningForRelease = System.getenv("CI_ALLOW_DEBUG_SIGNING_FOR_RELEASE") == "true"
val hasReleaseSigning = signingKeystorePath.isNotBlank() &&
    File(signingKeystorePath).exists() &&
    signingKeystorePassword.isNotBlank() &&
    signingKeyAlias.isNotBlank() &&
    signingKeyPassword.isNotBlank()

android {
    namespace = "ci.ebimpe.charitas"
    compileSdk = 35

    defaultConfig {
        applicationId = "ci.ebimpe.charitas"
        minSdk = 24
        targetSdk = 35
        versionCode = 4
        versionName = "1.0.3"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = File(signingKeystorePath)
                storePassword = signingKeystorePassword
                keyAlias = signingKeyAlias
                keyPassword = signingKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            val effectiveDebugUrl = if (isDebugBackendConfigured) debugApiBaseUrl else "https://offline.charitas.local"
            buildConfigField("String", "API_BASE_URL", "\"$effectiveDebugUrl\"")
            buildConfigField("boolean", "IS_BACKEND_CONFIGURED", isDebugBackendConfigured.toString())
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            val effectiveReleaseUrl = if (isReleaseBackendConfigured) apiBaseUrl else "https://offline.charitas.local"
            buildConfigField("String", "API_BASE_URL", "\"$effectiveReleaseUrl\"")
            buildConfigField("boolean", "IS_BACKEND_CONFIGURED", isReleaseBackendConfigured.toString())
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            } else if (allowDebugSigningForRelease) {
                signingConfig = signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:security"))
    implementation(project(":core:database"))
    implementation(project(":core:network"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    implementation(libs.work.runtime.ktx)
    implementation(libs.retrofit.core)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.media3.exoplayer)
    implementation(libs.media3.exoplayer.hls)
    implementation(libs.media3.ui)

    implementation(libs.coil.compose)
    implementation(libs.zxing.core)
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
}
