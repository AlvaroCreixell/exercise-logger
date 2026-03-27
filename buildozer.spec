[app]

# App metadata
title = Exercise Logger
package.name = exerciselogger
package.domain = com.creix
version = 0.2.0

# Source configuration
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,csv,yaml
source.include_patterns = src/**/*.py,src/**/*.kv,src/data/**/*.csv,src/data/**/*.yaml,main.py
source.exclude_dirs = tests,.github,.buildozer,docs,.superpowers,.worktrees,bin

# Python/Kivy requirements
# KivyMD 2.x pinned to specific commit (not on PyPI)
# pyyaml needed for routine/benchmark template loading
# NO matplotlib — charts are Kivy canvas only
requirements = python3,kivy==2.3.1,https://github.com/kivymd/KivyMD/archive/365aa9b96eee63e0e29c04de297dd222f478fce5.zip,materialyoucolor,materialshapes,asyncgui,asynckivy,pillow,certifi,filetype,pyyaml

# Android settings
android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
android.api = 34
android.minapi = 24
android.archs = arm64-v8a
android.accept_sdk_license = True

# Display
orientation = portrait
fullscreen = 0

# Logging
log_level = 2

[buildozer]
warn_on_root = 0
