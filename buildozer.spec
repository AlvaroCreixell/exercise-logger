[app]

title = Exercise Logger
package.name = exerciselogger
package.domain = com.creix
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json
source.include_patterns = src/**/*.py,src/**/*.kv,main.py
source.exclude_dirs = tests,.github,.buildozer,docs,.superpowers,.worktrees,bin

version = 0.1.0

# KivyMD 2.x pinned to specific commit (2026-03-07: "fix touch in scrollview")
# No PyPI release for 2.x — must install from GitHub
requirements = python3,kivy==2.3.1,https://github.com/kivymd/KivyMD/archive/365aa9b96eee63e0e29c04de297dd222f478fce5.zip,materialyoucolor,materialshapes,asyncgui,asynckivy,pillow,certifi,filetype

android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
android.api = 34
android.minapi = 24
android.archs = arm64-v8a
android.accept_sdk_license = True

orientation = portrait
fullscreen = 0
log_level = 2

[buildozer]
warn_on_root = 0
