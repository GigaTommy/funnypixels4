import SwiftUI
#if canImport(MapLibre)
import MapLibre
#endif
#if canImport(MapKit)
import MapKit
#endif

/// MapLibre GL 地图视图
/// 使用 MapLibre Native 渲染地图和 MVT 瓦片
/// 在 macOS 上回退到 MapKit
public struct MapLibreMapView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var checkinViewModel = CheckinViewModel()
    @StateObject private var notificationViewModel = NotificationViewModel()  // ✅ 新增

    @State private var showProfileSheet = false
    @State private var showNotificationSheet = false  // ✅ 新增
    @State private var selectedPixel: Pixel?

    public init() {}

    public var body: some View {
        ZStack {
            #if canImport(MapLibre)
            // MapLibre 地图 (iOS)
            MapLibreMapWrapper(
                onPixelTapped: { pixel in
                    handlePixelTapped(pixel)
                }
            )
            .ignoresSafeArea(edges: .top)
            #elseif canImport(MapKit)
            // MapKit 地图 (回退)
            SimpleMapView()
                .ignoresSafeArea(edges: .top)
            #else
            Text("地图视图在此平台不可用")
                .foregroundStyle(.secondary)
            #endif

            // 顶部覆盖层
            VStack {
                topOverlay
                Spacer()
            }

            // 像素详情卡片
            if let pixel = selectedPixel {
                VStack {
                    Spacer()
                    PixelDetailCard(
                        pixel: pixel,
                        onClose: {
                            withAnimation(.spring()) {
                                selectedPixel = nil
                            }
                        },
                        onDelete: {
                            // 删除逻辑
                            selectedPixel = nil
                        }
                    )
                    .padding()
                    .padding(.bottom, 100)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // 底部工具栏（仅登录后显示，ProfileSheet 弹出时隐藏避免遮挡）
            if authViewModel.isAuthenticated && !showProfileSheet {
                VStack {
                    Spacer()
                    bottomToolbar
                        .padding(.bottom, 34)
                }
            }

            // 右侧工具栏（仅登录后显示）
            if authViewModel.isAuthenticated {
                HStack {
                    Spacer()
                    rightToolbar
                        .padding(.trailing, 16)
                        .padding(.vertical, 100)
                }
            }

            // 签到成功卡片
            if checkinViewModel.showSuccess, let result = checkinViewModel.checkinResult {
                VStack {
                    Spacer()
                    CheckinSuccessView(
                        result: result,
                        isPresented: $checkinViewModel.showSuccess
                    )
                    .padding()
                    .padding(.bottom, 100)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onAppear {
            if authViewModel.isAuthenticated {
                Task { await checkinViewModel.checkCanCheckin() }
                // ✅ 获取未读消息数量
                Task { await notificationViewModel.fetchUnreadCount() }
            }
        }
        // ✅ 定期刷新未读消息数量（每30秒）
        .task {
            guard authViewModel.isAuthenticated else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30秒
                await notificationViewModel.fetchUnreadCount()
            }
        }
        .sheet(isPresented: $showProfileSheet) {
            ProfileSheet()
                .environmentObject(authViewModel)
                .presentationDetents([.medium, .large])
        }
        // ✅ 消息中心 Sheet
        .sheet(isPresented: $showNotificationSheet) {
            NotificationListView()
                .environmentObject(notificationViewModel)
                .presentationDetents([.large])
        }
    }

    // MARK: - Top Overlay

    private var topOverlay: some View {
        HStack {
            if let user = authViewModel.currentUser {
                Button {
                    showProfileSheet = true
                } label: {
                    AsyncImage(url: user.avatarURL) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Circle()
                            .fill(Color(hex: "#4ECDC4") ?? .blue)
                            .overlay {
                                Text(user.username.prefix(1).uppercased())
                                    .font(.headline)
                                    .foregroundStyle(.white)
                            }
                    }
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white, lineWidth: 2)
                    }
                    .shadow(radius: 2)
                }
            } else {
                Button(action: {
                    // 显示登录界面
                }) {
                    Text("登录")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .cornerRadius(20)
                }
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    // MARK: - Bottom Toolbar

    private var bottomToolbar: some View {
        HStack(spacing: 0) {
            ToolBarButton(icon: "map.fill", title: "地图") {}

            ToolBarButton(icon: "star.fill", title: "排行榜") {}

            // ✅ 消息按钮（带未读数量 Badge）
            ZStack(alignment: .topTrailing) {
                ToolBarButton(icon: "bell.fill", title: "消息") {
                    showNotificationSheet = true
                }

                // 未读数量 Badge
                if notificationViewModel.unreadCount > 0 {
                    Text("\(notificationViewModel.unreadCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red)
                        .clipShape(Capsule())
                        .offset(x: 8, y: -4)
                }
            }

            ToolBarButton(icon: "person.fill", title: "我的") {}
        }
        .frame(height: 56)
        .background(Color.white)
        .cornerRadius(28)
        .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        .padding(.horizontal, 16)
    }

    // MARK: - Right Toolbar

    private var rightToolbar: some View {
        VStack(spacing: 12) {
            CircleToolButton(
                icon: "checkmark.seal.fill",
                isActive: !checkinViewModel.canCheckin
            ) {
                Task { await checkinViewModel.performCheckin() }
            }
            .disabled(!checkinViewModel.canCheckin)

            CircleToolButton(icon: "plus") {}
            CircleToolButton(icon: "pencil") {}
            CircleToolButton(icon: "location.fill") {}
            CircleToolButton(icon: "square.grid.3x3") {}
        }
    }

    // MARK: - Handlers

    private func handlePixelTapped(_ pixel: Pixel) {
        withAnimation(.spring()) {
            selectedPixel = pixel
        }
        Logger.userAction("pixel_tapped", details: ["pixel_id": pixel.id])
    }
}

// MARK: - MapLibre Map Wrapper (仅 iOS)

#if canImport(MapLibre)

import UIKit

/// MapLibre 地图包装器
@MainActor
struct MapLibreMapWrapper: UIViewRepresentable {
    let onPixelTapped: (Pixel) -> Void

    func makeUIView(context: Context) -> MLNMapView {
        let mapView = MLNMapView()
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = context.coordinator
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = true

        // 设置初始位置（北京）
        let center = CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074)
        mapView.setCenter(center, zoomLevel: 12, animated: false)

        // 使用 Carto Dark Matter 样式
        mapView.styleURL = URL(string: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json")

        return mapView
    }

    func updateUIView(_ mapView: MLNMapView, context: Context) {
        // 更新地图状态
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onPixelTapped: onPixelTapped)
    }

    class Coordinator: NSObject, MLNMapViewDelegate {
        let onPixelTapped: (Pixel) -> Void

        init(onPixelTapped: @escaping (Pixel) -> Void) {
            self.onPixelTapped = onPixelTapped
        }

        func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
            Logger.info("MapLibre style loaded successfully")
        }

        func mapView(_ mapView: MLNMapView, onTap tapPoint: CGPoint) {
            // 处理点击事件
            let coordinate = mapView.convert(tapPoint, toCoordinateFrom: mapView)

            // 这里可以调用像素检测逻辑
            Logger.debug("Map tapped at: \(coordinate)")
        }
    }
}

#endif

// MARK: - Supporting Views

struct ToolBarButton: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                Text(title)
                    .font(.system(size: 10))
            }
            .foregroundColor(.blue)
            .frame(maxWidth: .infinity)
        }
    }
}

