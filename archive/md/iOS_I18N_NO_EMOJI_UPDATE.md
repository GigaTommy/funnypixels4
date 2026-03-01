# iOS 启动界面 - 多语言支持与图标优化

## ✅ 已完成的改进

### 1. 移除 Emoji，使用项目资源和系统图标 🎨 → ✅

#### 问题
- 原设计使用 emoji 作为视觉元素（💡🎨🌍🏆等）
- Emoji 在不同系统版本和设备上显示可能不一致
- 不够专业，缺乏品牌识别度

#### 改进
**文件**: `LaunchLoadingView.swift`

**Logo 部分**:
```swift
// ❌ 之前：使用系统图标
Image(systemName: "map.fill")

// ✅ 现在：使用项目 Logo
Image("AppLogo")
    .resizable()
    .scaledToFit()
    .frame(width: 80, height: 80)
    .clipShape(RoundedRectangle(cornerRadius: 16))
```

**提示图标**:
```swift
// ❌ 之前：硬编码 emoji
"💡 Tip: Long press a pixel..."

// ✅ 现在：使用 SF Symbol 图标
HStack(spacing: 8) {
    Image(systemName: "lightbulb.fill")
        .font(.system(size: 14))
        .foregroundColor(.white.opacity(0.5))

    Text(currentTip)
        .font(AppTypography.caption())
}
```

---

### 2. 完整的多语言支持 🌍

#### 问题
- 所有文本都是硬编码的英文
- Slogan "Painting the World Together" 不支持多语言
- 8 条每日提示都是硬编码英文

#### 改进
**支持的语言**: zh-Hans, en, ja, ko, es, pt-BR（6 种语言）

**新增本地化键**:

| 键名 | 中文 | 英文 | 日文 | 韩文 | 西班牙文 | 葡萄牙文 |
|------|------|------|------|------|---------|---------|
| `launch.slogan` | 一起绘制世界 | Painting the World Together | 世界を一緒に描こう | 함께 세계를 그려요 | Pintando el Mundo Juntos | Pintando o Mundo Juntos |
| `launch.tip.long_press` | 长按像素可查看创作者 | Long press a pixel to see its creator | ピクセルを長押しで作成者を確認 | 픽셀을 길게 눌러 창작자 확인 | Mantén presionado un pixel para ver su creador | Pressione longo um pixel para ver seu criador |
| `launch.tip.color_palette` | 左右滑动快速切换调色板 | Swipe to switch between color palettes | スワイプでカラーパレットを切り替え | 스와이프로 컬러 팔레트 전환 | Desliza para cambiar entre paletas | Deslize para alternar entre paletas |
| `launch.tip.zoom_out` | 缩小地图可欣赏全球作品 | Zoom out to see global masterpieces | 縮小して世界の作品を鑑賞 | 축소하여 글로벌 걸작 감상 | Alejar para ver obras maestras | Diminua o zoom para ver obras-primas |
| `launch.tip.daily_tasks` | 完成每日任务获得奖励积分 | Complete daily tasks for bonus points | デイリータスクでボーナスポイント獲得 | 일일 과제로 보너스 포인트 획득 | Completa tareas diarias para puntos | Complete tarefas diárias para pontos |
| `launch.tip.alliance` | 加入联盟，在排行榜上称霸 | Join an alliance to dominate the map | アライアンスに参加してランキング制覇 | 동맹에 가입하여 지도 장악 | Únete a una alianza para dominar | Junte-se a uma aliança para dominar |
| `launch.tip.consecutive_login` | 连续登录天数解锁更多奖励 | Consecutive login days unlock rewards | 連続ログインで報酬アンロック | 연속 로그인으로 보상 잠금 해제 | Días consecutivos desbloquean recompensas | Logins consecutivos desbloqueiam recompensas |
| `launch.tip.gps_drawing` | 使用 GPS 绘制创作大型作品 | Use GPS drawing for large artworks | GPS描画で大型作品を制作 | GPS 그리기로 대형 작품 제작 | Usa dibujo GPS para obras grandes | Use desenho GPS para obras grandes |
| `launch.tip.like_pixels` | 点赞优秀作品支持创作者 | Like great pixels to support creators | 素晴らしい作品にいいねして応援 | 좋아요로 창작자 지원 | Da me gusta a grandes pixels | Curta pixels incríveis para apoiar |

---

### 3. 代码实现

#### LaunchLoadingView.swift

**本地化 Slogan**:
```swift
// ❌ 之前：硬编码英文
Text("Painting the World Together")

// ✅ 现在：支持多语言
Text(NSLocalizedString("launch.slogan", comment: "App slogan"))
    .font(AppTypography.subtitle())
    .foregroundColor(.white.opacity(0.9))
```

