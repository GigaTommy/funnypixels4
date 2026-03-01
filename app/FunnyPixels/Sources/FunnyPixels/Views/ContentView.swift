import SwiftUI

/// 主内容视图
public struct ContentView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @State private var showAuthSheet = false

    public init() {}

    public var body: some View {
        // 所有浮层（底部菜单栏、右侧工具栏、ProfileSheet）
        // 均由 MapLibreMapView 内部管理，确保 .sheet() 弹出时
        // 能正确遮盖底部菜单栏，不会被父级 ZStack 元素遮挡。
        MainMapView()
            .environmentObject(authViewModel)
            .sheet(isPresented: $showAuthSheet) {
                AuthView()
                    .environmentObject(authViewModel)
            }
            .onAppear {
                // 默认以游客身份访问
                Task.detached {
                    // 不自动检查登录状态，直接以游客身份运行
                }
            }
    }
}

/// 主地图视图
/// 底部菜单栏和右侧工具栏由 MapLibreMapView 内部管理，
/// 避免父级 ZStack 浮层遮挡 MapLibreMapView 弹出的 Sheet。
struct MainMapView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        MapLibreMapView()
            .ignoresSafeArea(edges: .top)
    }
}