struct CircleToolButton: View {
    let icon: String
    var isActive: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(isActive ? Color.blue : Color.white)
                    .frame(width: 44, height: 44)
                    .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)

                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(isActive ? .white : .blue)
            }
        }
    }
}

// MARK: - Pixel Detail Card

struct PixelDetailCard: View {
    let pixel: Pixel
    let onClose: () -> Void
    let onDelete: () -> Void

    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showDeleteAlert = false

    var body: some View {
        VStack(spacing: 16) {
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 36, height: 4)

            HStack(spacing: 16) {
                Circle()
                    .fill(Color(hex: pixel.color) ?? .blue)
                    .frame(width: 64, height: 64)
                    .overlay {
                        Circle()
                            .strokeBorder(.quaternary, lineWidth: 1)
                    }
                    .shadow(color: Color(hex: pixel.color)?.opacity(0.3) ?? .clear, radius: 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text("像素详情")
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(pixel.color.uppercased())
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        #if os(macOS)
                        .font(.system(size: 12, design: .monospaced))
                        #else
                        .monospaced()
                        #endif

                    if let user = authViewModel.currentUser,
                       pixel.authorId == user.id {
                        Label("我的像素", systemImage: "person.fill")
                            .font(.caption)
                            .foregroundStyle(.blue)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.blue.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }

                Spacer()

                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }

            GroupBox {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("纬度")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(String(format: "%.6f", pixel.latitude))
                            .font(.subheadline)
                            #if os(macOS)
                            .font(.system(size: 12, design: .monospaced))
                            #else
                            .monospaced()
                            #endif
                    }

                    Spacer()

                    Divider()

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text("经度")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(String(format: "%.6f", pixel.longitude))
                            .font(.subheadline)
                            #if os(macOS)
                            .font(.system(size: 12, design: .monospaced))
                            #else
                            .monospaced()
                            #endif
                    }
                }
            }

            if let user = authViewModel.currentUser,
               pixel.authorId == user.id {
                HStack(spacing: 12) {
                    Button(role: .destructive) {
                        showDeleteAlert = true
                    } label: {
                        Label("删除", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.1), radius: 20, y: 10)
        .alert("删除像素", isPresented: $showDeleteAlert) {
            Button("取消", role: .cancel) { }
            Button("删除", role: .destructive, action: onDelete)
        } message: {
            Text("确定要删除这个像素吗？此操作不可撤销。")
        }
    }
}

// MARK: - Profile Sheet

struct ProfileSheet: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        #if os(macOS)
        // macOS 使用NavigationView
        NavigationView {
            List {
                if let user = authViewModel.currentUser {
                    Section {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color(hex: "#4ECDC4") ?? .blue)
                                .frame(width: 60, height: 60)
                                .overlay {
                                    Text(user.username.prefix(1).uppercased())
                                        .font(.title2)
                                        .foregroundStyle(.white)
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayOrUsername)
                                    .font(.headline)
                                Text(user.username)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section {
                        Button(role: .destructive) {
                            Task {
                                await authViewModel.logout()
                            }
                        } label: {
                            Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
            }
            .navigationTitle("账户")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
        }
        #else
        // iOS 使用 NavigationStack
        NavigationStack {
            List {
                if let user = authViewModel.currentUser {
                    Section {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color(hex: "#4ECDC4") ?? .blue)
                                .frame(width: 60, height: 60)
                                .overlay {
                                    Text(user.username.prefix(1).uppercased())
                                        .font(.title2)
                                        .foregroundStyle(.white)
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayOrUsername)
                                    .font(.headline)
                                Text(user.username)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section {
                        Button(role: .destructive) {
                            Task {
                                await authViewModel.logout()
                            }
                        } label: {
                            Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Color.clear.frame(height: 50)
            }
            .navigationTitle("账户")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
        }
        #endif
    }
}

