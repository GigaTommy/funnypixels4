import SwiftUI
import CoreLocation

/// 迷雾地图风格GPS绘制控制面板 (Redesigned V3: Command Dock)
/// 替代底部菜单栏的总控台，提供全面的驾驶舱体验
struct FogMapGPSDrawingControl: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    @ObservedObject var patternProvider = AllianceDrawingPatternProvider.shared
    @ObservedObject var drawingState = DrawingStateManager.shared
    @ObservedObject var gpsService = GPSDrawingService.shared
    @ObservedObject var pixelService = PixelDrawService.shared

    // 获取用户信息和统计数据
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var profileViewModel = ProfileViewModel()
    
    // 动画状态
    @State private var isPulsing = false
    @State private var pixelCountScale: CGFloat = 1.0
    
    var body: some View {
        HStack(spacing: 12) {
            // MARK: Section A - Identity (The Pilot)
            // 驾驶员身份区
            ZStack(alignment: .bottomTrailing) {
                // 呼吸光环
                if gpsService.isDrawing {
                    Circle()
                        .stroke(Color.green.opacity(0.5), lineWidth: 2)
                        .scaleEffect(isPulsing ? 1.3 : 1.0)
                        .opacity(isPulsing ? 0 : 1)
                        .frame(width: 44, height: 44)
                        .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: isPulsing)
                        .onAppear { isPulsing = true }
                }

                // 用户头像
                if let user = authViewModel.currentUser {
                    AvatarView(
                        avatarUrl: user.avatarUrl,
                        avatar: user.avatar,
                        displayName: user.displayOrUsername,
                        flagPatternId: user.alliance?.flagPatternId,
                        size: 36
                    )
                    .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
                    .shadow(color: .black.opacity(0.3), radius: 3)
                }

                // 联盟旗帜 (Hot Swapping Disabled - Static Display)
                // 用户反馈：取消绘制中点击切换，改为开始前长按配置
                allianceFlagIcon
                    .offset(x: 2, y: 2)
                    .scaleEffect(isPulsing ? 1.1 : 1.0)
            }
            .frame(width: 48, height: 44)
            .padding(.leading, 24)
            
            // MARK: Section B - Telemetry (The Data)
            // 数据仪表盘：单行显示，减少留白
            HStack(alignment: .bottom, spacing: 16) {
                // 1. 本次绘制 (Session) - 核心视觉焦点
                Text("\(gpsService.drawnPixelsCount)")
                    .responsiveFont(.title2, weight: .bold)
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                    .scaleEffect(pixelCountScale)
                    .onChange(of: gpsService.drawnPixelsCount) { oldValue, newValue in
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.5)) { pixelCountScale = 1.2 }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.5)) { pixelCountScale = 1.0 }
                        }
                    }
                    .fixedSize() // 防止数字被压缩
                
                // 2. 副数据：资源 & 生涯 (Compact Line)
                HStack(spacing: 12) {
                    // 可用资源 / 状态指示
                    HStack(spacing: 4) {
                        if pixelService.isFrozen {
                            // ❄️ 冻结状态：显示倒计时
                            Image(systemName: "snowflake")
                                .responsiveFont(.caption2)
                                .foregroundStyle(.orange)
                                .symbolEffect(.pulse.byLayer) // 呼吸效果
                            
                            Text(pixelService.freezeTimeLeft > 0 ? "\(pixelService.freezeTimeLeft)s" : NSLocalizedString("common.loading", comment: "Wait..."))
                                .responsiveFont(.footnote, weight: .medium)
                                .foregroundStyle(.orange)
                        } else {
                            // 💧 正常/恢复状态
                            Image(systemName: "drop.fill")
                                .responsiveFont(.caption2)
                                .foregroundStyle(pixelService.totalPoints > 10 ? Color.blue : Color.red)
                            
                            Text(formatCompactNumber(pixelService.totalPoints))
                                .responsiveFont(.footnote, weight: .medium)
                                .foregroundStyle(pixelService.totalPoints > 0 ? Color.gray : Color.red)
                                .frame(minWidth: 35, alignment: .leading) // 固定最小宽度防止挤压
                            
                            // 增长指示器 (当处于恢复状态且未满时显示)
                            if pixelService.naturalPoints < pixelService.maxNaturalPoints {
                                Image(systemName: "arrow.up.circle.fill")
                                    .responsiveFont(.caption2)
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(pixelService.isFrozen ? Color.orange.opacity(0.1) : Color.clear)
                    .clipShape(Capsule())
                    
                    // 生涯总计
                    HStack(spacing: 3) {
                        Image(systemName: "trophy.fill")
                            .responsiveFont(.caption2)
                            .foregroundStyle(.yellow)
                        
                        if let stats = profileViewModel.userStats {
                            Text(formatCompactNumber(stats.totalPixels))
                                .responsiveFont(.footnote, weight: .medium)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("-")
                                .responsiveFont(.footnote, weight: .medium)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.bottom, 4) // Align with the baseline of the big number
            .frame(maxWidth: .infinity, alignment: .leading) // 确保占据剩余空间
            
            // MARK: Section C - Action (The Trigger)
            // 停止按钮：32pt 极致小巧
            Button(action: {
                #if !targetEnvironment(simulator)
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
                #endif
                Task { await toggleGPSDrawing() }
            }) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(colors: [.red, .pink], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .shadow(color: .red.opacity(0.3), radius: 5, x: 0, y: 2)
                    
                    Image(systemName: gpsService.isGPSDrawingMode ? "stop.fill" : "play.fill") // Toggle Icon
                        .responsiveFont(.caption, weight: .bold) // Smaller icon for 28pt button
                        .foregroundStyle(.white)
                }
                .frame(width: 28, height: 28)
            }
            .buttonStyle(ScaleButtonStyle())
            .padding(.trailing, 24) 
        }
        .frame(height: 64) // Ultra-Compact Dock Height
        .background(
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(
                    LinearGradient(colors: [Color.black.opacity(0.05), Color.clear], startPoint: .bottom, endPoint: .top)
                )
        )
        // 顶部边框线
        .overlay(Rectangle().frame(height: 0.5).foregroundColor(Color.white.opacity(0.2)), alignment: .top)
        // 加载生涯数据
        .onAppear {
            Logger.debug("🔍 GPS Panel onAppear - Loading user stats")
            Task {
                // 刷新像素状态，确保从商店返回时显示最新数据
                try? await pixelService.refresh()
                await profileViewModel.loadUserStats()
                Logger.debug("🔍 GPS Panel - Stats loaded: totalPixels = \(profileViewModel.userStats?.totalPixels ?? -1)")
            }
        }
    }

    // MARK: - Components
    
    private var allianceFlagIcon: some View {
        SmallAllianceFlagBadge(pattern: patternProvider.currentDrawingPattern, size: 20, borderSize: 1.2)
    }
    
    // MARK: - Helpers

    private func formatCompactNumber(_ number: Int) -> String {
        if number >= 1000000 {
            return String(format: "%.1fM", Double(number) / 1000000.0)
        } else if number >= 1000 {
            return String(format: "%.1fk", Double(number) / 1000.0)
        } else {
            return "\(number)"
        }
    }

    private func toggleGPSDrawing() async {
        if gpsService.isGPSDrawingMode {
            // 🛑 停止
            Logger.info("📸 Generating session snapshot...")

            // ✨ 播放停止音效
            SoundManager.shared.playGPSDrawingStop()

            // 在停止GPS服务之前生成快照（需要mapView和像素数据仍然可用）
            if let snapshot = await gpsService.generateSessionSnapshot() {
                 await MainActor.run {
                     drawingState.lastSessionImage = snapshot
                 }
                 Logger.info("✅ Snapshot captured")
            }

            // 停止GPS服务（内部已调用 drawingState.stopDrawing()，触发分享页）
            await gpsService.stopGPSDrawing()
        } else {
            // 🚀 启动
            // ✨ 播放开始音效
            SoundManager.shared.playGPSDrawingStart()

            await drawingState.requestStartGPSDrawing()
        }
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Color.black
        VStack {
            Spacer()
            FogMapGPSDrawingControl()
                .environmentObject(AuthViewModel())
        }
    }
}
