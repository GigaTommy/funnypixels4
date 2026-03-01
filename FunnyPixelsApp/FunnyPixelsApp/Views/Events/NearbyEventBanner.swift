import SwiftUI
import CoreLocation

/// 附近活动横幅 - 当用户在活动区域内或附近时显示
struct NearbyEventBanner: View {
    let event: EventService.Event
    let distance: Double // 距离活动中心的距离（米）
    let onTap: () -> Void

    @ObservedObject private var fontManager = FontSizeManager.shared
    @State private var isExpanded: Bool = true

    private var isInside: Bool {
        guard let config = event.config,
              let area = config.area,
              let radius = area.radius else {
            return false
        }
        return distance <= Double(radius)
    }

    private var distanceText: String {
        if isInside {
            return NSLocalizedString("event.nearby.inside", comment: "You are inside the event area!")
        } else {
            let km = distance / 1000.0
            if km < 1.0 {
                return String(format: NSLocalizedString("event.nearby.meters", comment: "%.0fm away"), distance)
            } else {
                return String(format: NSLocalizedString("event.nearby.km", comment: "%.1fkm away"), km)
            }
        }
    }

    var body: some View {
        if isExpanded {
            expandedView
        } else {
            collapsedView
        }
    }

    // MARK: - Expanded View (Full Information)

    private var expandedView: some View {
        HStack(spacing: 0) {
            // Main content button
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // 图标
                    ZStack {
                        Circle()
                            .fill(isInside ? Color.green : Color.blue)
                            .frame(width: 40, height: 40)

                        Image(systemName: isInside ? "location.fill" : "location.circle.fill")
                            .font(fontManager.scaledFont(.title3))
                            .foregroundColor(.white)
                    }

                    // 活动信息
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: "flag.fill")
                                .font(fontManager.scaledFont(.caption2))
                                .foregroundColor(isInside ? .green : .blue)

                            Text(event.title)
                                .font(fontManager.scaledFont(.subheadline).bold())
                                .foregroundColor(AppColors.textPrimary)
                                .lineLimit(1)
                        }

                        HStack(spacing: 8) {
                            Text(distanceText)
                                .font(fontManager.scaledFont(.caption))
                                .foregroundColor(AppColors.textSecondary)

                            if event.status == "published" || event.status == "active" {
                                Text(event.status.uppercased())
                                    .font(fontManager.scaledFont(.caption2).bold())
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(event.status == "active" ? Color.green : Color.blue)
                                    .cornerRadius(4)
                            }
                        }
                    }

                    Spacer()

                    // 箭头
                    Image(systemName: "chevron.right")
                        .font(fontManager.scaledFont(.caption))
                        .foregroundColor(AppColors.textSecondary)
                }
                .padding(.leading, 16)
                .padding(.vertical, 12)
            }
            .buttonStyle(PlainButtonStyle())

            // Collapse button
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded = false
                }
            }) {
                VStack {
                    Spacer()
                    Image(systemName: "chevron.left.2")
                        .font(fontManager.scaledFont(.caption2))
                        .foregroundColor(.gray)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 12)
                    Spacer()
                }
            }
            .buttonStyle(PlainButtonStyle())
        }
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppColors.surfaceSecondary)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
    }

    // MARK: - Collapsed View (Minimal Badge)

    private var collapsedView: some View {
        Button(action: {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded = true
            }
        }) {
            HStack(spacing: 8) {
                // Compact icon
                ZStack {
                    Circle()
                        .fill(isInside ? Color.green : Color.blue)
                        .frame(width: 36, height: 36)

                    Image(systemName: isInside ? "location.fill" : "location.circle.fill")
                        .font(fontManager.scaledFont(.body))
                        .foregroundColor(.white)
                }

                // Expand indicator
                Image(systemName: "chevron.right.2")
                    .font(fontManager.scaledFont(.caption2))
                    .foregroundColor(.gray)
            }
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(AppColors.surfaceSecondary)
                    .shadow(color: .black.opacity(0.1), radius: 6, x: 0, y: 3)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// 预览
#if DEBUG
struct NearbyEventBanner_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            // 活动区域内
            NearbyEventBanner(
                event: EventService.Event(
                    id: "1",
                    title: "广工区庄像素大战",
                    type: "territory_control",
                    status: "active",
                    startTime: "2026-02-23T00:00:00Z",
                    endTime: "2026-03-02T00:00:00Z",
                    bannerUrl: nil,
                    boundary: nil,
                    config: EventService.EventConfig(
                        area: EventService.EventArea(
                            type: "circle",
                            center: EventService.EventCenter(lat: 23.1489, lng: 113.3376),
                            radius: 800,
                            name: "广东工大"
                        ),
                        areaSize: nil,
                        requirements: nil,
                        rules: nil,
                        rewards: nil,
                        rewardsConfig: nil
                    ),
                    gameplay: nil,
                    isParticipant: false
                ),
                distance: 300, // 300米 - 区域内
                onTap: {}
            )

            // 活动区域外
            NearbyEventBanner(
                event: EventService.Event(
                    id: "1",
                    title: "广工区庄像素大战",
                    type: "territory_control",
                    status: "published",
                    startTime: "2026-02-23T00:00:00Z",
                    endTime: "2026-03-02T00:00:00Z",
                    bannerUrl: nil,
                    boundary: nil,
                    config: EventService.EventConfig(
                        area: EventService.EventArea(
                            type: "circle",
                            center: EventService.EventCenter(lat: 23.1489, lng: 113.3376),
                            radius: 800,
                            name: "广东工大"
                        ),
                        areaSize: nil,
                        requirements: nil,
                        rules: nil,
                        rewards: nil,
                        rewardsConfig: nil
                    ),
                    gameplay: nil,
                    isParticipant: false
                ),
                distance: 1200, // 1.2公里 - 区域外
                onTap: {}
            )
        }
        .padding()
        .background(Color.gray.opacity(0.1))
    }
}
#endif
