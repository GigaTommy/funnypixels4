import SwiftUI
import Combine

/// Map layer control panel for toggling visibility of different map layers
struct MapLayerControl: View {
    @StateObject private var layerSettings = MapLayerSettings.shared
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if isExpanded {
                expandedPanel
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }

            // Toggle button
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            }) {
                Image(systemName: isExpanded ? "xmark.circle.fill" : "square.stack.3d.up.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
                    .background(Color.blue)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
            }
        }
    }

    private var expandedPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Image(systemName: "square.stack.3d.up.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.blue)

                Text("地图图层")
                    .font(.system(size: 16, weight: .bold))

                Spacer()

                Button(action: {
                    layerSettings.resetToDefault()
                }) {
                    Text("重置")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.blue)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Layer toggles
            ScrollView {
                VStack(spacing: 0) {
                    layerToggle(
                        icon: "square.grid.3x3.fill",
                        title: "像素层",
                        subtitle: "显示所有绘制的像素",
                        color: .purple,
                        isOn: $layerSettings.showPixelLayer,
                        isLocked: true
                    )

                    layerToggle(
                        icon: "shield.fill",
                        title: "领地控制层",
                        subtitle: "显示联盟领地边界",
                        color: .red,
                        isOn: $layerSettings.showTerritoryLayer
                    )

                    layerToggle(
                        icon: "person.2.fill",
                        title: "附近玩家",
                        subtitle: "显示5km内活跃玩家",
                        color: .green,
                        isOn: $layerSettings.showNearbyPlayers
                    )

                    layerToggle(
                        icon: "flag.fill",
                        title: "任务标记",
                        subtitle: "显示每日任务位置",
                        color: .orange,
                        isOn: $layerSettings.showTaskMarkers
                    )

                    layerToggle(
                        icon: "flame.fill",
                        title: "区域热力图",
                        subtitle: "显示像素密度分布",
                        color: .pink,
                        isOn: $layerSettings.showHeatmap
                    )

                    layerToggle(
                        icon: "exclamationmark.triangle.fill",
                        title: "战争区域",
                        subtitle: "显示领地争夺战区",
                        color: .yellow,
                        isOn: $layerSettings.showWarZones
                    )

                    layerToggle(
                        icon: "gift.fill",
                        title: "宝箱资源点",
                        subtitle: "显示宝箱刷新位置",
                        color: .cyan,
                        isOn: $layerSettings.showTreasureChests
                    )

                    layerToggle(
                        icon: "person.crop.circle.fill",
                        title: "好友位置",
                        subtitle: "显示关注的好友",
                        color: .indigo,
                        isOn: $layerSettings.showFriendLocations
                    )
                }
            }
            .frame(maxHeight: 400)
        }
        .frame(width: 280)
        .background(.ultraThinMaterial)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.15), radius: 20, y: 10)
        .padding(.bottom, 8)
    }

    private func layerToggle(
        icon: String,
        title: String,
        subtitle: String,
        color: Color,
        isOn: Binding<Bool>,
        isLocked: Bool = false
    ) -> some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 40, height: 40)

                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(color)

                if isLocked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 8))
                        .foregroundColor(.white)
                        .offset(x: 12, y: -12)
                }
            }

            // Title and subtitle
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.primary)

                    if isLocked {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                    }
                }

                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Toggle
            Toggle("", isOn: isOn)
                .labelsHidden()
                .disabled(isLocked)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(.systemBackground).opacity(0.01))
        .contentShape(Rectangle())
        .onTapGesture {
            if !isLocked {
                withAnimation {
                    isOn.wrappedValue.toggle()
                }
            }
        }
    }
}

/// Map layer settings (persisted to UserDefaults)
@MainActor
class MapLayerSettings: ObservableObject {
    static let shared = MapLayerSettings()

    @AppStorage("map.layer.pixels") var showPixelLayer = true // Locked
    @AppStorage("map.layer.territory") var showTerritoryLayer = true
    @AppStorage("map.layer.nearby_players") var showNearbyPlayers = true
    @AppStorage("map.layer.tasks") var showTaskMarkers = true
    @AppStorage("map.layer.heatmap") var showHeatmap = false
    @AppStorage("map.layer.war_zones") var showWarZones = true
    @AppStorage("map.layer.treasures") var showTreasureChests = true
    @AppStorage("map.layer.friends") var showFriendLocations = true

    private init() {}

    func resetToDefault() {
        showPixelLayer = true // Always on
        showTerritoryLayer = true
        showNearbyPlayers = true
        showTaskMarkers = true
        showHeatmap = false
        showWarZones = true
        showTreasureChests = true
        showFriendLocations = true
    }
}

// MARK: - Preview

struct MapLayerControl_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.gray.opacity(0.2).ignoresSafeArea()

            VStack {
                Spacer()
                HStack {
                    Spacer()
                    MapLayerControl()
                }
                .padding()
            }
        }
    }
}
