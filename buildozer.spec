[app]

# App metadata
title = Exercise Logger
package.name = exerciselogger
package.domain = com.creix
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json
source.include_patterns = src/**/*.py,src/**/*.kv,main.py
source.exclude_dirs = tests,.github,.buildozer,docs,.superpowers,.worktrees,bin

# Version
version = 0.1.0

# Requirements — let p4a handle pyjnius/cython internally
requirements = python3,kivy==2.3.1,kivymd==2.0.1,matplotlib,pillow,certifi

# Android settings
android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
android.api = 34
android.minapi = 24
android.archs = arm64-v8a
android.accept_sdk_license = True

# Orientation
orientation = portrait

# Fullscreen (hides status bar)
fullscreen = 0

# Log level
log_level = 2

[buildozer]
warn_on_root = 1
