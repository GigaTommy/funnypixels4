import Foundation
import UIKit
import MapLibre
import Combine
import CoreLocation

/// 高性能 MVT 渲染器
/// 针对 4万亿像素规模优化，完全基于 GPU 渲染
@MainActor
public class HighPerformanceMVTRenderer: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var isSetupComplete: Bool = false
    @Published public private(set) var loadedEmojiCount: Int = 0
    @Published public private(set) var isPrefetching: Bool = false // Sensory feedback for prefetching

    // MARK: - Configuration

    /// 动态加载的 emoji（运行时发现的新 emoji）
    private var dynamicEmojis: Set<String> = []

    /// 已加载的 sprite 名称集合
    private var loadedSprites: Set<String> = []

    /// Complex pattern 缓存（从 API 加载）
    private var complexPatternCache: Set<String> = []

    /// Color 到 sprite key 的映射（从 API 加载）
    private var colorToSpriteKey: [String: String] = [:]

    /// Emoji 到 sprite key 的映射（从 API 加载）
    private var emojiToSpriteKey: [String: String] = [:]

    /// Sprite key 到 render_type 的映射（用于热点更新类型推断）
    private var spriteKeyToRenderType: [String: String] = [:]

    /// Sprite key 到 unicode_char 的映射（用于 emoji 渲染）
    private var spriteKeyToUnicode: [String: String] = [:]

    /// Fallback emoji 字符集（当 API 加载失败时使用）
    private var fallbackEmojis: Set<String> = []

    /// 性能统计
    private var performanceMetrics = PerformanceMetrics()

    /// Cancellables for Combine
    private var cancellables = Set<AnyCancellable>()

    /// Sprite 服务（从后端 API 加载）
    private let spriteService = SpriteService.shared

    // MARK: - Performance Optimization

    /// 后台队列用于 CPU 密集型操作（MVT 解码、Sprite 生成）
    private let processingQueue = DispatchQueue(label: "com.funnypixels.mvt.processing", qos: .userInitiated)

    /// 自适应批处理参数
    private var currentBatchInterval: TimeInterval = 50
    private var currentMaxBatchSize: Int = 200

    /// 低功耗渲染模式标志
    private var isReducedRendering: Bool = false
    /// 原始批处理间隔（用于恢复）
    private var originalBatchInterval: TimeInterval = 50

    // MARK: - Hotpatch State

    /// Hotpatch 像素数据（按类型分组）
    private var hotpatchPixels: [String: [MLNPointFeature]] = [:]
    /// Hotpatch 数据源
    private weak var hotpatchSource: MLNShapeSource?
    /// 批处理定时器
    private var batchTimer: Timer?
    /// 待处理的像素更新队列
    private var pendingUpdates: [PixelUpdate] = []

    // MARK: - MVT Refresh State

    /// 上次刷新 MVT 的时间
    private var lastMVTRefreshTime: Date?
    /// MVT 刷新节流间隔（秒）- 避免频繁刷新
    private let mvtRefreshThrottleInterval: TimeInterval = 5.0

    private weak var style: MLNStyle?
    private weak var mapView: MLNMapView?

    // MARK: - Rendering Constants

    private let colorScaleStops: [NSNumber: NSNumber] = [
        12: 0.0156, 13: 0.03125, 14: 0.0625, 
        15: 0.125, 16: 0.25, 17: 0.5, 18: 0.75
    ]

    private let emojiScaleStops: [NSNumber: NSNumber] = [
        12: 0.0117, 13: 0.0234, 14: 0.0469, 
        15: 0.09375, 16: 0.1875, 17: 0.375, 18: 0.5625
    ]

    // MARK: - Initialization

    public init(mapView: MLNMapView) {
        self.mapView = mapView
        super.init()
        setupNotificationObservers()
    }

    deinit {
        cancellables.removeAll()
    }

    // MARK: - Notification Observers

    private func setupNotificationObservers() {
        // Listen for new emoji discoveries
        NotificationCenter.default.publisher(for: .newEmojiDiscovered)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let emoji = notification.userInfo?["emoji"] as? String else { return }
                Task { @MainActor in
                    await self?.handleNewEmoji(emoji)
                }
            }
            .store(in: &cancellables)

        // Listen for GPS pixel drawn notifications (immediate update without batch delay)
        NotificationCenter.default.publisher(for: .gpsPixelDidDraw)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self = self,
                      let userInfo = notification.userInfo else { return }
                
                Logger.info("🎯 [Renderer] Received .gpsPixelDidDraw with userInfo: \(userInfo)")

                // Determine type: prioritize explicit 'type', then fallback to logic
                let rawType = userInfo["type"] as? String
                let type: String
                if let rawType = rawType, !rawType.isEmpty {
                    // Normalize "gps" type to "color" if simple, or keep others
                    if rawType == "gps" {
                         type = (userInfo["patternId"] as? String != nil) ? "complex" : "color"
                    } else {
                         type = rawType
                    }
                } else {
                    // Legacy fallback
                    type = userInfo["patternId"] as? String != nil ? "complex" : "color"
                }

                let pixelUpdate = PixelUpdate(
                    id: userInfo["pixelId"] as? String ?? "",
                    type: type,
                    lat: userInfo["latitude"] as? Double ?? 0,
                    lng: userInfo["longitude"] as? Double ?? 0,
                    color: userInfo["color"] as? String,
                    emoji: userInfo["emoji"] as? String,
                    patternId: userInfo["patternId"] as? String,
                    materialId: userInfo["materialId"] as? String,
                    imageUrl: userInfo["imageUrl"] as? String,  // 🔧 从通知中读取用户头像 URL
                    payload: userInfo["payload"] as? String,
                    likeCount: 0,
                    updatedAt: ISO8601DateFormatter().string(from: Date())
                )

                // Add directly to hotpatch without batch delay
                Task { @MainActor in
                    Logger.info("🎯 [Renderer] Dispatching handleGPSPixelUpdate for \(pixelUpdate.id)")
                    await self.handleGPSPixelUpdate(pixelUpdate)
                }
            }
            .store(in: &cancellables)

        // Listen for reduced rendering mode (low-power mode)
        NotificationCenter.default.publisher(for: .reducedRenderingMode)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let isReduced = notification.object as? Bool else { return }
                Task { @MainActor in
                    await self?.setReducedRenderingMode(isReduced)
                }
            }
            .store(in: &cancellables)
    }

    /// Handle dynamically discovered emoji
    private func handleNewEmoji(_ emoji: String) async {
        guard let style = style,
              !loadedSprites.contains(emoji) else { return }

        Logger.info("🆕 Discovered new emoji: \(emoji)")

        // Generate sprite for new emoji
        if let image = createEmojiImage(emoji) {
            style.setImage(image, forName: emoji)
            loadedSprites.insert(emoji)
            dynamicEmojis.insert(emoji)
            loadedEmojiCount += 1

            // Rebuild emoji layer to include new emoji
            await rebuildEmojiLayer(style: style)
        }
    }

    /// Register a new complex sprite from payload
    private func registerComplexSprite(id: String, payload: String) async {
        guard let style = style else { 
            Logger.error("❌ [Renderer] Cannot register sprite: style is nil")
            return 
        }

        Logger.info("🖼️ [Renderer] Registering complex sprite: \(id), payload length: \(payload.count)")

        let cleanPayload = payload.replacingOccurrences(of: "data:image/png;base64,", with: "")
        if let data = Data(base64Encoded: cleanPayload, options: .ignoreUnknownCharacters),
           let uiImage = UIImage(data: data) {
            style.setImage(uiImage, forName: id)
            loadedSprites.insert(id)
            complexPatternCache.insert(id)
            Logger.info("✅ [Renderer] Registered complex sprite SUCCESS: \(id) (size: \(uiImage.size))")
        } else {
            Logger.error("❌ [Renderer] Failed to decode complex sprite payload for \(id)")
        }
    }

    /// Register a complex sprite from a URL or local path
    private func registerComplexSpriteFromURL(id: String, urlString: String) async {
        guard let style = style else { return }
        
        // 🔧 如果后端返回相对路径，拼接 AppConfig.serverBaseURL（不带/api）
        // 静态资源（uploads/materials）应该使用 serverBaseURL，不是 apiBaseURL
        var resolvedUrlString = urlString
        if urlString.hasPrefix("/") {
            resolvedUrlString = AppConfig.serverBaseURL + urlString
        } else if urlString.contains("localhost") {
            // 兼容旧数据：将 localhost URL 替换为实际服务器地址
            if let url = URL(string: urlString) {
                resolvedUrlString = AppConfig.serverBaseURL + url.path
            }
        } else if urlString.contains("192.168.") || urlString.contains("10.0.") || urlString.contains("172.") {
            // 🔧 处理局域网IP地址：将其替换为实际服务器地址
            if let url = URL(string: urlString) {
                resolvedUrlString = AppConfig.serverBaseURL + url.path
                Logger.info("🔄 [Renderer] Converted local IP URL to server URL: \(urlString) -> \(resolvedUrlString)")
            }
        }
        
        Logger.info("🖼️ [Renderer] Registering complex sprite from URL: \(id), URL: \(resolvedUrlString)")
        
        do {
            let uiImage: UIImage
            
            if AppEnvironment.current == .development && !resolvedUrlString.contains("://") {
                // Handle local file path in development
                let fileURL = URL(fileURLWithPath: resolvedUrlString)
                guard let data = try? Data(contentsOf: fileURL),
                      let image = UIImage(data: data) else {
                    Logger.error("❌ [Renderer] Failed to load local image for \(id) from \(resolvedUrlString)")
                    return
                }
                uiImage = image
                Logger.info("✅ [Renderer] Loaded local image SUCCESS: \(id) from \(resolvedUrlString)")
            } else {
                // Download from URL
                guard let url = URL(string: resolvedUrlString) else {
                    Logger.error("❌ [Renderer] Invalid sprite URL: \(resolvedUrlString)")
                    return
                }

                // User avatar sprites: bypass URL cache (avatar can change, backend renders from pixel data)
                var request = URLRequest(url: url)
                if id.hasPrefix("user_avatar_") {
                    request.cachePolicy = .reloadIgnoringLocalCacheData
                }

                let (data, _) = try await URLSession.shared.data(for: request)
                guard let image = UIImage(data: data) else {
                    Logger.error("❌ [Renderer] Failed to decode image from URL: \(resolvedUrlString), dataSize=\(data.count)")
                    return
                }
                uiImage = image
                Logger.info("✅ [Renderer] Downloaded and registered sprite SUCCESS: \(id) from \(resolvedUrlString), size=\(data.count) bytes")
            }
            
            style.setImage(uiImage, forName: id)
            loadedSprites.insert(id)
            complexPatternCache.insert(id)
        } catch {
            Logger.error("❌ [Renderer] Failed to register sprite from URL \(resolvedUrlString): \(error)")
        }
    }

    /// Handle GPS pixel drawn notification (immediate update)
    private func handleGPSPixelUpdate(_ pixelUpdate: PixelUpdate) async {
        Logger.info("🎯 [Renderer] handleGPSPixelUpdate START for ID=\(pixelUpdate.id), Type=\(pixelUpdate.type)")
        Logger.info("[TRACKER] 5. Map Hotpatch Update: PixelID=\(pixelUpdate.id), Type=\(pixelUpdate.type), Emoji=\(pixelUpdate.emoji ?? "nil"), Color=\(pixelUpdate.color ?? "nil")")

        // Create feature for the new pixel
        var feature = createFeatureSafe(from: pixelUpdate)
        var type = pixelUpdate.type

        // Ensure sprite exists for emoji type
        if type == "emoji", let emoji = pixelUpdate.emoji, !loadedSprites.contains(emoji) {
            Logger.info("⚡ [Renderer] Hotpatch: Encountered new emoji '\(emoji)', generating sprite...")
            await handleNewEmoji(emoji)
        }

        // Ensure sprite exists for complex pattern type
        if type == "complex", let patternId = pixelUpdate.patternId {
            if !loadedSprites.contains(patternId) {
                if patternId.hasPrefix("user_avatar_") {
                    // User avatars: always use sprite endpoint (renders from pixel data, not broken PNG files)
                    let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    let spriteUrl = "\(baseUrl)/sprites/icon/1/complex/\(patternId).png"
                    Logger.info("⚡ [Renderer] Hotpatch: Loading user avatar sprite from endpoint: \(spriteUrl)")
                    await registerComplexSpriteFromURL(id: patternId, urlString: spriteUrl)
                } else if let imageUrl = pixelUpdate.imageUrl, !imageUrl.isEmpty {
                    Logger.info("⚡ [Renderer] Hotpatch: Encountered new complex pattern '\(patternId)', registering from URL...")
                    await registerComplexSpriteFromURL(id: patternId, urlString: imageUrl)
                } else if let payload = pixelUpdate.payload, !payload.isEmpty {
                    Logger.info("⚡ [Renderer] Hotpatch: Encountered new complex pattern '\(patternId)', registering from payload...")
                    await registerComplexSprite(id: patternId, payload: payload)
                }

                // 🔧 检查 sprite 是否真的被注册了，如果失败则降级为 color 类型
                if !loadedSprites.contains(patternId) {
                    Logger.warning("⚠️ [Renderer] Hotpatch: Failed to load sprite '\(patternId)', downgrading to color type (green fallback)")
                    type = "color"
                    // 重新创建 PixelUpdate 为 color 类型（因为属性是 let 常量）
                    let modifiedUpdate = PixelUpdate(
                        id: pixelUpdate.id,
                        type: "color",
                        lat: pixelUpdate.lat,
                        lng: pixelUpdate.lng,
                        color: "#4ECDC4",  // 绿色兜底
                        emoji: nil,
                        patternId: nil,
                        materialId: nil,
                        imageUrl: nil,
                        payload: nil,
                        likeCount: pixelUpdate.likeCount,
                        updatedAt: pixelUpdate.updatedAt
                    )
                    feature = createFeatureSafe(from: modifiedUpdate)
                }
            } else {
                Logger.info("⚡ [Renderer] Hotpatch: Sprite '\(patternId)' already registered.")
            }
        }

        // Remove from old type bucket (if exists)
        for (bucketType, _) in hotpatchPixels {
            hotpatchPixels[bucketType] = hotpatchPixels[bucketType]?.filter { feature in
                guard let gridId = feature.attributes["grid_id"] as? String else { return true }
                return gridId != pixelUpdate.id
            }
        }

        // Add to new type bucket
        if hotpatchPixels[type] == nil {
            hotpatchPixels[type] = []
        }
        hotpatchPixels[type]?.append(feature)
        Logger.info("✅ [Renderer] handleGPSPixelUpdate COMPLETE: Feature ID=\(pixelUpdate.id) added to bucket=\(type), total features in bucket: \(hotpatchPixels[type]?.count ?? 0)")

        // Update the source immediately
        updateHotpatchSource()
        Logger.debug("⚡ updateHotpatchSource returns")

        // Clean up old entries to prevent memory bloat
        cleanupExpiredHotpatchPixels()
    }

    // MARK: - Setup

    /// 设置高性能 MVT 图层
    public func setupHighPerformanceLayers(style: MLNStyle) async {
        self.style = style

        let startTime = Date()
        Logger.info("🚀 Setting up high-performance MVT layers...")

        // 1. 从后端 API 加载 sprites
        do {
            // 🔧 固定使用 scale=1 从后端加载 sprites
            // 后端 sprite 的 scale 参数影响 sprite 的实际像素尺寸
            // scale=1 时 sprite 为 64x64，scale=2 时为 128x128
            // 我们需要使用 scale=1 以保证与本地生成的 color sprite (64x64) 大小一致
            let scale = 1
            let loadedCount = try await spriteService.loadSpritesFromAPI(scale: scale)
            loadedEmojiCount = loadedCount
            performanceMetrics.emojiSpriteGenerationTime = Date().timeIntervalSince(startTime)

            // 预加载 sprites 到 MapLibre style
            await spriteService.preloadSpritesIntoStyle(style)

            // 🔍 调试：验证已加载的 sprite 尺寸
            Logger.info("📊 [Sprite Debug] 验证 sprite 尺寸 (backend scale=\(scale)):")
            if let testSpriteKey = emojiToSpriteKey.values.first,
               let testImage = style.image(forName: testSpriteKey) {
                Logger.info("   - 测试 sprite '\(testSpriteKey)': \(testImage.size.width) x \(testImage.size.height) @\(testImage.scale)x")
                Logger.info("   - 实际物理像素: \(testImage.size.width * testImage.scale) x \(testImage.size.height * testImage.scale)")
            }
            if let colorSprite = style.image(forName: "color_000000") {
                Logger.info("   - color_000000 sprite: \(colorSprite.size.width) x \(colorSprite.size.height) @\(colorSprite.scale)x")
                Logger.info("   - 实际物理像素: \(colorSprite.size.width * colorSprite.scale) x \(colorSprite.size.height * colorSprite.scale)")
            }

            // 获取所有 sprite 信息并建立映射
            let allSpriteInfo = await spriteService.getAllSpriteInfo()
            buildSpriteMappings(from: allSpriteInfo)

            // 更新已加载 sprites 集合
            for spriteInfo in allSpriteInfo {
                loadedSprites.insert(spriteInfo.key)
            }

            // 确保 sdf-square fallback sprite 存在（即使 API 加载成功也需要）
            if let sdfSquare = createSDFSquare() {
                style.setImage(sdfSquare, forName: SpriteConfig.sdfSquareName)
                loadedSprites.insert(SpriteConfig.sdfSquareName)
                Logger.info("✅ SDF square fallback sprite created")
            }
        } catch {
            Logger.error("❌ Failed to load sprites from API: \(error)")
            Logger.warning("⚠️ Falling back to hardcoded emoji sprites...")

            // Fallback: 使用硬编码的 emoji 列表
            await preGenerateFallbackEmojiSprites(style: style)
            performanceMetrics.emojiSpriteGenerationTime = Date().timeIntervalSince(startTime)

            // 生成 fallback SDF square
            if let sdfSquare = createSDFSquare() {
                style.setImage(sdfSquare, forName: SpriteConfig.sdfSquareName)
                loadedSprites.insert(SpriteConfig.sdfSquareName)
            }
        }

        // 1.5 预注册当前用户的头像 sprite（user_avatar_* 不在 pattern_assets 表中，需要动态加载）
        if let userId = AuthManager.shared.currentUser?.id {
            let avatarPatternId = "user_avatar_\(userId)"
            if !loadedSprites.contains(avatarPatternId) {
                let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let spriteUrl = "\(baseUrl)/sprites/icon/1/complex/\(avatarPatternId).png"
                Logger.info("🖼️ [Renderer] Pre-registering user avatar sprite: \(avatarPatternId)")
                await registerComplexSpriteFromURL(id: avatarPatternId, urlString: spriteUrl)
                if loadedSprites.contains(avatarPatternId) {
                    Logger.info("✅ [Renderer] User avatar sprite pre-registered successfully")
                } else {
                    Logger.warning("⚠️ [Renderer] Failed to pre-register user avatar sprite (user may not have custom avatar)")
                }
            }
        }

        // 2. 添加 MVT 数据源
        addMVTSource(style: style)

        // 3. 添加颜色像素层（使用 API 加载的 sprites）
        addColorPixelLayer(style: style)

        // 4. 添加 emoji 像素层（使用 API 加载的 sprites）
        addEmojiPixelLayer(style: style)

        // 5. 添加 complex 像素层（使用 coalesce 表达式）
        addComplexPixelLayer(style: style)

        // 5.5 添加广告像素层（使用 SDF square + iconColor 支持256色）
        addAdPixelLayer(style: style)

        // 6. 添加 Hotpatch 图层（实时更新层）
        addHotpatchSourceAndLayers(style: style)

        // 7. 设置动态 sprite 加载
        setupDynamicSpriteLoading(style: style)

        // 8. 隐藏 base style 可能显示的文本层
        hideBaseStyleTextLayers(style: style)

        // 9. 启动 WebSocket 实时更新
        setupHotpatchWebSocket()

        let totalTime = Date().timeIntervalSince(startTime)
        isSetupComplete = true
        Logger.info("✅ High-performance MVT layers setup in \(String(format: "%.2f", totalTime))s")
        Logger.info("   - Emoji sprites: \(loadedEmojiCount)")
    }

    /// 隐藏 base style 中可能显示文本的层
    private func hideBaseStyleTextLayers(style: MLNStyle) {
        // 不需要隐藏文本层，因为我们创建的像素层没有文本属性
        // MapLibre 的 base style 不会自动显示 MVT 中的字段作为文本
    }

    /// Rebuild emoji layer with new emojis
    private func rebuildEmojiLayer(style: MLNStyle) async {
        Logger.info("🔄 Rebuilding emoji layer with \(getAllLoadedEmojis().count) emojis...")

        // Remove old layer
        if let oldLayer = style.layer(withIdentifier: "pixels-emoji") {
            style.removeLayer(oldLayer)
        }

        // Add new layer with updated match expression
        addEmojiPixelLayer(style: style)
    }

    /// 建立 sprite 映射关系
    private func buildSpriteMappings(from sprites: [SpriteInfo]) {
        var emojiMap: [String: String] = [:]
        var complexPatterns: Set<String> = []
        var renderTypeMap: [String: String] = [:]
        var unicodeMap: [String: String] = [:]

        // Color 类型不使用后端 sprites，而是本地生成纯颜色方块
        // 所以不需要建立 color 映射

        for sprite in sprites {
            renderTypeMap[sprite.key] = sprite.render_type
            if let unicode = sprite.unicode_char {
                unicodeMap[sprite.key] = unicode
            }
            switch sprite.render_type {
            case "emoji":
                // unicode_char (⚔️) -> sprite key (emoji_sword)
                if let emoji = sprite.unicode_char {
                    emojiMap[emoji] = sprite.key
                }
            case "complex":
                // 记录 complex patterns
                complexPatterns.insert(sprite.key)
            case "color":
                // Color 类型被跳过，不使用后端 sprites
                break
            default:
                break
            }
        }

        self.emojiToSpriteKey = emojiMap
        self.complexPatternCache = complexPatterns
        self.spriteKeyToRenderType = renderTypeMap
        self.spriteKeyToUnicode = unicodeMap

        Logger.info("✅ Sprite mappings built:")
        Logger.info("   - Colors: (using local generation)")
        Logger.info("   - Emojis: \(emojiMap.count)")
        Logger.info("   - Complex: \(complexPatterns.count)")
    }

    // MARK: - Sprite Pre-generation

    /// 预生成所有 emoji sprite (并行处理) - Fallback 方法
    /// 这是性能关键：在地图加载时一次性完成，避免运行时生成
    private func preGenerateFallbackEmojiSprites(style: MLNStyle) async {
        let emojis = SpriteConfig.commonEmojis
        Logger.info("🎨 Pre-generating \(emojis.count) fallback emoji sprites...")

        var generatedCount = 0
        var failedCount = 0
        var generatedEmojis: Set<String> = []

        // Generate sprites sequentially on main actor
        // (createEmojiImage uses UIKit which requires main thread)
        for emoji in emojis {
            if let image = createEmojiImage(emoji) {
                style.setImage(image, forName: emoji)
                loadedSprites.insert(emoji)
                generatedEmojis.insert(emoji)
                generatedCount += 1
            } else {
                failedCount += 1
                Logger.warning("⚠️ Failed to generate sprite for: \(emoji)")
            }
        }

        // Store generated emojis for fallback use
        self.fallbackEmojis = generatedEmojis

        // Generate SDF square for color pixels
        if let sdfSquare = createSDFSquare() {
            style.setImage(sdfSquare, forName: SpriteConfig.sdfSquareName)
            loadedSprites.insert(SpriteConfig.sdfSquareName)
        }

        loadedEmojiCount = generatedCount
        Logger.info("✅ Generated \(generatedCount)/\(emojis.count) fallback emoji sprites (\(failedCount) failed)")
    }

    /// Get all loaded emojis (from SpriteService or fallback)
    public func getAllLoadedEmojis() -> [String] {
        // Try to get from SpriteService first
        let serviceEmojis = spriteService.getAllLoadedEmojis()
        if !serviceEmojis.isEmpty {
            return serviceEmojis + Array(dynamicEmojis)
        }

        // Fallback to hardcoded list
        return SpriteConfig.commonEmojis + Array(dynamicEmojis)
    }

    /// Check if sprite is loaded
    public func isSpriteLoaded(_ name: String) -> Bool {
        return loadedSprites.contains(name)
    }

    /// 创建 emoji 图像 (Optimized with UIGraphicsImageRenderer)
    private func createEmojiImage(_ emoji: String) -> UIImage? {
        let size: CGFloat = 64
        let scale = mapView?.traitCollection.displayScale ?? 2.0
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false
        
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        
        return renderer.image { context in
            // 绘制 emoji
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center

            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: size * 0.8),
                .paragraphStyle: paragraphStyle
            ]

            let text = NSString(string: emoji)
            let textRect = CGRect(x: 0, y: 0, width: size, height: size)

            text.draw(in: textRect, withAttributes: attributes)
        }
    }

    /// 创建 SDF square (Optimized with UIGraphicsImageRenderer)
    private func createSDFSquare() -> UIImage? {
        let size: CGFloat = 64
        let padding: CGFloat = 8
        let scale = mapView?.traitCollection.displayScale ?? 2.0
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        
        return renderer.image { context in
            let cgContext = context.cgContext
            cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))

            cgContext.setFillColor(UIColor.white.cgColor)
            cgContext.fill(
                CGRect(
                    x: padding,
                    y: padding,
                    width: size - 2 * padding,
                    height: size - 2 * padding
                )
            )
        }
    }

    /// 创建纯色方块 sprite (Optimized with UIGraphicsImageRenderer)
    private func createColorSquare(colorHex: String) -> UIImage? {
        guard let color = UIColor(hexString: colorHex) else {
            return nil
        }
        
        let size: CGFloat = 64
        let padding: CGFloat = 8
        let scale = mapView?.traitCollection.displayScale ?? 2.0
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        
        return renderer.image { context in
            let cgContext = context.cgContext
            cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))

            cgContext.setFillColor(color.cgColor)
            cgContext.fill(
                CGRect(
                    x: padding,
                    y: padding,
                    width: size - 2 * padding,
                    height: size - 2 * padding
                )
            )
        }
    }

    /// 创建可着色的 SDF square（用于广告像素 iconColor 动态着色）
    /// 使用 .alwaysTemplate 渲染模式，MapLibre 将其作为 SDF 图像处理
    private func createSdfTintableSquare() -> UIImage? {
        let size: CGFloat = 64
        let padding: CGFloat = 8
        let scale = mapView?.traitCollection.displayScale ?? 2.0

        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)

        let image = renderer.image { context in
            let cgContext = context.cgContext
            cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))
            cgContext.setFillColor(UIColor.white.cgColor)
            cgContext.fill(
                CGRect(
                    x: padding,
                    y: padding,
                    width: size - 2 * padding,
                    height: size - 2 * padding
                )
            )
        }

        return image.withRenderingMode(.alwaysTemplate)
    }

    // MARK: - MVT Source

    private func addMVTSource(style: MLNStyle) {
        // 使用时间戳作为缓存破坏参数，确保获取最新的MVT瓦片
        let timestamp = Int(Date().timeIntervalSince1970)
        let tileURL = "\(AppConfig.apiBaseURL)/tiles/pixels/{z}/{x}/{y}.pbf?t=\(timestamp)"

        // MVT配置参数
        // 🔧 设置 source maxZoom 为 18.1 以确保 zoom=18 时能加载瓦片
        // maxZoom=18 在某些情况下可能阻止 zoom=18 的瓦片请求
        // 稍微提高此值，然后通过 layer 的 minimumZoomLevel 控制实际显示范围
        let minZoom = 12
        let maxZoom = 18.1  // 稍微高于 18 确保 zoom=18 能加载瓦片
        let tileSize = 512

        let source = MLNVectorTileSource(
            identifier: "pixels-mvt",
            tileURLTemplates: [tileURL],
            options: [
                .minimumZoomLevel: NSNumber(value: minZoom),
                .maximumZoomLevel: NSNumber(value: maxZoom),
                .tileSize: NSNumber(value: tileSize)
            ]
        )

        style.addSource(source)

        // 🔍 详细日志：MVT source配置
        Logger.info("📦 [MVT Source] ═══════════════════════════════════════════════════")
        Logger.info("📦 [MVT Source] URL模板: \(tileURL)")
        Logger.info("📦 [MVT Source] 配置参数:")
        Logger.info("   - minimumZoomLevel: \(minZoom) (低于此级别不加载瓦片)")
        Logger.info("   - maximumZoomLevel: \(maxZoom) (稍高于18确保zoom=18能加载)")
        Logger.info("   - tileSize: \(tileSize)px")
        Logger.info("📦 [MVT Source] 图层名称 (source-layer):")
        Logger.info("   - pixels-color (颜色像素)")
        Logger.info("   - pixels-emoji (emoji像素)")
        Logger.info("   - pixels-complex (复杂图案像素)")
        Logger.info("   - pixels-ad (广告像素)")
        Logger.info("📦 [MVT Source] ═══════════════════════════════════════════════════")
    }

    /// 刷新 MVT 数据源以清除缓存（带节流检查）
    /// 避免频繁刷新，最多每 N 秒刷新一次
    private func refreshMVTSourceIfNeeded() {
        let now = Date()

        // 检查是否需要节流
        if let lastRefresh = lastMVTRefreshTime {
            let timeSinceLastRefresh = now.timeIntervalSince(lastRefresh)
            if timeSinceLastRefresh < mvtRefreshThrottleInterval {
                Logger.info("⏱️ [MVT Refresh] Skipped refresh (throttled, last refresh \(String(format: "%.1f", timeSinceLastRefresh))s ago)")
                return
            }
        }

        // 执行刷新
        refreshMVTSource()

        // 更新刷新时间
        lastMVTRefreshTime = now
    }

    /// 刷新 MVT 数据源以清除缓存
    /// 通过更新时间戳参数强制重新加载瓦片
    private func refreshMVTSource() {
        guard let style = style else {
            Logger.warning("⚠️ [MVT Refresh] Cannot refresh MVT source: style is nil")
            return
        }

        // 移除旧的 MVT source（这会自动移除关联的 layers）
        if let oldSource = style.source(withIdentifier: "pixels-mvt") {
            // 先保存所有 MVT layer 的配置
            let layerIdentifiers = ["pixels-color", "pixels-emoji", "pixels-complex", "pixels-ad"]

            // 移除所有 MVT layers
            for layerId in layerIdentifiers {
                if let layer = style.layer(withIdentifier: layerId) {
                    style.removeLayer(layer)
                }
            }

            // 移除 source
            style.removeSource(oldSource)
            Logger.info("🔄 [MVT Refresh] Removed old MVT source and layers")
        }

        // 添加新的 MVT source（使用新的时间戳）
        addMVTSource(style: style)

        // 重新添加 MVT layers（按照 setupHighPerformanceLayers 中的顺序）
        addColorPixelLayer(style: style)
        addEmojiPixelLayer(style: style)
        addComplexPixelLayer(style: style)
        addAdPixelLayer(style: style)

        Logger.info("✅ [MVT Refresh] MVT source refreshed with new timestamp - cache busted!")
    }

    /// 公开方法：强制刷新 MVT 数据源（无节流）
    /// 用于用户手动触发或特殊场景
    public func forceRefreshMVT() {
        Logger.info("🔄 [MVT Refresh] Force refresh requested")
        lastMVTRefreshTime = nil  // 重置节流时间
        refreshMVTSource()
        lastMVTRefreshTime = Date()
    }

    // MARK: - Safe Expression Helpers

    /// Create a safe mapping expression using native nested conditionals
    /// This avoids forbidden functions like MLN_MATCH or MLN_IF (from JSON 'case')
    private func makeMappingExpression(property: String, mapping: [String: String], defaultSprite: String) -> NSExpression {
        var currentExpr = NSExpression(forConstantValue: defaultSprite)
        
        // Build from inside out to maintain priority
        for (key, value) in mapping.sorted(by: { $0.key > $1.key }) {
            let predicate = NSPredicate(format: "%K == %@", property, key)
            currentExpr = NSExpression(
                forConditional: predicate,
                trueExpression: NSExpression(forConstantValue: value),
                falseExpression: currentExpr
            )
        }
        return currentExpr
    }

    // MARK: - Layer Addition

    private func addColorPixelLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-mvt") else {
            Logger.error("❌ MVT source not found for color layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-color", source: source)
        layer.sourceLayerIdentifier = "pixels-color"

        // 为每种颜色生成独立的纯色方块 sprite
        // 从 MVT 数据获取所有可能的颜色值
        let commonColors: [String: String] = [
            "#000000": "color_000000",
            "#FF0000": "color_FF0000",
            "#00FF00": "color_00FF00",
            "#0000FF": "color_0000FF",
            "#FFFF00": "color_FFFF00",
            "#FF00FF": "color_FF00FF",
            "#00FFFF": "color_00FFFF",
            "#FFFFFF": "color_FFFFFF",
            "#808080": "color_808080",
            "#FFA500": "color_FFA500",
            "#800000": "color_800000",
            "#008000": "color_008000",
            "#000080": "color_000080",
            "#800080": "color_800080",
            "#008080": "color_008080",
            "#FFC0CB": "color_FFC0CB",
            "#A52A2A": "color_A52A2A",
            "#4ECDC4": "color_4ECDC4"  // 默认 fallback 颜色
        ]

        // 为每种颜色生成纯色方块 sprite
        for (colorHex, spriteName) in commonColors {
            if !loadedSprites.contains(spriteName) {
                if let colorImage = createColorSquare(colorHex: colorHex) {
                    style.setImage(colorImage, forName: spriteName)
                    loadedSprites.insert(spriteName)
                }
            }
        }

        // 使用安全的安全映射表达式 (避免 match/case)
        layer.iconImageName = makeMappingExpression(
            property: "color",
            mapping: commonColors,
            defaultSprite: "color_4ECDC4"
        )
        Logger.info("✅ Color layer using \(commonColors.count) local color sprites (Safe Expression)")

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: colorScaleStops)
        )

        // 不需要 iconColor，因为 sprite 本身就是纯色的
        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        // 🔧 设置图层的缩放级别范围：只在 zoom >= 12 时显示
        // 由于 mapView.maximumZoomLevel 已限制为 18，图层的有效范围就是 [12, 18]
        layer.minimumZoomLevel = 12

        // 🔧 FIX: 插入到 base label 图层之下（color 是最底层的 pixel 图层）
        if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Color pixel layer added (zoom range: [12,18])")
    }

    /// 添加广告像素层（使用 SDF square + iconColor 动态着色，支持256色调色板）
    private func addAdPixelLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-mvt") else {
            Logger.error("❌ MVT source not found for ad layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-ad", source: source)
        layer.sourceLayerIdentifier = "pixels-ad"

        // 创建 SDF square sprite（用于 iconColor 动态着色）
        let adSpriteName = "ad-sdf-square"
        if !loadedSprites.contains(adSpriteName) {
            if let sdfImage = createSdfTintableSquare() {
                style.setImage(sdfImage, forName: adSpriteName)
                loadedSprites.insert(adSpriteName)
            }
        }

        // 使用固定的 SDF sprite，通过 iconColor 动态设置颜色
        layer.iconImageName = NSExpression(forConstantValue: adSpriteName)
        layer.iconColor = NSExpression(forKeyPath: "color")

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: colorScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.minimumZoomLevel = 12

        // 🔧 FIX: 插入到 pixels-complex 之上（保证 ad 在 complex 上方）
        if let complexLayer = style.layer(withIdentifier: "pixels-complex") {
            style.insertLayer(layer, above: complexLayer)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Ad pixel layer added (SDF + iconColor, zoom range: [12,18])")
    }

    /// 添加 emoji 像素层（使用从 API 加载的 emoji sprites）
    private func addEmojiPixelLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-mvt") else {
            Logger.error("❌ MVT source not found for emoji layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-emoji", source: source)
        layer.sourceLayerIdentifier = "pixels-emoji"

        // 🔍 诊断：检查 sprite 是否加载到 style 中
        Logger.info("🔍 [Emoji Layer Setup] ═══════════════════════════════════════")
        Logger.info("🔍 emojiToSpriteKey 映射数量: \(emojiToSpriteKey.count)")
        Logger.info("🔍 loadedSprites 数量: \(loadedSprites.count)")

        // 检查关键 emoji 的 sprite 是否存在
        let testEmoji = "⚔️"
        if let spriteKey = emojiToSpriteKey[testEmoji] {
            Logger.info("🔍 测试: '\(testEmoji)' -> '\(spriteKey)'")
            Logger.info("🔍 sprite '\(spriteKey)' 在 loadedSprites 中: \(loadedSprites.contains(spriteKey))")

            // 检查 sprite 是否在 style 中
            if style.image(forName: spriteKey) != nil {
                Logger.info("🔍 sprite '\(spriteKey)' 在 style 中: ✅")
            } else {
                Logger.warning("🔍 sprite '\(spriteKey)' 在 style 中: ❌ 不存在!")
            }
        } else {
            Logger.warning("🔍 测试 emoji '\(testEmoji)' 没有对应的 spriteKey!")
        }

        // 检查 sdf-square fallback
        if style.image(forName: SpriteConfig.sdfSquareName) != nil {
            Logger.info("🔍 fallback '\(SpriteConfig.sdfSquareName)' 在 style 中: ✅")
        } else {
            Logger.warning("🔍 fallback '\(SpriteConfig.sdfSquareName)' 在 style 中: ❌ 不存在!")
        }

        // 使用安全映射表达式处理 emoji (避免 match/case)
        if !emojiToSpriteKey.isEmpty {
            layer.iconImageName = makeMappingExpression(
                property: "emoji",
                mapping: emojiToSpriteKey,
                defaultSprite: SpriteConfig.sdfSquareName
            )
        } else {
            // Fallback 映射 building
            var fallbackMap: [String: String] = [:]
            for emoji in fallbackEmojis {
                fallbackMap[emoji] = emoji
            }
            layer.iconImageName = makeMappingExpression(
                property: "emoji",
                mapping: fallbackMap,
                defaultSprite: SpriteConfig.sdfSquareName
            )
        }
        
        Logger.info("✅ Emoji layer using safe conditional expression with \(emojiToSpriteKey.count) sprites")

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: emojiScaleStops)
        )

        // 🔍 调试日志：打印 iconScale 表达式
        /*
        Logger.info("📊 [Emoji Layer] iconScale (3/4 of color): \(layer.iconScale ?? NSExpression(forConstantValue: "nil"))")
        */

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        // 🔧 设置图层的缩放级别范围：只在 zoom >= 12 时显示
        // 由于 mapView.maximumZoomLevel 已限制为 18，图层的有效范围就是 [12, 18]
        layer.minimumZoomLevel = 12

        // 🔧 FIX: 插入到 pixels-color 之上（保证 emoji 在 color 上方）
        if let colorLayer = style.layer(withIdentifier: "pixels-color") {
            style.insertLayer(layer, above: colorLayer)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Emoji pixel layer added (zoom range: [12,18], iconScale: 75% of color)")

        // 🔍 调试日志：添加后验证图层属性
        /* 
        // NOTE: Commented out to avoid "NSPredicate: Use of 'MLN_MATCH' as an NSExpression function is forbidden" error
        if let addedLayer = style.layer(withIdentifier: "pixels-emoji") as? MLNSymbolStyleLayer {
            let addedIconScale = addedLayer.iconScale
            let addedIconImageName = addedLayer.iconImageName
            let addedAllowsOverlap = addedLayer.iconAllowsOverlap
            let addedIgnoresPlacement = addedLayer.iconIgnoresPlacement

            Logger.info("📊 [Emoji Layer] 添加后验证:")
            Logger.info("   - iconScale: \(addedIconScale ?? NSExpression(forConstantValue: "nil"))")
            let iconNameStr = addedIconImageName != nil ? "\(addedIconImageName!)" : "nil"
            Logger.info("   - iconImageName: \(iconNameStr)")
            Logger.info("   - iconAllowsOverlap: \(addedAllowsOverlap ?? NSExpression(forConstantValue: false))")
            Logger.info("   - iconIgnoresPlacement: \(addedIgnoresPlacement ?? NSExpression(forConstantValue: false))")
        }
        */
    }

    /// 添加 complex 像素层（使用 coalesce 表达式）
    private func addComplexPixelLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-mvt") else {
            Logger.error("❌ MVT source not found for complex layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-complex", source: source)
        layer.sourceLayerIdentifier = "pixels-complex"

        // 🔍 诊断：检查 complex pattern sprites 是否加载
        Logger.info("🔍 [Complex Layer Setup] ═══════════════════════════════════════")
        Logger.info("🔍 complexPatternCache 数量: \(complexPatternCache.count)")

        // 检查前几个 complex pattern sprites 是否存在
        for (index, patternKey) in complexPatternCache.prefix(3).enumerated() {
            Logger.info("🔍 测试 [\(index)]: '\(patternKey)' 在 loadedSprites 中: \(loadedSprites.contains(patternKey))")
            if style.image(forName: patternKey) != nil {
                Logger.info("   ✅ sprite '\(patternKey)' 在 style 中存在")
            } else {
                Logger.warning("   ❌ sprite '\(patternKey)' 在 style 中不存在!")
            }
        }

        // 检查 sdf-square fallback
        if style.image(forName: SpriteConfig.sdfSquareName) != nil {
            Logger.info("🔍 fallback '\(SpriteConfig.sdfSquareName)' 在 style 中: ✅")
        } else {
            Logger.warning("🔍 fallback '\(SpriteConfig.sdfSquareName)' 在 style 中: ❌ 不存在!")
        }

        // 使用嵌套的 native conditional 表达式 (避免 coalesce/case/has/MLN_IF/mgl_does:have:)
        let hasPattern = NSPredicate(format: "pattern_id != nil")
        let hasMaterial = NSPredicate(format: "material_id != nil")
        
        let materialExpr = NSExpression(
            forConditional: hasMaterial,
            trueExpression: NSExpression(forKeyPath: "material_id"),
            falseExpression: NSExpression(forConstantValue: SpriteConfig.sdfSquareName)
        )
        
        layer.iconImageName = NSExpression(
            forConditional: hasPattern,
            trueExpression: NSExpression(forKeyPath: "pattern_id"),
            falseExpression: materialExpr
        )

        Logger.info("✅ Complex layer using safe native conditional expression")

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: emojiScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        // 🔧 设置图层的缩放级别范围：只在 zoom >= 12 时显示
        // 由于 mapView.maximumZoomLevel 已限制为 18，图层的有效范围就是 [12, 18]
        layer.minimumZoomLevel = 12

        // 🔧 FIX: 插入到 pixels-emoji 之上（保证 complex 在 emoji 上方）
        if let emojiLayer = style.layer(withIdentifier: "pixels-emoji") {
            style.insertLayer(layer, above: emojiLayer)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Complex pixel layer added (zoom range: [12,18], iconScale: 75% of color)")

        // 🔍 调试日志：添加后验证图层属性
        /*
        if let addedLayer = style.layer(withIdentifier: "pixels-complex") as? MLNSymbolStyleLayer {
            let addedIconScale = addedLayer.iconScale
            let addedIconImageName = addedLayer.iconImageName
            let addedAllowsOverlap = addedLayer.iconAllowsOverlap
            let addedIgnoresPlacement = addedLayer.iconIgnoresPlacement

            Logger.info("📊 [Complex Layer] 添加后验证:")
            Logger.info("   - iconScale: \(addedIconScale ?? NSExpression(forConstantValue: "nil"))")
            let iconNameStr = addedIconImageName != nil ? "\(addedIconImageName!)" : "nil"
            Logger.info("   - iconImageName: \(iconNameStr)")
            Logger.info("   - iconAllowsOverlap: \(addedAllowsOverlap ?? NSExpression(forConstantValue: false))")
            Logger.info("   - iconIgnoresPlacement: \(addedIgnoresPlacement ?? NSExpression(forConstantValue: false))")
        }
        */
    }

    // MARK: - Hotpatch Layers (Real-time Updates)

    /// 添加 hotpatch highlight 图层
    private func addHotpatchHighlightLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else { return }

        let layer = MLNCircleStyleLayer(identifier: "pixels-hotpatch-highlight", source: source)
        
        // 只显示 likeCount > 0 的像素
        layer.predicate = NSPredicate(format: "likeCount > 0")
        
        let radiusStops: [NSNumber: NSNumber] = [
            1: 15,
            10: 25,
            50: 40
        ]
        
        layer.circleRadius = NSExpression(
            forMLNInterpolating: NSExpression(format: "likeCount"),
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: radiusStops)
        )
        
        // Color: Glowing Yellow/Gold
        layer.circleColor = NSExpression(forConstantValue: UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 0.6))
        
        // Blur to make it glow
        layer.circleBlur = NSExpression(forConstantValue: 0.5)
        
        layer.circleOpacity = NSExpression(forConstantValue: 0.8)
        
        // Insert below pixel layers
        if let upperLayer = style.layer(withIdentifier: "pixels-color-hotpatch") {
            style.insertLayer(layer, below: upperLayer)
        } else {
            style.addLayer(layer)
        }
        
        Logger.info("✅ Hotpatch highlight layer added")
    }

    /// 添加 Hotpatch 数据源和图层（用于实时更新）
    /// Hotpatch 图层在 MVT 图层之上，使用 GeoJSON source 存储实时更新的像素
    private func addHotpatchSourceAndLayers(style: MLNStyle) {
        Logger.info("🔥 Setting up hotpatch layers for real-time updates...")

        // 1. 创建 GeoJSON 数据源（初始为空）
        let hotpatchSource = MLNShapeSource(
            identifier: "pixels-hotpatch",
            shape: MLNShapeCollectionFeature(shapes: []),
            options: [:]
        )
        style.addSource(hotpatchSource)
        self.hotpatchSource = hotpatchSource

        // 2. 初始化各类型的像素数组
        hotpatchPixels["color"] = []
        hotpatchPixels["emoji"] = []
        hotpatchPixels["complex"] = []
        hotpatchPixels["ad"] = []

        // 3. 添加 hotpatch color 图层
        addHotpatchColorLayer(style: style)

        // 4. 添加 hotpatch emoji 图层
        addHotpatchEmojiLayer(style: style)

        // 5. 添加 hotpatch complex 图层
        addHotpatchComplexLayer(style: style)

        // 5.5 添加 hotpatch ad 图层
        addHotpatchAdLayer(style: style)

        // 6. 添加 hotpatch Highlight 图层 (Visual Feedback for Popular Pixels)
        addHotpatchHighlightLayer(style: style)
        
        // 7. 添加 hotpatch heatmap 图层 (Hotspot Visualization)
        // addHotpatchHeatmapLayer(style: style) // 已移除以避免与活动冲突

        Logger.info("✅ Hotpatch layers setup complete")
    }

    /// 添加 hotpatch color 图层
    private func addHotpatchColorLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else {
            Logger.error("❌ Hotpatch source not found for color layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-color-hotpatch", source: source)
        
        // 只显示 pixel_type="color" 的像素
        layer.predicate = NSPredicate(format: "pixel_type == 'color' OR pixel_type == 'basic'")

        // 使用与 MVT 图层相同的 color sprite 生成逻辑
        let commonColors: [String: String] = [
            "#000000": "color_000000",
            "#FF0000": "color_FF0000",
            "#00FF00": "color_00FF00",
            "#0000FF": "color_0000FF",
            "#FFFF00": "color_FFFF00",
            "#FF00FF": "color_FF00FF",
            "#00FFFF": "color_00FFFF",
            "#FFFFFF": "color_FFFFFF",
            "#808080": "color_808080",
            "#FFA500": "color_FFA500",
            "#800000": "color_800000",
            "#008000": "color_008000",
            "#000080": "color_000080",
            "#800080": "color_800080",
            "#008080": "color_008080",
            "#FFC0CB": "color_FFC0CB",
            "#A52A2A": "color_A52A2A",
            "#4ECDC4": "color_4ECDC4"  // 默认 fallback 颜色
        ]

        // 使用安全的安全映射表达式 (避免 match/case)
        layer.iconImageName = makeMappingExpression(
            property: "color",
            mapping: commonColors,
            defaultSprite: "color_4ECDC4"
        )

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: colorScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.minimumZoomLevel = 12

        // 🔧 FIX: Force source order for z-index (newer pixels on top)
        layer.symbolZOrder = NSExpression(forConstantValue: "source")

        // 🔧 FIX: 插入到 pixels-ad (MVT) 之上（hotpatch color 是最底层的 hotpatch 图层）
        if let adLayer = style.layer(withIdentifier: "pixels-ad") {
            style.insertLayer(layer, above: adLayer)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Hotpatch color layer added (symbolZOrder=source)")
    }

    /// 添加 hotpatch ad 图层（广告像素实时更新，使用 SDF square + iconColor）
    private func addHotpatchAdLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else {
            Logger.error("❌ Hotpatch source not found for ad layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-ad-hotpatch", source: source)

        // 只显示 pixel_type="ad" 的像素
        layer.predicate = NSPredicate(format: "pixel_type == 'ad'")

        // 确保 SDF sprite 存在（MVT层已创建，此处复用）
        let adSpriteName = "ad-sdf-square"
        if !loadedSprites.contains(adSpriteName) {
            if let sdfImage = createSdfTintableSquare() {
                style.setImage(sdfImage, forName: adSpriteName)
                loadedSprites.insert(adSpriteName)
            }
        }

        layer.iconImageName = NSExpression(forConstantValue: adSpriteName)
        layer.iconColor = NSExpression(forKeyPath: "color")

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: colorScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.minimumZoomLevel = 12

        // 🔧 FIX: Force source order for z-index (newer pixels on top)
        layer.symbolZOrder = NSExpression(forConstantValue: "source")

        // 🔧 FIX: 插入到 pixels-complex-hotpatch 之上
        if let complexHotpatch = style.layer(withIdentifier: "pixels-complex-hotpatch") {
            style.insertLayer(layer, above: complexHotpatch)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Hotpatch ad layer added (symbolZOrder=source)")
    }

    /// 添加 hotpatch emoji 图层
    private func addHotpatchEmojiLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else {
            Logger.error("❌ Hotpatch source not found for emoji layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-emoji-hotpatch", source: source)

        // 只显示 pixel_type="emoji" 的像素
        layer.predicate = NSPredicate(format: "pixel_type == 'emoji'")

        // 使用安全映射表达式 (避免 match/case)
        if !emojiToSpriteKey.isEmpty {
            layer.iconImageName = makeMappingExpression(
                property: "emoji",
                mapping: emojiToSpriteKey,
                defaultSprite: SpriteConfig.sdfSquareName
            )
        } else {
            var fallbackMap: [String: String] = [:]
            for emoji in fallbackEmojis {
                fallbackMap[emoji] = emoji
            }
            layer.iconImageName = makeMappingExpression(
                property: "emoji",
                mapping: fallbackMap,
                defaultSprite: SpriteConfig.sdfSquareName
            )
        }

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: emojiScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.minimumZoomLevel = 12

        // 🔧 FIX: Force source order for z-index (newer pixels on top)
        layer.symbolZOrder = NSExpression(forConstantValue: "source")

        // 🔧 FIX: 插入到 pixels-color-hotpatch 之上
        if let colorHotpatch = style.layer(withIdentifier: "pixels-color-hotpatch") {
            style.insertLayer(layer, above: colorHotpatch)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Hotpatch emoji layer added (symbolZOrder=source)")
    }

    /// 添加 hotpatch complex 图层
    private func addHotpatchComplexLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else {
            Logger.error("❌ Hotpatch source not found for complex layer")
            return
        }

        let layer = MLNSymbolStyleLayer(identifier: "pixels-complex-hotpatch", source: source)

        // 只显示 pixel_type="complex" 的像素
        layer.predicate = NSPredicate(format: "pixel_type == 'complex'")

        // 使用安全映射 (nested internals)
        let hasPattern = NSPredicate(format: "pattern_id != nil")
        let hasMaterial = NSPredicate(format: "material_id != nil")
        
        let materialExpr = NSExpression(
            forConditional: hasMaterial,
            trueExpression: NSExpression(forKeyPath: "material_id"),
            falseExpression: NSExpression(forConstantValue: SpriteConfig.sdfSquareName)
        )
        
        layer.iconImageName = NSExpression(
            forConditional: hasPattern,
            trueExpression: NSExpression(forKeyPath: "pattern_id"),
            falseExpression: materialExpr
        )

        layer.iconScale = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .exponential,
            parameters: NSExpression(forConstantValue: 2),
            stops: NSExpression(forConstantValue: emojiScaleStops)
        )

        layer.iconAllowsOverlap = NSExpression(forConstantValue: true)
        layer.iconIgnoresPlacement = NSExpression(forConstantValue: true)
        layer.minimumZoomLevel = 12

        // 🔧 FIX: Force source order for z-index (newer pixels on top)
        // symbolZOrder 控制符号的绘制顺序：.source 表示按照 GeoJSON source 中的顺序绘制（后面的在上面）
        layer.symbolZOrder = NSExpression(forConstantValue: "source")

        // 🔧 FIX: 插入到 pixels-emoji-hotpatch 之上
        if let emojiHotpatch = style.layer(withIdentifier: "pixels-emoji-hotpatch") {
            style.insertLayer(layer, above: emojiHotpatch)
        } else if let labelLayer = findLabelLayer(style: style) {
            style.insertLayer(layer, below: labelLayer)
        } else {
            style.addLayer(layer)
        }

        Logger.info("✅ Hotpatch complex layer added (symbolZOrder=source)")
    }

    /// 添加 hotpatch heatmap 图层
    private func addHotpatchHeatmapLayer(style: MLNStyle) {
        guard let source = style.source(withIdentifier: "pixels-hotpatch") else { return }
        
        let layer = MLNHeatmapStyleLayer(identifier: "pixels-hotpatch-heatmap", source: source)
        
        let intensityStops: [NSNumber: NSNumber] = [
            0: 1,
            9: 3
        ]
        layer.heatmapIntensity = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: intensityStops)
        )
        
        let colorStops: [NSNumber: UIColor] = [
            0.0: UIColor(red: 33/255, green: 102/255, blue: 172/255, alpha: 0.0),
            0.2: UIColor(red: 103/255, green: 169/255, blue: 207/255, alpha: 1.0),
            0.4: UIColor(red: 209/255, green: 229/255, blue: 240/255, alpha: 1.0),
            0.6: UIColor(red: 253/255, green: 219/255, blue: 199/255, alpha: 1.0),
            0.8: UIColor(red: 239/255, green: 138/255, blue: 98/255, alpha: 1.0),
            1.0: UIColor(red: 178/255, green: 24/255, blue: 43/255, alpha: 1.0)
        ]
        
        layer.heatmapColor = NSExpression(
            forMLNInterpolating: .heatmapDensityVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: colorStops)
        )
        
        let radiusStops: [NSNumber: NSNumber] = [
            0: 2,
            9: 20
        ]
        layer.heatmapRadius = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: radiusStops)
        )
        
        let opacityStops: [NSNumber: NSNumber] = [
            7: 1,
            12: 0
        ]
        layer.heatmapOpacity = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: opacityStops)
        )
        
        // Insert below pixel layers (e.g. below pixels-color-hotpatch)
        if let upperLayer = style.layer(withIdentifier: "pixels-color-hotpatch") {
            style.insertLayer(layer, below: upperLayer)
        } else {
             style.addLayer(layer)
        }
        
        Logger.info("✅ Hotpatch heatmap layer added")
    }

    /// 规范化 hotpatch 像素类型（将 bomb/alliance 等映射到 color/emoji/complex/ad）
    private func normalizeHotpatchTypeAndEmoji(for pixel: Pixel, initialType: String) -> (type: String, emoji: String?) {
        var type = initialType
        var emoji = pixel.emoji

        // Basic mappings
        if type == "normal" || type == "basic" {
            type = "color"
        } else if type == "advertisement" {
            type = "ad"
        }

        let supportedTypes: Set<String> = ["color", "emoji", "complex", "ad"]
        if supportedTypes.contains(type) {
            return (type, emoji)
        }

        // Prefer renderType if available (from socket payload)
        if let renderType = pixel.renderType, !renderType.isEmpty {
            if renderType == "emoji" {
                type = "emoji"
                if (emoji == nil || emoji?.isEmpty == true),
                   let patternId = pixel.patternId {
                    emoji = spriteKeyToUnicode[patternId]
                }
            } else if renderType == "complex" {
                type = "complex"
            } else if renderType == "color" {
                type = "color"
            }
            return (type, emoji)
        }

        // Infer from sprite metadata (bomb/alliance/event/etc.)
        if let patternId = pixel.patternId, let renderType = spriteKeyToRenderType[patternId] {
            switch renderType {
            case "emoji":
                type = "emoji"
                if emoji == nil || emoji?.isEmpty == true {
                    emoji = spriteKeyToUnicode[patternId]
                }
            case "complex":
                type = "complex"
            default:
                type = "color"
            }
            return (type, emoji)
        }

        // Fallbacks: if emoji is provided, render as emoji; otherwise default to color
        if let value = emoji, !value.isEmpty {
            type = "emoji"
        } else {
            type = "color"
        }

        return (type, emoji)
    }
    
    /// 设置 WebSocket 实时更新
    private func setupHotpatchWebSocket() {
        Logger.info("🔌 Setting up WebSocket for real-time pixel updates...")

        // 连接 WebSocket (SocketIOManager 负责连接管理，这里不需要直接调用 connect，
        // 只需要确保在 App 启动或登录时 SocketIOManager 已连接)
        // SocketIOManager.shared.connect(...) should be called elsewhere (e.g. AuthManager)

        // 注册像素更新处理器 (适配 SocketIOManager)
        Task {
            let publisher = await SocketIOManager.shared.pixelChangesPublisher
            
            publisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] pixels in
                    for pixel in pixels {
                        guard let self else { continue }
                        let rawType = pixel.type ?? "color"
                        let resolved = self.normalizeHotpatchTypeAndEmoji(for: pixel, initialType: rawType)
                        
                        let update = PixelUpdate(
                            id: pixel.id,
                            type: resolved.type,
                            lat: pixel.latitude,
                            lng: pixel.longitude,
                            color: pixel.color,
                            emoji: resolved.emoji,
                            patternId: pixel.patternId,
                            materialId: pixel.materialId,
                            imageUrl: pixel.imageUrl, // ✅ 修复: 使用 Pixel 模型的 imageUrl 字段
                            payload: pixel.payload,
                            likeCount: pixel.likeCount,
                            updatedAt: pixel.updatedAt.ISO8601Format()
                        )
                        
                        Task { @MainActor in
                            await self.handlePixelUpdate(update)
                        }
                    }
                }
                .store(in: &cancellables)
        }

        // 注册瓦片失效处理器
        Task {
            let invalidatePublisher = await SocketIOManager.shared.tileInvalidatePublisher

            invalidatePublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] event in
                    guard let self else { return }
                    Logger.info("🔄 收到瓦片失效: gridId=\(event.gridId), tiles=\(event.tileIds.count)")
                    Task { @MainActor in
                        await self.handleTileInvalidate(gridId: event.gridId, tileIds: event.tileIds, reason: event.reason)
                    }
                }
                .store(in: &cancellables)
        }

        Logger.info("✅ WebSocket setup complete (SocketIO), listening for pixel updates")
    }

    /// 处理瓦片失效事件
    private func handleTileInvalidate(gridId: String, tileIds: [String], reason: String) async {
        Logger.info("🔄 处理瓦片失效: gridId=\(gridId), reason=\(reason)")

        // MapLibre会自动处理MVT瓦片的刷新
        // 这里主要用于日志和潜在的优化
        // 当绘制新像素后，后端发送tileInvalidate通知，
        // MapLibre会在下次请求这些瓦片时自动获取最新数据

        // 如果需要强制刷新当前可见的瓦片，可以在这里添加逻辑
        // 例如：移除并重新添加MVT source，但这可能影响性能

        // 暂时只记录事件，依赖MapLibre的自动缓存管理
    }

    /// 处理像素更新（带自适应批处理）
    private func handlePixelUpdate(_ pixelUpdate: PixelUpdate) async {
        // 将更新添加到待处理队列
        pendingUpdates.append(pixelUpdate)

        // 自适应调整批处理参数
        // 如果积压过多，增大量级以提高吞吐量，但稍微增加间隔以减少主线程切换频率
        if pendingUpdates.count > 500 {
            currentMaxBatchSize = 500
            currentBatchInterval = 100 // ms
        } else {
            currentMaxBatchSize = 200
            currentBatchInterval = 50 // ms
        }

        // 如果未调度，且达到了立即处理的阈值，或者即使没达到也可以启动定时器
        if batchTimer == nil {
            if pendingUpdates.count >= currentMaxBatchSize {
                 // 立即触发
                 processBatchedUpdates()
            } else {
                // 启动定时器
                batchTimer = Timer.scheduledTimer(withTimeInterval: currentBatchInterval / 1000.0, repeats: false) { [weak self] _ in
                    guard let self else { return }
                    Task { @MainActor in
                        self.processBatchedUpdates()
                    }
                }
            }
        }
    }

    /// 处理批量的像素更新（异步后台处理）
    private func processBatchedUpdates() {
        // 清理定时器
        batchTimer?.invalidate()
        batchTimer = nil

        guard !pendingUpdates.isEmpty else { return }

        // 1. 获取当前批次快照
        let updatesSnapshot = pendingUpdates
        pendingUpdates = []

        // 2. 在后台队列处理数据（转换 Feature）
        processingQueue.async { [weak self] in
            guard let self else { return }

            // 在后台执行耗时的 Feature 创建
            // 注意：这里不能访问 self.hotpatchPixels，因为它是 @MainActor
            // 我们只做转换工作

            var newFeaturesByType: [String: [MLNPointFeature]] = [:]

            // 🔧 方案2: 收集需要加载的 sprite（避免在主线程阻塞）
            var spritesToLoad: [(id: String, imageUrl: String?, payload: String?)] = []

            for update in updatesSnapshot {
                let feature = self.createFeatureSafe(from: update)
                let type = update.type

                if newFeaturesByType[type] == nil {
                    newFeaturesByType[type] = []
                }
                newFeaturesByType[type]?.append(feature)

                // 🔧 检查 complex 类型是否需要加载 sprite
                if type == "complex" {
                    let patternId = update.patternId ?? update.id
                    // 在后台线程无法访问 MainActor 的 loadedSprites
                    // 将信息收集到数组，稍后在主线程检查和加载
                    spritesToLoad.append((
                        id: patternId,
                        imageUrl: update.imageUrl,
                        payload: update.payload
                    ))
                }
            }

            let finalFeatures = newFeaturesByType

            // 3. 回到主线程更新状态和加载 sprite
            Task { @MainActor in
                // 🔧 先加载缺失的 sprite，再应用批量更新
                for spriteInfo in spritesToLoad {
                    if !self.loadedSprites.contains(spriteInfo.id) {
                        Logger.info("🔧 [WebSocket Sync] Loading missing sprite: \(spriteInfo.id)")

                        if let imageUrl = spriteInfo.imageUrl {
                            await self.registerComplexSpriteFromURL(
                                id: spriteInfo.id,
                                urlString: imageUrl
                            )
                        } else if let payload = spriteInfo.payload {
                            await self.registerComplexSprite(
                                id: spriteInfo.id,
                                payload: payload
                            )
                        } else {
                            Logger.warning("⚠️ [WebSocket Sync] Sprite \(spriteInfo.id) has no imageUrl or payload, cannot load")
                        }
                    }
                }

                // 应用批量更新
                self.applyBatchedUpdates(finalFeatures, count: updatesSnapshot.count)
            }
        }
    }
    
    /// 应用后台处理好的更新（MainActor）
    private func applyBatchedUpdates(_ newFeaturesByType: [String: [MLNPointFeature]], count: Int) {
        Logger.info("🔥 Applied \(count) pixel updates (async batch)")

        // Unique IDs across all types in this batch
        let allNewIds = Set(newFeaturesByType.values.flatMap { $0 }.compactMap { $0.attributes["grid_id"] as? String })

        // CRITICAL FIX: Ensure these IDs are removed from ALL type buckets to prevent old pixel types
        // (e.g. emoji) from lingering on top of new ones (e.g. color).
        for bucketType in hotpatchPixels.keys {
            if let existing = hotpatchPixels[bucketType] {
                hotpatchPixels[bucketType] = existing.filter { feature in
                    guard let gridId = feature.attributes["grid_id"] as? String else { return true }
                    return !allNewIds.contains(gridId)
                }
            }
        }

        // Now append the hits
        for (type, newFeatures) in newFeaturesByType {
            if hotpatchPixels[type] == nil {
                hotpatchPixels[type] = []
            }
            hotpatchPixels[type]?.append(contentsOf: newFeatures)
        }

        // 更新 GeoJSON source
        updateHotpatchSource()

        // 定期清理
        cleanupExpiredHotpatchPixels()

        // 🔧 刷新 MVT 瓦片以清除缓存（带节流）
        refreshMVTSourceIfNeeded()
    }

    /// 从 hotpatch 中移除指定 grid_id 的像素（用于去重）
    private func removePixelFromHotpatch(gridId: String) {
        for (type, features) in hotpatchPixels {
            hotpatchPixels[type] = features.filter { feature in
                if let featureGridId = feature.attributes["grid_id"] as? String {
                    return featureGridId != gridId
                }
                return true
            }
        }
    }

    /// 清理过期的 hotpatch 像素
    /// 当 MVT 瓦片刷新后，hotpatch 像素应该被移除以避免重复显示
    private func cleanupExpiredHotpatchPixels() {
        // 简单策略：如果 hotpatch 像素总数超过阈值，移除最旧的
        let totalPixels = hotpatchPixels.values.reduce(0) { $0 + $1.count }
        let maxHotpatchPixels = 800  // 最大保留的 hotpatch 像素数（降低以支持长时间运行）

        if totalPixels > maxHotpatchPixels {
            let excess = totalPixels - maxHotpatchPixels

            // 从每个类型中移除最旧的像素（FIFO）
            for type in hotpatchPixels.keys {
                if let features = hotpatchPixels[type], !features.isEmpty {
                    let removeCount = min(excess, features.count / 2)  // 最多移除该类型的 50%
                    if removeCount > 0 {
                        hotpatchPixels[type] = Array(features.dropFirst(removeCount))
                    }
                }
            }

            Logger.info("🧹 Cleaned up \(excess) expired hotpatch pixels (total: \(totalPixels) -> \(maxHotpatchPixels))")
            updateHotpatchSource()
        }
    }

    /// 手动清空所有 hotpatch 像素（例如在 MVT 瓦片完全刷新后）
    public func clearAllHotpatchPixels() {
        hotpatchPixels.removeAll()
        hotpatchPixels["color"] = []
        hotpatchPixels["emoji"] = []
        hotpatchPixels["complex"] = []

        if let source = hotpatchSource {
            source.shape = nil
        }

        Logger.info("🧹 All hotpatch pixels cleared")
    }

    /// 从 PixelUpdate 创建 MLNPointFeature (线程安全，可在后台调用)
    nonisolated private func createFeatureSafe(from update: PixelUpdate) -> MLNPointFeature {
        let feature = MLNPointFeature()
        feature.coordinate = CLLocationCoordinate2D(latitude: update.lat, longitude: update.lng)

        // 设置属性（使用现有的 PixelUpdate 结构）
        var attributes: [String: Any] = [
            "grid_id": update.id,
            "pixel_type": update.type,
            "lat": update.lat,
            "lng": update.lng
        ]

        if let color = update.color {
            attributes["color"] = color
        }
        if let emoji = update.emoji {
            attributes["emoji"] = emoji
        }
        if let imageUrl = update.imageUrl {
            attributes["imageUrl"] = imageUrl
        }
        if let patternId = update.patternId { attributes["pattern_id"] = patternId }
        if let materialId = update.materialId { attributes["material_id"] = materialId }
        
        Logger.info("✨ [Renderer] createFeatureSafe: Final attributes for \(update.id): \(attributes)")
        
        // The feature object is already created, just assign attributes
        feature.attributes = attributes
        
        return feature
    }

    /// 更新 hotpatch GeoJSON source
    private func updateHotpatchSource() {
        var sourceToUse = hotpatchSource
        
        // Fail-safe: Try to restore hotpatchSource reference from style if nil
        if sourceToUse == nil, let style = style {
            if let restoredSource = style.source(withIdentifier: "pixels-hotpatch") as? MLNShapeSource {
                Logger.info("🔥 Hotpatch: Restored disconnected hotpatchSource reference from style")
                sourceToUse = restoredSource
                // Attempt to update the weak property for future calls, though it may not persist
                hotpatchSource = restoredSource
            } else {
                Logger.error("🔥 Hotpatch: 'pixels-hotpatch' source not found in style!")
            }
        }

        guard let source = sourceToUse else {
            Logger.error("🔥 Hotpatch: hotpatchSource is nil and could not be restored. Skipping update.")
            return 
        }

        // 合并所有类型的像素
        var allFeatures: [MLNPointFeature] = []
        for features in hotpatchPixels.values {
            allFeatures.append(contentsOf: features)
        }

        // 更新 source shape (使用 MLNShapeCollectionFeature)
        let shape = MLNShapeCollectionFeature(shapes: allFeatures)
        source.shape = shape

        Logger.info("🔥 Hotpatch source updated: \(allFeatures.count) total pixels")
    }

    // MARK: - Dynamic Sprite Loading

    private func setupDynamicSpriteLoading(style: MLNStyle) {
        // MapLibre Native 不支持 styleimagemissing
        // 替代方案：从 SpriteService 定期检查并预加载 complex patterns

        Task {
            await preloadComplexPatterns(style: style)
        }
    }

    /// 预加载 complex patterns
    private func preloadComplexPatterns(style: MLNStyle) async {
        Logger.info("🎨 Pre-loading complex patterns...")

        // Complex patterns 已经由 SpriteService.loadSpritesFromAPI 加载
        // 这里只需要确保它们被预加载到 style 中
        await spriteService.preloadSpritesIntoStyle(style)
    }

    /// 扫描当前可视区域的 MVT complex 像素，动态加载缺失的 sprite（如用户头像）
    /// 应在 `regionDidChangeAnimated` 中调用（已内置节流）
    private var lastMissingSpritesScanTime: Date = .distantPast
    public func scanAndLoadMissingComplexSprites() {
        // 节流：最多 3 秒扫描一次
        let now = Date()
        guard now.timeIntervalSince(lastMissingSpritesScanTime) > 3.0 else {
            Logger.debug("🔍 [MVT Scan] Skipped (throttled, last scan \(now.timeIntervalSince(lastMissingSpritesScanTime))s ago)")
            return
        }
        lastMissingSpritesScanTime = now

        guard let mapView = mapView, style != nil else {
            Logger.warning("⚠️ [MVT Scan] Cannot scan: mapView or style is nil")
            return
        }

        let zoom = mapView.zoomLevel
        let center = mapView.centerCoordinate
        Logger.info("🔍 [MVT Scan] Starting scan at zoom=\(zoom), center=(\(center.latitude), \(center.longitude))")

        // 🔧 FIX: 扫描 MVT 层和 hotpatch 层，确保两者的 sprites 都被加载
        let complexFeatures = mapView.visibleFeatures(
            in: mapView.bounds,
            styleLayerIdentifiers: ["pixels-complex", "pixels-complex-hotpatch"]
        )

        Logger.debug("🔍 [MVT Scan] Found \(complexFeatures.count) complex features in viewport")

        guard !complexFeatures.isEmpty else { return }

        // 收集缺失 sprite 的 (patternId, imageUrl, gridId) 对
        var missingSprites: [(patternId: String, imageUrl: String, gridId: String?)] = []
        var skippedCount = 0

        for feature in complexFeatures {
            let gridId = feature.attribute(forKey: "grid_id") as? String

            // 🔧 FIX: 优化检查逻辑，优先使用 pattern_id，如果没有则使用 grid_id
            let patternId = (feature.attribute(forKey: "pattern_id") as? String) ?? gridId

            guard let patternId = patternId else {
                skippedCount += 1
                Logger.warning("⚠️ [MVT Scan] Skipped feature with no pattern_id or grid_id")
                continue
            }

            // 如果 sprite 已加载，跳过
            guard !loadedSprites.contains(patternId) else {
                continue
            }

            // 获取 imageUrl（user_avatar_* 始终使用 sprite 端点，其他从 feature 属性获取）
            var imageUrl: String
            if patternId.hasPrefix("user_avatar_") {
                // User avatars: always use sprite endpoint (renders from pixel data, not broken PNG files)
                let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                imageUrl = "\(baseUrl)/sprites/icon/1/complex/\(patternId).png"
            } else {
                imageUrl = feature.attribute(forKey: "imageUrl") as? String ?? feature.attribute(forKey: "image_url") as? String ?? ""
            }
            guard !imageUrl.isEmpty else {
                skippedCount += 1
                Logger.warning("⚠️ [MVT Scan] Skipped pattern '\(patternId)' with no imageUrl, gridId=\(gridId ?? "nil")")
                continue
            }

            // 去重
            if !missingSprites.contains(where: { $0.patternId == patternId }) {
                missingSprites.append((patternId: patternId, imageUrl: imageUrl, gridId: gridId))
                Logger.debug("🔍 [MVT Scan] Found missing sprite: patternId=\(patternId), imageUrl=\(imageUrl), gridId=\(gridId ?? "nil")")
            }
        }

        if skippedCount > 0 {
            Logger.info("🔍 [MVT Scan] Skipped \(skippedCount) features (no pattern_id/imageUrl)")
        }

        guard !missingSprites.isEmpty else {
            Logger.debug("🔍 [MVT Scan] No missing sprites found")
            return
        }

        Logger.info("🔍 [MVT Scan] Found \(missingSprites.count) missing complex sprites in viewport, loading...")

        Task {
            var successCount = 0
            var failureCount = 0

            for sprite in missingSprites {
                Logger.info("🎨 [MVT Scan] [\(successCount + failureCount + 1)/\(missingSprites.count)] Loading sprite: \(sprite.patternId)")
                Logger.info("    imageUrl: \(sprite.imageUrl)")
                Logger.info("    gridId: \(sprite.gridId ?? "nil")")

                await registerComplexSpriteFromURL(id: sprite.patternId, urlString: sprite.imageUrl)

                // Check if loading succeeded
                if self.loadedSprites.contains(sprite.patternId) {
                    successCount += 1
                    Logger.info("    ✅ SUCCESS")
                } else {
                    failureCount += 1
                    Logger.error("    ❌ FAILED")
                }
            }

            // 刷新 style 使新 sprite 立即可见
            if let currentShape = self.hotpatchSource?.shape {
                self.hotpatchSource?.shape = currentShape
                Logger.info("🔄 [MVT Scan] Refreshed hotpatch source")
            }

            Logger.info("✅ [MVT Scan] Dynamic sprite loading complete: \(successCount) succeeded, \(failureCount) failed")

            // Force MapLibre to re-render
            await MainActor.run {
                if let style = self.style {
                    // Trigger re-render by updating layer visibility (toggle twice)
                    if let layer = style.layer(withIdentifier: "pixels-complex") as? MLNSymbolStyleLayer {
                        layer.isVisible = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            layer.isVisible = true
                            Logger.info("🔄 [MVT Scan] Forced layer re-render")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helper Methods

    /// 查找 base style 中的第一个 label 图层（排除我们自己添加的 pixel 图层）
    /// 用于确定 pixel 图层的插入位置（所有 pixel 图层应在 base label 之下）
    private func findLabelLayer(style: MLNStyle) -> MLNStyleLayer? {
        return style.layers.first { layer in
            layer is MLNSymbolStyleLayer && !layer.identifier.hasPrefix("pixels-")
        }
    }

    // MARK: - Performance Monitoring

    public func logPerformanceMetrics() {
        Logger.info("📊 Performance Metrics:")
        Logger.info("  - Emoji sprite generation: \(String(format: "%.2f", performanceMetrics.emojiSpriteGenerationTime))s")
        Logger.info("  - Total emoji sprites: \(loadedEmojiCount)")
        Logger.info("  - Dynamic emojis: \(dynamicEmojis.count)")
        Logger.info("  - Complex patterns: \(complexPatternCache.count)")
    }

    // MARK: - Debug Logging

    /// 🔍 打印当前视口内所有图层的详细状态（供调试使用）
    public func logDetailedLayerStatus() {
        guard let mapView = mapView, let style = mapView.style else {
            Logger.warning("🔍 [MVT Debug] mapView or style is nil")
            return
        }

        let zoom = mapView.zoomLevel
        Logger.info("🔍 [MVT Debug] ═══════════════════════════════════════════════════")
        Logger.info("🔍 [MVT Debug] 当前 Zoom: \(String(format: "%.2f", zoom))")

        // 检查所有像素图层
        let layerIds = ["pixels-color", "pixels-emoji", "pixels-complex"]
        for layerId in layerIds {
            if let layer = style.layer(withIdentifier: layerId) as? MLNSymbolStyleLayer {
                Logger.info("🔍 [\(layerId)] 存在: ✅")
                Logger.info("   - isVisible: \(layer.isVisible)")
                Logger.info("   - sourceLayerIdentifier: \(layer.sourceLayerIdentifier ?? "nil")")

                // iconScale
                if let iconScale = layer.iconScale {
                    Logger.info("   - iconScale: \(iconScale)")
                }

                // 查询该图层的可见features数量
                let features = mapView.visibleFeatures(in: mapView.bounds, styleLayerIdentifiers: [layerId])
                Logger.info("   - 可见features数量: \(features.count)")
            } else {
                Logger.warning("🔍 [\(layerId)] 存在: ❌ 未找到")
            }
        }

        // MVT source 状态
        if let source = style.source(withIdentifier: "pixels-mvt") as? MLNVectorTileSource {
            Logger.info("🔍 [MVT Source]")
            Logger.info("   - identifier: \(source.identifier)")
            Logger.info("   - 配置的zoomLevel范围: 12-18")
        } else {
            Logger.warning("🔍 [MVT Source] ❌ 未找到")
        }

        Logger.info("🔍 [MVT Debug] ═══════════════════════════════════════════════════")
    }

    /// 🔍 查询指定图层在当前视口内的feature统计
    public func queryVisibleFeatureStats() -> (color: Int, emoji: Int, complex: Int, total: Int) {
        guard let mapView = mapView else { return (0, 0, 0, 0) }

        let colorCount = mapView.visibleFeatures(in: mapView.bounds, styleLayerIdentifiers: ["pixels-color"]).count
        let emojiCount = mapView.visibleFeatures(in: mapView.bounds, styleLayerIdentifiers: ["pixels-emoji"]).count
        let complexCount = mapView.visibleFeatures(in: mapView.bounds, styleLayerIdentifiers: ["pixels-complex"]).count

        return (colorCount, emojiCount, complexCount, colorCount + emojiCount + complexCount)
    }

    /// 🔍 获取emoji图层的iconScale配置（与complex图层一致）
    public func getEmojiIconScaleStops() -> [Double: Double] {
        return [
            12: 0.0117,   // 0.0156 * 0.75 (75% of color)
            13: 0.0234,   // 0.03125 * 0.75
            14: 0.0469,   // 0.0625 * 0.75
            15: 0.09375,  // 0.125 * 0.75
            16: 0.1875,   // 0.25 * 0.75
            17: 0.375,    // 0.5 * 0.75
            18: 0.5625    // 0.75 * 0.75
        ]
    }

    // MARK: - Pixel Query

    /// Query pixel features at a point
    /// Returns array of features
    public func queryPixels(at point: CGPoint) -> [MLNFeature] {
        guard let mapView = mapView else { return [] }

        let layerIds: Set<String> = ["pixels-color", "pixels-emoji", "pixels-complex"]
        // visibleFeatures returns [MLNFeature] (which are MVT features conforming to it)
        return mapView.visibleFeatures(at: point, styleLayerIdentifiers: layerIds)
    }

    /// Query single pixel at coordinate
    public func queryPixel(at coordinate: CLLocationCoordinate2D) -> MLNFeature? {
        guard let mapView = mapView else { return nil }
        let point = mapView.convert(coordinate, toPointTo: mapView)
        return queryPixels(at: point).first
    }

    // MARK: - Tile Pre-fetching (Sensory Performance)

    /// 预取指定区域周围的瓦片
    public func prefetchTilesAround(coordinate: CLLocationCoordinate2D, radius: Int = 1) {
        guard let mapView = mapView else { return }
        
        isPrefetching = true
        Logger.info("⚡ [Performance] Pre-fetching tiles around \(coordinate.latitude), \(coordinate.longitude)")
        
        // 发送“正在优化数据”通知（用于 UI 展示感官性能提升）
        NotificationCenter.default.post(name: NSNotification.Name("mapPerformanceOptimizing"), object: true)
        
        // 根据当前缩放级别计算目标瓦片 z/x/y
        let zoom = Int(floor(mapView.zoomLevel))
        let n = pow(2.0, Double(zoom))
        let x = Int(floor((coordinate.longitude + 180.0) / 360.0 * n))
        let latRad = coordinate.latitude * .pi / 180.0
        let y = Int(floor((1.0 - log(tan(latRad) + 1.0 / cos(latRad)) / .pi) / 2.0 * n))
        
        Logger.info("⚡ [Performance] Targeted tile: z=\(zoom), x=\(x), y=\(y)")
        
        // 模拟后台预取逻辑
        DispatchQueue.global(qos: .background).async { [weak self] in
            // 这里可以添加更重的预取逻辑，如提前订阅 SocketIO
            // 延时 2s 模拟加载过程
            Thread.sleep(forTimeInterval: 2.0)
            
            DispatchQueue.main.async {
                self?.isPrefetching = false
                NotificationCenter.default.post(name: NSNotification.Name("mapPerformanceOptimizing"), object: false)
                Logger.info("✅ [Performance] Pre-fetch complete")
            }
        }
    }

    // MARK: - Low Power Mode

    /// 设置降级渲染模式（低功耗模式）
    private func setReducedRenderingMode(_ enabled: Bool) async {
        guard isReducedRendering != enabled else {
            Logger.info("🔋 Already in \(enabled ? "reduced" : "normal") rendering mode")
            return
        }

        isReducedRendering = enabled

        guard let style = style else {
            Logger.warning("🔋 Cannot change rendering mode: style is nil")
            return
        }

        if enabled {
            // 进入低功耗模式 - 激进优化
            Logger.info("🔋 Entering reduced rendering mode (low-power)")

            // 1. 隐藏地图底图图层（只保留绘制预览层）
            // 隐藏标签、POI、建筑等装饰性图层
            for layer in style.layers {
                let layerId = layer.identifier
                if layerId.contains("label") ||
                   layerId.contains("poi") ||
                   layerId.contains("building") ||
                   layerId.contains("place") ||
                   layerId.contains("road-label") ||
                   layerId.contains("waterway-label") {
                    layer.isVisible = false
                }
            }

            // 2. 增加批处理间隔（从50ms增加到300ms）
            originalBatchInterval = currentBatchInterval
            currentBatchInterval = 300

            // 3. 清除现有定时器（按需创建，不持续运行）
            batchTimer?.invalidate()
            batchTimer = nil

            Logger.info("🔋 Reduced rendering enabled: batch interval \(originalBatchInterval)ms → \(currentBatchInterval)ms")

        } else {
            // 退出低功耗模式 - 恢复正常渲染
            Logger.info("🔋 Exiting reduced rendering mode")

            // 1. 恢复所有图层可见性
            for layer in style.layers {
                let layerId = layer.identifier
                if layerId.contains("label") ||
                   layerId.contains("poi") ||
                   layerId.contains("building") ||
                   layerId.contains("place") ||
                   layerId.contains("road-label") ||
                   layerId.contains("waterway-label") {
                    layer.isVisible = true
                }
            }

            // 2. 恢复批处理间隔
            currentBatchInterval = originalBatchInterval

            // 3. 清除现有定时器（按需创建，不持续运行）
            batchTimer?.invalidate()
            batchTimer = nil

            Logger.info("🔋 Normal rendering restored: batch interval \(currentBatchInterval)ms")
        }
    }
}

// MARK: - Performance Metrics

private struct PerformanceMetrics {
    var emojiSpriteGenerationTime: TimeInterval = 0
    var complexPatternLoadTime: TimeInterval = 0
    var mvttTilesLoaded: Int = 0
}
