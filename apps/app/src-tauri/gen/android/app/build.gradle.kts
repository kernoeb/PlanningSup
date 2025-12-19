import java.io.FileInputStream
import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("rust")
}

val tauriProperties =
        Properties().apply {
          val propFile = file("tauri.properties")
          if (propFile.exists()) {
            propFile.inputStream().use { load(it) }
          }
        }

android {
  compileSdk = 36
  namespace = "com.planningsup.desktop"
  defaultConfig {
    manifestPlaceholders += mapOf("usesCleartextTraffic" to "false")
    applicationId = "com.planningsup.desktop"
    minSdk = 24
    targetSdk = 36
    versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
    versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    ndk {
      abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
    }
  }
  splits {
    abi {
      isEnable = true
      reset()
      include("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
      isUniversalApk = true
    }
  }
  signingConfigs {
    create("release") {
      val keystorePropertiesFile = rootProject.file("keystore.properties")
      val keystoreProperties = Properties()
      if (keystorePropertiesFile.exists()) {
          keystoreProperties.load(FileInputStream(keystorePropertiesFile))
      }

      keyAlias = keystoreProperties["keyAlias"] as String
      keyPassword = keystoreProperties["password"] as String
      storeFile = file(keystoreProperties["storeFile"] as String)
      storePassword = keystoreProperties["password"] as String
    }
  }
  buildTypes { 
    getByName("debug") {
      manifestPlaceholders["usesCleartextTraffic"] = "true"
      isDebuggable = true
      isJniDebuggable = true
      isMinifyEnabled = false
      packaging {
        jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
        jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
        jniLibs.keepDebugSymbols.add("*/x86/*.so")
        jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
      }
    }
    getByName("release") {
      isMinifyEnabled = true
      signingConfig = signingConfigs.getByName("release")
      proguardFiles(
              *fileTree(".") { include("**/*.pro") }
                      .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                      .toList()
                      .toTypedArray()
      )
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
  buildFeatures { buildConfig = true }
}

rust { rootDirRel = "../../../" }

dependencies {
  implementation("androidx.webkit:webkit:1.14.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("androidx.activity:activity-ktx:1.11.0")
  implementation("com.google.android.material:material:1.13.0")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.3.0")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}

apply(from = "tauri.build.gradle.kts")