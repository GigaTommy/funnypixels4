//
//  TowerSceneView.swift
//  FunnyPixelsApp
//
//  Task: #39 - Week 2 iOS UI 组件
//  3D 像素塔场景视图
//

import SwiftUI
import SceneKit
import CoreLocation

struct TowerSceneView: View {
    @StateObject private var viewModel = TowerViewModel()
    @EnvironmentObject var locationManager: LocationManager

    private let mapController = MapController.shared

    @State private var showTowerDetails = false
    @State private var showPerformanceHUD = false
    @State private var performanceStats: PerformanceStats = PerformanceStats()

    var body: some View {
        ZStack {
            // SceneKit 视图（仅响应点击塔的手势，其他手势穿透）
            SceneKitView(
                scene: viewModel.scene,
                onTap: { point, sceneView in
                    viewModel.handleTap(at: point, in: sceneView)
                },
                onCameraUpdate: {
                    // 相机移动时更新 LOD
                    viewModel.updateAllTowerLODs()

                    // 更新性能统计
                    if showPerformanceHUD {
                        updatePerformanceStats()
                    }
                }
            )
            .allowsHitTesting(true)  // 允许点击检测
            .ignoresSafeArea()

            // 加载状态
            if viewModel.isLoading {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.5)
                        .tint(.white)
                    Text(NSLocalizedString("loading_towers", comment: "Loading towers..."))
                        .foregroundColor(.white)
                        .font(.subheadline)
                }
                .padding(20)
                .background(Color.black.opacity(0.7))
                .cornerRadius(12)
                .transition(.opacity.combined(with: .scale))
            }

            // 空状态提示
            if !viewModel.isLoading && viewModel.loadedTowerCount == 0 && viewModel.error == nil {
                VStack(spacing: 16) {
                    Image(systemName: "building.2")
                        .font(.system(size: 50))
                        .foregroundColor(.white.opacity(0.7))
                    Text(NSLocalizedString("no_towers_here", comment: "No towers here"))
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(NSLocalizedString("draw_pixels_to_create", comment: "Draw pixels to create the first tower!"))
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(24)
                .background(Color.black.opacity(0.6))
                .cornerRadius(16)
                .transition(.opacity.combined(with: .scale))
            }

            // 错误提示
            if let error = viewModel.error {
                VStack(spacing: 12) {
                    Image(systemName: isNetworkError(error) ? "wifi.exclamationmark" : "exclamationmark.triangle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.yellow)
                    Text(localizedErrorMessage(error))
                        .foregroundColor(.white)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)

                    Button(action: {
                        viewModel.error = nil
                        reloadTowers()
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.clockwise")
                            Text(NSLocalizedString("retry", comment: "Retry"))
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .cornerRadius(8)
                    }
                }
                .padding(20)
                .background(Color.black.opacity(0.7))
                .cornerRadius(12)
                .transition(.opacity.combined(with: .scale))
            }

            // 统计信息 HUD
            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: "building.2.fill")
                                .font(.caption)
                            Text("\(viewModel.loadedTowerCount)")
                                .font(.system(.title3, design: .rounded))
                                .fontWeight(.bold)
                        }
                        .foregroundColor(.white)

                        Text(NSLocalizedString("towers_visible", comment: "Towers"))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(12)
                    .onTapGesture {
                        showPerformanceHUD.toggle()
                    }

                    Spacer()

                    // 性能 HUD（可选显示）
                    if showPerformanceHUD {
                        PerformanceHUDView(stats: performanceStats)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                .padding()

                Spacer()
            }
            .animation(.easeInOut(duration: 0.3), value: showPerformanceHUD)

