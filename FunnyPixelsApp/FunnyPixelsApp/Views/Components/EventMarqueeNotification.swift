import SwiftUI

/// 赛事活动跑马灯通知
/// 显示用户所在城市的活动，自动轮播
struct EventMarqueeNotification: View {
    let events: [EventService.Event]

    @State private var currentIndex = 0
    @State private var isExpanded = true
    @State private var showDetail = false
    @State private var timer: Timer?
    @State private var scrollOffset: CGFloat = 0
    @State private var textWidth: CGFloat = 0

    private let rotationInterval: TimeInterval = 4.0  // 每4秒切换到下一个活动
    private let scrollSpeed: TimeInterval = 0.05      // 滚动速度

    var currentEvent: EventService.Event {
        guard !events.isEmpty else {
            return EventService.previewEvent()
        }
        return events[currentIndex % events.count]
    }

    var body: some View {
        if isExpanded {
            expandedView
        } else {
            collapsedView
        }
    }

    // MARK: - Expanded View (跑马灯显示)

    private var expandedView: some View {
        HStack(spacing: 0) {
            // 主内容区域（点击查看详情）
            Button(action: {
                showDetail = true
            }) {
                HStack(spacing: 8) {
                    // 活动图标（带动画）
                    ZStack {
                        Circle()
                            .fill(statusColor.opacity(0.2))
                            .frame(width: 32, height: 32)

                        Image(systemName: eventIcon)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(statusColor)
                            .rotationEffect(.degrees(currentIndex % 2 == 0 ? 0 : 5))
                            .animation(.easeInOut(duration: 0.3), value: currentIndex)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        // 活动标题（跑马灯滚动）
                        GeometryReader { geo in
                            Text(currentEvent.title)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.primary)
                                .lineLimit(1)
                                .offset(x: shouldScroll ? scrollOffset : 0)
                                .background(
                                    GeometryReader { textGeo in
                                        Color.clear.onAppear {
                                            textWidth = textGeo.size.width
                                        }
                                    }
                                )
                        }
                        .frame(height: 16)
                        .clipped()

                        // 活动状态和时间
                        HStack(spacing: 6) {
                            // 状态标签
                            Text(statusText)
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(statusColor)
                                )

                            // 活动区域
                            if let areaName = currentEvent.config?.area?.name {
                                HStack(spacing: 2) {
                                    Image(systemName: "location.fill")
                                        .font(.system(size: 8))
                                    Text(areaName)
                                        .font(.system(size: 9))
                                }
                                .foregroundColor(.secondary)
                            }

                            Spacer()

                            // 轮播指示器
                            if events.count > 1 {
                                HStack(spacing: 3) {
                                    ForEach(0..<min(events.count, 5), id: \.self) { index in
                                        Circle()
                                            .fill(index == currentIndex % events.count ? Color.blue : Color.gray.opacity(0.3))
                                            .frame(width: 4, height: 4)
                                    }
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .buttonStyle(PlainButtonStyle())

            // 收起按钮
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded = false
                }
            }) {
                Image(systemName: "chevron.left.2")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.gray)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .frame(maxWidth: 280, minHeight: 48, maxHeight: 48, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.regularMaterial)
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 2)
        )
        .onAppear {
            startRotation()
            if shouldScroll {
                startScrolling()
            }
        }
        .onDisappear {
            stopRotation()
        }
        .onChange(of: currentIndex) { _, _ in
            resetScroll()
        }
        .sheet(isPresented: $showDetail) {
            NavigationStack {
                EventDetailView(event: currentEvent)
                    .navigationBarItems(trailing: Button(NSLocalizedString("common.close", comment: "Close")) {
                        showDetail = false
                    })
            }
        }
    }

    // MARK: - Collapsed View (小图标)

    private var collapsedView: some View {
        HStack {
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded = true
                }
            }) {
                HStack(spacing: 6) {
                    // 紧凑图标
                    ZStack {
                        Circle()
                            .fill(statusColor.opacity(0.2))
                            .frame(width: 36, height: 36)

                        Image(systemName: eventIcon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(statusColor)
                    }

                    // 展开指示器
                    Image(systemName: "chevron.right.2")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.gray)
                }
                .padding(6)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(.regularMaterial)
                        .shadow(color: .black.opacity(0.15), radius: 6, x: 0, y: 2)
                )
            }
            .buttonStyle(PlainButtonStyle())

            Spacer()  // 确保小图标始终靠左
        }
    }

    // MARK: - Helpers

    private var statusColor: Color {
        switch currentEvent.status {
        case "active": return .green
        case "published": return .blue
        case "ended": return .gray
        default: return .orange
        }
    }

    private var statusText: String {
        switch currentEvent.status {
        case "active":
            return NSLocalizedString("event.status.active", value: "In Progress", comment: "")
        case "published":
            return NSLocalizedString("event.status.published", value: "Upcoming", comment: "")
        case "ended":
            return NSLocalizedString("event.status.ended", value: "Ended", comment: "")
        default:
            return currentEvent.status.uppercased()
        }
    }

    private var eventIcon: String {
        switch currentEvent.type {
        case "territory_control": return "flag.2.crossed.fill"
        case "leaderboard": return "chart.bar.fill"
        case "cooperation": return "person.3.fill"
        case "war": return "shield.lefthalf.filled"
        default: return "megaphone.fill"
        }
    }

    private var shouldScroll: Bool {
        textWidth > 150  // 如果文字超过150px则开始滚动
    }

    // MARK: - Rotation Timer

    private func startRotation() {
        guard events.count > 1 else { return }

        timer = Timer.scheduledTimer(withTimeInterval: rotationInterval, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.4)) {
                currentIndex = (currentIndex + 1) % events.count
            }
        }
    }

    private func stopRotation() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Scrolling Animation

    private func startScrolling() {
        Timer.scheduledTimer(withTimeInterval: scrollSpeed, repeats: true) { _ in
            if scrollOffset <= -(textWidth + 20) {
                scrollOffset = 150  // 从右侧重新开始
            } else {
                scrollOffset -= 1
            }
        }
    }

    private func resetScroll() {
        scrollOffset = 0
    }
}

// MARK: - Preview

#Preview("Multiple Events") {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        VStack {
            HStack {
                EventMarqueeNotification(events: [
                    EventService.Event(
                        id: "1",
                        title: "广工区庄像素大战 - 2024春季赛",
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
                                name: "广东工业大学"
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
                    EventService.Event(
                        id: "2",
                        title: "厦门大学思明校区像素挑战赛",
                        type: "leaderboard",
                        status: "published",
                        startTime: "2026-02-25T00:00:00Z",
                        endTime: "2026-03-05T00:00:00Z",
                        bannerUrl: nil,
                        boundary: nil,
                        config: EventService.EventConfig(
                            area: EventService.EventArea(
                                type: "circle",
                                center: EventService.EventCenter(lat: 24.4439, lng: 118.0655),
                                radius: 1000,
                                name: "厦门大学"
                            ),
                            areaSize: nil,
                            requirements: nil,
                            rules: nil,
                            rewards: nil,
                            rewardsConfig: nil
                        ),
                        gameplay: nil,
                        isParticipant: false
                    )
                ])
                .padding(.leading, 16)

                Spacer()
            }
            Spacer()
        }
        .padding(.top, 8)
    }
}

#Preview("Single Event") {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        VStack {
            HStack {
                EventMarqueeNotification(events: [
                    EventService.previewEvent()
                ])
                .padding(.leading, 16)

                Spacer()
            }
            Spacer()
        }
        .padding(.top, 8)
    }
}