**本地化每日提示**:
```swift
// ❌ 之前：硬编码英文数组
let tips = [
    "💡 Tip: Long press a pixel to see its creator",
    "🎨 Tip: Swipe between color palettes quickly",
    // ...
]

// ✅ 现在：动态加载本地化文本
var tips: [String] {
    [
        NSLocalizedString("launch.tip.long_press", comment: "Tip about long press"),
        NSLocalizedString("launch.tip.color_palette", comment: "Tip about color palettes"),
        NSLocalizedString("launch.tip.zoom_out", comment: "Tip about zooming out"),
        NSLocalizedString("launch.tip.daily_tasks", comment: "Tip about daily tasks"),
        NSLocalizedString("launch.tip.alliance", comment: "Tip about alliances"),
        NSLocalizedString("launch.tip.consecutive_login", comment: "Tip about consecutive login"),
        NSLocalizedString("launch.tip.gps_drawing", comment: "Tip about GPS drawing"),
        NSLocalizedString("launch.tip.like_pixels", comment: "Tip about liking pixels")
    ]
}
```

**随机显示提示**:
```swift
// 1秒后随机显示一条本地化提示
DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
    withAnimation(.easeIn(duration: 0.4)) {
        currentTip = tips.randomElement() ?? tips[0]
    }
}
```

---

### 4. 文件修改清单

#### 修改的文件

1. **`FunnyPixelsApp/Views/LaunchLoadingView.swift`**
   - 使用 `Image("AppLogo")` 替代系统图标
   - 所有文本改为 `NSLocalizedString`
   - 添加 SF Symbol 图标 `lightbulb.fill`
   - 移除所有 emoji

2. **`FunnyPixelsApp/Resources/zh-Hans.lproj/Localizable.strings`**
   - 添加 `launch.slogan`
   - 添加 8 个 `launch.tip.*` 键

3. **`FunnyPixelsApp/Resources/en.lproj/Localizable.strings`**
   - 添加对应的英文翻译

4. **`FunnyPixelsApp/Resources/ja.lproj/Localizable.strings`**
   - 添加对应的日文翻译

5. **`FunnyPixelsApp/Resources/ko.lproj/Localizable.strings`**
   - 添加对应的韩文翻译

6. **`FunnyPixelsApp/Resources/es.lproj/Localizable.strings`**
   - 添加对应的西班牙文翻译

7. **`FunnyPixelsApp/Resources/pt-BR.lproj/Localizable.strings`**
   - 添加对应的葡萄牙文（巴西）翻译

---

## 📊 改进效果

### 视觉效果

| 方面 | 改进前 | 改进后 |
|------|--------|--------|
| **Logo** | 系统地图图标 | 项目专属 Logo ✅ |
| **提示图标** | Emoji (💡) | SF Symbol (lightbulb.fill) ✅ |
| **品牌识别** | 弱 | 强 ✅ |
| **系统兼容性** | Emoji 可能不一致 | 图标始终一致 ✅ |

### 多语言支持

| 语言 | 改进前 | 改进后 |
|------|--------|--------|
| **中文** | 不支持 | 完全支持 ✅ |
| **英文** | 硬编码 | 本地化支持 ✅ |
| **日文** | 不支持 | 完全支持 ✅ |
| **韩文** | 不支持 | 完全支持 ✅ |
| **西班牙文** | 不支持 | 完全支持 ✅ |
| **葡萄牙文** | 不支持 | 完全支持 ✅ |

---

## 🧪 测试清单

### 视觉测试

- [ ] **Logo 显示**
  - Logo 正确加载（80x80 圆角矩形）
  - 弹入动画流畅
  - 外圈旋转动画正常

- [ ] **提示图标**
  - 灯泡图标显示正常（无 emoji）
  - 图标颜色和透明度正确
  - 与文字对齐

### 多语言测试

**测试方法**:
```
设置 -> 通用 -> 语言与地区 -> iPhone 语言
切换到不同语言后重启 app
```

- [ ] **中文（简体）**
  - Slogan: "一起绘制世界"
  - 提示随机显示且为中文
  - 所有文本无英文残留

- [ ] **英文**
  - Slogan: "Painting the World Together"
  - 提示随机显示且为英文

- [ ] **日文**
  - Slogan: "世界を一緒に描こう"
  - 提示随机显示且为日文

- [ ] **韩文**
  - Slogan: "함께 세계를 그려요"
  - 提示随机显示且为韩文

