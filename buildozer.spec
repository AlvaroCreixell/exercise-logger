[app]

title = Exercise Logger
package.name = exerciselogger
package.domain = com.creix
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json
source.include_patterns = src/**/*.py,src/**/*.kv,main.py
source.exclude_dirs = tests,.github,.buildozer,docs,.superpowers,.worktrees,bin

version = 0.1.0

requirements = python3,kivy==2.3.1,https://github.com/kivymd/KivyMD/archive/master.zip,matplotlib,pillow,certifi

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