            // 底部工具栏
            VStack {
                Spacer()

                HStack(spacing: 16) {
                    // 返回 2D 地图按钮
                    Button(action: {
                        // 通知父视图切换回 2D
                        NotificationCenter.default.post(name: .switchTo2DMode, object: nil)
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "map.fill")
                            Text(NSLocalizedString("back_to_2d", comment: "2D Map"))
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(25)
                        .shadow(radius: 4)
                    }

                    // 重新加载按钮
                    Button(action: {
                        reloadTowers()
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.title3)
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                            .shadow(radius: 4)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
        }
        .sheet(isPresented: $viewModel.showTowerDetails) {
            if let towerData = viewModel.selectedTower {
                TowerDetailsView(towerData: towerData, viewModel: viewModel)
            }
        }
        .onAppear {
            loadInitialTowers()

            // 监听地图移动事件
            NotificationCenter.default.addObserver(
                forName: NSNotification.Name("MapDidMove"),
                object: nil,
                queue: .main
            ) { _ in
                reloadTowers()
            }
        }
        .onDisappear {
            NotificationCenter.default.removeObserver(self, name: NSNotification.Name("MapDidMove"), object: nil)
        }
    }

    private func loadInitialTowers() {
        let center = mapController.cachedCenter ??
                     locationManager.currentLocation?.coordinate ??
                     CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074)

        let zoom = 15.0

        // 更新相机
        viewModel.updateCamera(center: center, zoom: zoom)

        // 计算视口
        let delta = 0.02
        let bounds = ViewportBounds(
            minLat: center.latitude - delta,
            maxLat: center.latitude + delta,
            minLng: center.longitude - delta,
            maxLng: center.longitude + delta
        )

        // 加载塔
        Task {
            await viewModel.loadTowers(center: center, bounds: bounds)
        }
    }

    private func reloadTowers() {
        viewModel.cleanup()
        loadInitialTowers()
    }

    private func updatePerformanceStats() {
        let memoryStats = viewModel.getMemoryStats()
        performanceStats.towerCount = memoryStats.towerCount
        performanceStats.visibleCount = memoryStats.visibleCount
        performanceStats.hiddenCount = memoryStats.hiddenCount

        // 获取内存使用（简化版）
        var taskInfo = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        let result = withUnsafeMutablePointer(to: &taskInfo) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        if result == KERN_SUCCESS {
            let usedMB = Double(taskInfo.resident_size) / 1024.0 / 1024.0
            performanceStats.memoryUsageMB = usedMB
        }
    }

    // MARK: - Error Handling Helpers

    private func isNetworkError(_ error: String) -> Bool {
        let networkKeywords = ["network", "connection", "internet", "offline", "unreachable", "timeout"]
        return networkKeywords.contains { error.lowercased().contains($0) }
    }

    private func localizedErrorMessage(_ error: String) -> String {
        if isNetworkError(error) {
            return NSLocalizedString("network_error_check_connection", comment: "Network error. Please check your connection.")
        } else {
            return NSLocalizedString("error_loading_towers", comment: "Error loading towers. Please try again.")
        }
    }
}

// MARK: - Performance Stats

struct PerformanceStats {
    var towerCount: Int = 0
    var visibleCount: Int = 0
    var hiddenCount: Int = 0
    var memoryUsageMB: Double = 0
}

// MARK: - Performance HUD View

struct PerformanceHUDView: View {
    let stats: PerformanceStats

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Performance")
                .font(.caption.bold())
                .foregroundColor(.white)

            Divider()
                .background(Color.white.opacity(0.3))

            statRow(label: "Towers", value: "\(stats.towerCount)")
            statRow(label: "Visible", value: "\(stats.visibleCount)", color: .green)
            statRow(label: "Hidden", value: "\(stats.hiddenCount)", color: .orange)
            statRow(label: "Memory", value: String(format: "%.1f MB", stats.memoryUsageMB))
        }
        .padding(12)
        .background(Color.black.opacity(0.7))
        .cornerRadius(12)
    }

    private func statRow(label: String, value: String, color: Color = .white) -> some View {
        HStack {
            Text(label)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.7))
            Spacer()
            Text(value)
                .font(.caption.monospacedDigit())
                .foregroundColor(color)
        }
    }
}

// MARK: - SceneKit View Wrapper

struct SceneKitView: UIViewRepresentable {
    let scene: SCNScene
    let onTap: (CGPoint, SCNView) -> Void
    let onCameraUpdate: () -> Void

