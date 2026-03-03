# 崩溃问题调查

## 🐛 崩溃症状

**报告**: "doesNotRecognizeSelector"异常崩溃
**堆栈**:
- pthread_kill/abort
- NSThreadPerformPerform
- UIApplicationMain/SwiftUI初始化

## 🔍 已修复的潜在问题

### 1. 缺失的音频文件 ✅

**问题**: `button_click.m4a` 文件不存在，但代码中引用了它

**影响位置**:
- `SoundManager.swift:44` - preloadCommonSounds()列表中
- `SoundManager.swift:187` - playGPSDrawingStop()方法中
- `SoundEffect.swift:10` - 枚举定义

**修复**: 创建了 `button_click.m4a` 文件（复制自 `tab_switch.m4a`）

**位置**: `/Users/ginochow/code/funnypixels3/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds/button_click.m4a`

### 2. 项目构建状态 ✅

- ✅ 编译成功（无错误）
- ⚠️ 3个非关键警告（nonisolated(unsafe)、deprecated onChange）
- ✅ 所有依赖包正常解析

## 🔍 待确认信息

为了准确定位崩溃原因，需要用户提供：

### 1. 完整的异常信息

应该类似：
```
*** Terminating app due to uncaught exception 'NSInvalidArgumentException',
reason: '-[__NSCFString someMethod]: unrecognized selector sent to instance 0x...'
```

**关键信息**:
- 哪个类接收了不识别的选择器
- 具体的选择器名称是什么

### 2. 崩溃触发时机

- [ ] App启动时立即崩溃
- [ ] 点击特定按钮时崩溃（哪个按钮？）
- [ ] 切换Tab时崩溃（哪个Tab？）
- [ ] 其他操作（请描述）

### 3. Xcode控制台日志

崩溃前最后几行的日志（可能包含线索）

## 🔎 可能的原因

### A. 方法签名不匹配

**检查项**:
- [x] SoundManager.play(_ effect:) - ✅ 存在于SoundManager+Enhanced.swift
- [x] HapticManager.impact(style:) - ✅ 存在
- [x] HapticManager.notification(type:) - ✅ 存在

### B. 对象生命周期问题

**可疑场景**:
- ViewModel被提前释放
- @Published属性的观察者失效
- Combine取消订阅后的回调

### C. 线程安全问题

**线索**: 堆栈中出现NSThreadPerformPerform

**可能原因**:
- 主线程调用了后台线程的方法
- performSelector调用了不存在的方法
- 跨线程的选择器传递

## 📋 排查步骤

### 第一步：启用僵尸对象检测

Xcode -> Edit Scheme -> Run -> Diagnostics:
- [x] Enable Zombie Objects

### 第二步：添加异常断点

Xcode -> Breakpoint Navigator:
- [x] Add Exception Breakpoint (All Exceptions)

### 第三步：查看详细日志

运行App，观察控制台输出，注意：
- Logger.error/warning消息
- 崩溃前的最后几个操作
- 内存警告

## 🎯 下一步行动

1. **用户提供**: 完整崩溃信息（异常名称、触发时机、控制台日志）
2. **工程师**: 根据信息定位具体的选择器和类
3. **修复**: 针对性修复方法调用或对象生命周期问题

---

**当前状态**: 等待用户提供详细崩溃信息

**已完成**:
- ✅ 修复缺失的button_click.m4a文件
- ✅ 验证项目编译成功
- ✅ 检查SoundManager/HapticManager方法签名