- [ ] **西班牙文**
  - Slogan: "Pintando el Mundo Juntos"
  - 提示随机显示且为西班牙文

- [ ] **葡萄牙文（巴西）**
  - Slogan: "Pintando o Mundo Juntos"
  - 提示随机显示且为葡萄牙文

### 随机性测试

- [ ] 多次启动 app，提示内容随机变化
- [ ] 每次显示的提示都是完整本地化的
- [ ] 提示淡入动画流畅

---

## 🎨 设计规范

### Logo 使用规范

```swift
// ✅ 正确使用项目 Logo
Image("AppLogo")
    .resizable()
    .scaledToFit()
    .frame(width: 80, height: 80)
    .clipShape(RoundedRectangle(cornerRadius: 16))
```

**规格**:
- 尺寸: 80x80 pt
- 圆角: 16 pt
- 缩放: aspectFit（保持比例）

### 图标使用规范

**优先级**:
1. **项目资源** (`Assets.xcassets` 中的图标)
2. **SF Symbols** (Apple 系统图标)
3. **避免使用** Emoji

**示例**:
```swift
// ✅ Good: 使用 SF Symbol
Image(systemName: "lightbulb.fill")
    .font(.system(size: 14))
    .foregroundColor(.white.opacity(0.5))

// ❌ Bad: 使用 emoji
Text("💡")
```

### 文本本地化规范

**所有用户可见文本都必须使用 NSLocalizedString**:

```swift
// ✅ Good: 本地化
Text(NSLocalizedString("launch.slogan", comment: "App slogan"))

// ❌ Bad: 硬编码
Text("Painting the World Together")
```

**命名规范**:
- 格式: `<模块>.<类型>.<标识>`
- 示例: `launch.tip.long_press`
- 分隔符: 使用下划线 `_`，不使用连字符 `-`

---

## 📝 本地化工作流

### 添加新文本

1. **在代码中使用 NSLocalizedString**:
```swift
Text(NSLocalizedString("new.key.here", comment: "Description"))
```

2. **在所有语言文件中添加翻译**:
   - `zh-Hans.lproj/Localizable.strings`
   - `en.lproj/Localizable.strings`
   - `ja.lproj/Localizable.strings`
   - `ko.lproj/Localizable.strings`
   - `es.lproj/Localizable.strings`
   - `pt-BR.lproj/Localizable.strings`

3. **格式**:
```
"new.key.here" = "翻译后的文本";
```

4. **注释规范**:
```swift
// comment 参数用于给翻译人员提供上下文
NSLocalizedString(
    "launch.tip.long_press",
    comment: "Tip shown on launch screen about long pressing pixels"
)
```

---

## ✅ 最佳实践总结

### ✅ 应该做的

1. **使用项目资源**
   - 优先使用 `Assets.xcassets` 中的图标和 Logo
   - 统一品牌识别

2. **使用系统图标**
   - SF Symbols 作为第二选择
   - 确保跨设备一致性

3. **完整的多语言支持**
   - 所有文本使用 `NSLocalizedString`
   - 支持项目所有语言（6 种）

4. **清晰的命名**
   - 使用有意义的本地化键名
   - 添加详细的 comment

### ❌ 应该避免

1. **不要使用 Emoji**
   - Emoji 在不同系统可能显示不一致
   - 不够专业

2. **不要硬编码文本**
   - 所有用户可见文本都要本地化
   - 即使是英文也要用 `NSLocalizedString`

3. **不要遗漏语言**
   - 添加新文本时要更新所有 6 种语言
   - 使用工具或 checklist 确保完整性

---

## 🔍 验证工具

### 检查未本地化的文本

```bash
# 在 Swift 代码中查找硬编码的中文
grep -r "[\u4e00-\u9fa5]" FunnyPixelsApp --include="*.swift" | grep -v "comment:"

# 在 Swift 代码中查找硬编码的英文文本（可能遗漏本地化）
# 注意：需要人工判断，排除代码中的合法英文（如变量名、日志等）
```

### 检查本地化文件完整性

```bash
# 检查所有语言文件中的键是否一致
for lang in zh-Hans en ja ko es pt-BR; do
    echo "=== $lang ==="
    grep -o '"[^"]*"' "FunnyPixelsApp/Resources/$lang.lproj/Localizable.strings" \
        | sed 's/"//g' \
        | grep "^launch\." \
        | sort
done
```

---

**更新日期**: 2026-02-25
**影响范围**: 启动加载界面
**多语言支持**: ✅ 完整（6 种语言）
**Emoji 移除**: ✅ 完成
**品牌识别**: ✅ 使用项目 Logo