    func makeUIView(context: Context) -> TransparentSceneView {
        let sceneView = TransparentSceneView()
        sceneView.scene = scene
        sceneView.autoenablesDefaultLighting = false  // 使用自定义光照
        sceneView.allowsCameraControl = false  // 禁用相机控制，允许地图手势穿透
        sceneView.backgroundColor = .clear
        sceneView.antialiasingMode = .multisampling4X
        sceneView.delegate = context.coordinator
        sceneView.isUserInteractionEnabled = true  // 仅允许点击检测

        // 添加点击手势
        let tapGesture = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTap(_:))
        )
        sceneView.addGestureRecognizer(tapGesture)

        return sceneView
    }

    func updateUIView(_ uiView: TransparentSceneView, context: Context) {
        // Scene updates are handled by viewModel
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onTap: onTap, onCameraUpdate: onCameraUpdate)
    }

    class Coordinator: NSObject, SCNSceneRendererDelegate {
        let onTap: (CGPoint, SCNView) -> Void
        let onCameraUpdate: () -> Void
        private var lastUpdateTime: TimeInterval = 0
        private let updateInterval: TimeInterval = 0.5  // 每 0.5 秒检查一次

        init(onTap: @escaping (CGPoint, SCNView) -> Void,
             onCameraUpdate: @escaping () -> Void) {
            self.onTap = onTap
            self.onCameraUpdate = onCameraUpdate
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let sceneView = gesture.view as? SCNView else { return }
            let location = gesture.location(in: sceneView)
            onTap(location, sceneView)
        }

        // SCNSceneRendererDelegate - 在每一帧渲染后调用
        func renderer(_ renderer: SCNSceneRenderer, didRenderScene scene: SCNScene, atTime time: TimeInterval) {
            // 限流：避免每帧都更新 LOD
            if time - lastUpdateTime > updateInterval {
                lastUpdateTime = time
                DispatchQueue.main.async {
                    self.onCameraUpdate()
                }
            }
        }
    }
}

// MARK: - Tower Details View (GitCity Style)

struct TowerDetailsView: View {
    let towerData: TowerDetailsData
    @ObservedObject var viewModel: TowerViewModel
    @Environment(\.dismiss) var dismiss
    @State private var selectedTab = 0

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // GitCity-style Hero Section
                    GitCityHeroView(towerData: towerData)
                        .padding(.horizontal)

                    // Statistics Cards
                    StatisticsCardsView(towerData: towerData)
                        .padding(.horizontal)

                    // Visual Tower Representation
                    if towerData.userFloors != nil {
                        VisualTowerView(towerData: towerData)
                            .frame(height: 300)
                            .padding(.horizontal)
                    }

                    // Tab Selector
                    Picker("", selection: $selectedTab) {
                        Text(NSLocalizedString("all_floors", comment: "All Floors")).tag(0)
                        if towerData.userFloors != nil {
                            Text(NSLocalizedString("my_floors", comment: "My Floors")).tag(1)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Floor List
                    VStack(spacing: 8) {
                        let displayFloors = selectedTab == 0 ?
                            Array(towerData.floors.reversed().prefix(50)) :
                            Array(towerData.floors.filter { isUserFloor($0) }.reversed())

                        ForEach(displayFloors) { floor in
                            EnhancedFloorRowView(
                                floor: floor,
                                isUserFloor: isUserFloor(floor)
                            )
                        }

                        if selectedTab == 0 && towerData.totalFloors > 50 {
                            Text(NSLocalizedString("showing_recent_floors", comment: "Showing recent 50 floors"))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .padding(.vertical, 8)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 20)
                }
            }
            .background(
                LinearGradient(
                    colors: [
                        Color(uiColor: .systemBackground),
                        Color.blue.opacity(0.05)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .navigationTitle(NSLocalizedString("pixel_tower", comment: "Pixel Tower"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if towerData.userFloors != nil {
                        ShareLink(
                            item: generateShareImage(),
                            preview: SharePreview(
                                NSLocalizedString("my_tower_contribution", comment: "My Tower Contribution"),
                                image: generateShareImage()
                            )
                        ) {
                            Label(NSLocalizedString("share", comment: "Share"), systemImage: "square.and.arrow.up")
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(NSLocalizedString("done", comment: "Done")) {
                        dismiss()
                    }
                }
            }
        }
    }

    private func isUserFloor(_ floor: FloorData) -> Bool {
        guard let userFloors = towerData.userFloors else { return false }
        return floor.floorIndex >= userFloors.firstFloorIndex &&
               floor.floorIndex <= userFloors.lastFloorIndex
    }

    /// 生成分享卡片图片
    private func generateShareImage() -> Image {
        let renderer = ImageRenderer(content: TowerShareCard(towerData: towerData))
        renderer.scale = 3.0  // 高清

        if let uiImage = renderer.uiImage {
            return Image(uiImage: uiImage)
        } else {
            return Image(systemName: "photo")
        }
    }
}

// MARK: - GitCity Hero View

struct GitCityHeroView: View {
    let towerData: TowerDetailsData

    var body: some View {
        VStack(spacing: 16) {
            // Tower Icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)

                Image(systemName: "building.2.fill")
                    .font(.system(size: 50))
                    .foregroundColor(.white)
            }

            // User Contribution (if exists)
            if let userFloors = towerData.userFloors {
                VStack(spacing: 8) {
                    Text("\(userFloors.floorCount)")
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                        .foregroundColor(.blue)

                    Text(NSLocalizedString("floors_contributed", comment: "Floors Contributed"))
                        .font(.headline)
                        .foregroundColor(.secondary)

                    // Contribution Badge
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                        Text(userFloors.formattedContribution)
                            .fontWeight(.semibold)
                    }
                    .font(.subheadline)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(20)
                }
            } else {
                VStack(spacing: 8) {
                    Text("\(towerData.totalFloors)")
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                        .foregroundColor(.blue)

                    Text(NSLocalizedString("total_floors", comment: "Total Floors"))
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 24)
    }
}

// MARK: - Statistics Cards View

struct StatisticsCardsView: View {
    let towerData: TowerDetailsData

    var body: some View {
        HStack(spacing: 12) {
            // Total Floors Card
            TowerStatCard(
                icon: "building.2.fill",
                value: "\(towerData.totalFloors)",
                label: NSLocalizedString("total_floors", comment: "Total Floors"),
                color: .blue
            )

            // User Floors Card (if applicable)
            if let userFloors = towerData.userFloors {
                TowerStatCard(
                    icon: "star.fill",
                    value: "\(userFloors.floorCount)",
                    label: NSLocalizedString("your_floors", comment: "Your Floors"),
                    color: .orange
                )

                // Rank Card (if available)
                TowerStatCard(
                    icon: "crown.fill",
                    value: "#\(userFloors.firstFloorIndex + 1)",
                    label: NSLocalizedString("first_floor", comment: "First Floor"),
                    color: .purple
                )
            }
        }
    }
}

// MARK: - Stat Card

private struct TowerStatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(.primary)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(color.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Visual Tower View

struct VisualTowerView: View {
    let towerData: TowerDetailsData

    var body: some View {
        GeometryReader { geometry in
            let totalHeight = geometry.size.height
            let userFloors = towerData.userFloors

            ZStack(alignment: .bottom) {
                // Background Tower
                RoundedRectangle(cornerRadius: 8)
                    .fill(
                        LinearGradient(
                            colors: [.gray.opacity(0.3), .gray.opacity(0.1)],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(width: 100, height: totalHeight)

                // User Contribution Highlight
                if let userFloors = userFloors {
                    let contribution = Double(userFloors.floorCount) / Double(towerData.totalFloors)
                    let userHeight = totalHeight * contribution
                    let userYOffset = (Double(userFloors.firstFloorIndex) / Double(towerData.totalFloors)) * totalHeight

                    RoundedRectangle(cornerRadius: 8)
                        .fill(
                            LinearGradient(
                                colors: [.blue, .purple],
                                startPoint: .bottom,
                                endPoint: .top
                            )
                        )
                        .frame(width: 100, height: userHeight)
                        .offset(y: -userYOffset)
                        .overlay(
                            VStack {
                                Spacer()
                                HStack(spacing: 4) {
                                    Image(systemName: "star.fill")
                                        .font(.caption2)
                                    Text("YOU")
                                        .font(.caption2)
                                        .fontWeight(.bold)
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(8)
                                .offset(y: userHeight > 50 ? -8 : 8)
                            }
                        )
                }

                // Floor Markers
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(0..<min(10, towerData.totalFloors / 10), id: \.self) { i in
                        HStack(spacing: 4) {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 120, height: 1)

                            Text("\(i * 10)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .frame(height: totalHeight / 10)
                    }
                }
                .offset(x: -10)
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .padding(.vertical)
    }
}

// MARK: - Enhanced Floor Row View

struct EnhancedFloorRowView: View {
    let floor: FloorData
    let isUserFloor: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Floor Number Badge
            Text("\(floor.floorIndex)")
                .font(.system(.caption, design: .monospaced))
                .fontWeight(isUserFloor ? .bold : .regular)
                .foregroundColor(isUserFloor ? .white : .secondary)
                .frame(width: 50, alignment: .center)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isUserFloor ?
                            LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing) :
                            LinearGradient(colors: [.gray.opacity(0.2)], startPoint: .leading, endPoint: .trailing)
                        )
                )

            // Color Preview
            Circle()
                .fill(Color(UIColor(hex: floor.color) ?? .gray))
                .frame(width: 32, height: 32)
                .overlay(
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )

            // User Info
            VStack(alignment: .leading, spacing: 2) {
                if let username = floor.username {
                    HStack(spacing: 4) {
                        Text(username)
                            .font(.subheadline)
                            .fontWeight(isUserFloor ? .semibold : .regular)

                        if isUserFloor {
                            Image(systemName: "star.fill")
                                .font(.caption2)
                                .foregroundColor(.yellow)
                        }
                    }
                } else {
                    Text(NSLocalizedString("unknown_user", comment: "Unknown"))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text(floor.formattedTimestamp)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isUserFloor ? Color.blue.opacity(0.05) : Color(uiColor: .secondarySystemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isUserFloor ? Color.blue.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

// MARK: - Tower Share Card

struct TowerShareCard: View {
    let towerData: TowerDetailsData

    var body: some View {
        ZStack {
            // 背景渐变
            LinearGradient(
                colors: [
                    Color(red: 0.2, green: 0.4, blue: 0.8),
                    Color(red: 0.1, green: 0.2, blue: 0.5)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 24) {
                // 顶部标题
                VStack(spacing: 8) {
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.white)

                    Text(NSLocalizedString("pixel_tower", comment: "Pixel Tower"))
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }

                // 主要信息卡片
                VStack(spacing: 16) {
                    if let userFloors = towerData.userFloors {
                        // 用户贡献
                        VStack(spacing: 8) {
                            Text(NSLocalizedString("i_built", comment: "I Built"))
                                .font(.headline)
                                .foregroundColor(.white.opacity(0.9))

                            Text("\(userFloors.floorCount)")
                                .font(.system(size: 72, weight: .bold, design: .rounded))
                                .foregroundColor(.white)

                            Text(NSLocalizedString("floors", comment: "Floors"))
                                .font(.title2)
                                .foregroundColor(.white.opacity(0.9))
                        }

                        // 贡献百分比
                        HStack(spacing: 8) {
                            Text(NSLocalizedString("contribution", comment: "Contribution"))
                            Text(userFloors.formattedContribution)
                                .fontWeight(.bold)
                        }
                        .font(.title3)
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(20)

                        // 楼层范围
                        HStack(spacing: 4) {
                            Text(userFloors.floorRangeDescription)
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }

                    // 塔统计
                    HStack(spacing: 32) {
                        VStack(spacing: 4) {
                            Text("\(towerData.totalFloors)")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(.white)
                            Text(NSLocalizedString("total_floors", comment: "Total Floors"))
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                }
                .padding(32)
                .background(Color.white.opacity(0.15))
                .cornerRadius(24)

                Spacer()

                // 底部品牌
                HStack(spacing: 8) {
                    Image(systemName: "map.fill")
                    Text("FunnyPixels")
                        .fontWeight(.semibold)
                }
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
                .padding(.bottom, 8)
            }
            .padding(32)
        }
        .frame(width: 400, height: 600)
    }
}

// MARK: - Notification Extension

extension Notification.Name {
    static let switchTo2DMode = Notification.Name("switchTo2DMode")
}

// MARK: - Transparent SceneView (智能手势穿透)

/// 自定义SCNView，只在点击到塔时才拦截手势，其他手势穿透到地图
class TransparentSceneView: SCNView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        // 检查是否点击到3D物体
        let hitResults = self.hitTest(point, options: [:])

        if let firstHit = hitResults.first {
            // 点击到塔了，拦截手势
            return super.hitTest(point, with: event)
        } else {
            // 没有点击到塔，让手势穿透到地图
            return nil
        }
    }
}

// MARK: - Preview

struct TowerSceneView_Previews: PreviewProvider {
    static var previews: some View {
        TowerSceneView()
            .environmentObject(LocationManager.shared)
    }
}
