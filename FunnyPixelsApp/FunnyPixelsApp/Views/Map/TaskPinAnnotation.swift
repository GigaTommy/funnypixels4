import SwiftUI
import MapLibre

/// Map task pin annotation with pulse animation and progress ring
struct TaskPinAnnotation: View {
    let task: DailyTaskService.DailyTask
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // Range circle (semi-transparent)
            if let radius = task.locationRadius, task.taskCategory == "map" {
                Circle()
                    .fill(stateColor.opacity(0.15))
                    .frame(width: radiusToPoints(radius), height: radiusToPoints(radius))
            }

            // Pulse animation base (for available tasks)
            if task.state == .available {
                Circle()
                    .fill(stateColor.opacity(0.3))
                    .frame(width: 60, height: 60)
                    .scaleEffect(isPulsing ? 1.5 : 1.0)
                    .opacity(isPulsing ? 0 : 0.3)
                    .animation(
                        Animation.easeInOut(duration: 1.5).repeatForever(autoreverses: false),
                        value: isPulsing
                    )
            }

            // Main pin base
            ZStack {
                // Progress ring (for in-progress tasks)
                if task.state == .inProgress {
                    Circle()
                        .stroke(Color.white.opacity(0.3), lineWidth: 3)
                        .frame(width: 44, height: 44)

                    Circle()
                        .trim(from: 0, to: CGFloat(task.progress))
                        .stroke(stateColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .frame(width: 44, height: 44)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.5), value: task.progress)
                }

                // Pin circle background
                Circle()
                    .fill(stateColor)
                    .frame(width: 40, height: 40)
                    .shadow(color: .black.opacity(0.2), radius: 4, y: 2)

                // Task icon
                taskIcon
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
        .onAppear {
            if task.state == .available {
                isPulsing = true
            }
        }
    }

    // MARK: - Computed Properties

    private var taskIcon: some View {
        Group {
            switch task.type {
            case "draw_at_location":
                Image(systemName: "mappin.circle.fill")
            case "draw_distance":
                Image(systemName: "figure.walk")
            case "explore_regions":
                Image(systemName: "map.fill")
            case "alliance_coop":
                Image(systemName: "person.2.fill")
            case "collect_treasures":
                Image(systemName: "gift.fill")
            default:
                Image(systemName: "flag.fill")
            }
        }
    }

    private var stateColor: Color {
        switch task.state {
        case .locked:
            return Color.gray.opacity(0.5)
        case .available:
            return Color.blue
        case .inProgress:
            return Color.green
        case .completed:
            return Color.gray.opacity(0.3)
        case .claimed:
            return Color.clear // Hidden
        }
    }

    /// Convert meters to approximate points on screen (simplified)
    /// TODO: Calculate based on actual zoom level
    private func radiusToPoints(_ meters: Int) -> CGFloat {
        // Rough approximation: 1 meter ≈ 0.1 points at zoom 15
        return CGFloat(meters) * 0.1
    }
}

/// Task state enum
extension DailyTaskService.DailyTask {
    enum TaskState {
        case locked
        case available
        case inProgress
        case completed
        case claimed

        var displayName: String {
            switch self {
            case .locked: return "锁定"
            case .available: return "可用"
            case .inProgress: return "进行中"
            case .completed: return "已完成"
            case .claimed: return "已领取"
            }
        }
    }

    var state: TaskState {
        if isClaimed {
            return .claimed
        } else if isCompleted {
            return .completed
        } else if current > 0 {
            return .inProgress
        } else {
            return .available
        }
    }
}

// MARK: - Task Detail Card

/// Task detail card shown when tapping a pin
struct TaskDetailCard: View {
    let task: DailyTaskService.DailyTask
    let onNavigate: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: taskIcon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(difficultyColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(.system(size: 16, weight: .semibold))

                    if let difficulty = task.difficulty {
                        Text(difficultyText(difficulty))
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.secondary)
                }
            }

            Divider()

            // Description
            Text(task.description)
                .font(.system(size: 14))
                .foregroundColor(.secondary)

            // Location info
            if let locationName = task.locationName, let radius = task.locationRadius {
                HStack(spacing: 6) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.blue)

                    Text("\(locationName) · 半径 \(radius)米")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
            }

            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("进度")
                        .font(.system(size: 13, weight: .medium))

                    Spacer()

                    Text("\(task.current)/\(task.target)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(task.isCompleted ? .green : .primary)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                            .cornerRadius(3)

                        Rectangle()
                            .fill(task.isCompleted ? Color.green : Color.blue)
                            .frame(width: geometry.size.width * CGFloat(task.progress), height: 6)
                            .cornerRadius(3)
                            .animation(.easeInOut(duration: 0.3), value: task.progress)
                    }
                }
                .frame(height: 6)
            }

            // Reward
            HStack(spacing: 6) {
                Image(systemName: "star.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.orange)

                Text("奖励: \(task.rewardPoints) 积分")
                    .font(.system(size: 13, weight: .medium))
            }

            // Action buttons
            HStack(spacing: 12) {
                if task.locationLat != nil, task.locationLng != nil {
                    Button(action: onNavigate) {
                        HStack {
                            Image(systemName: "location.fill")
                            Text("导航")
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.blue)
                        .cornerRadius(8)
                    }
                }

                if task.state == .completed && !task.isClaimed {
                    Button(action: {
                        // Claim task
                        // TODO: Implement claim action
                    }) {
                        HStack {
                            Image(systemName: "gift.fill")
                            Text("领取奖励")
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.green)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
    }

    private var taskIcon: String {
        switch task.type {
        case "draw_at_location": return "mappin.circle.fill"
        case "draw_distance": return "figure.walk"
        case "explore_regions": return "map.fill"
        case "alliance_coop": return "person.2.fill"
        case "collect_treasures": return "gift.fill"
        default: return "flag.fill"
        }
    }

    private var difficultyColor: Color {
        guard let difficulty = task.difficulty else { return .blue }
        switch difficulty {
        case "easy": return .green
        case "normal": return .blue
        case "hard": return .red
        default: return .blue
        }
    }

    private func difficultyText(_ difficulty: String) -> String {
        switch difficulty {
        case "easy": return "简单"
        case "normal": return "中等"
        case "hard": return "困难"
        default: return difficulty
        }
    }
}

// MARK: - Preview

struct TaskPinAnnotation_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            // Different states
            TaskPinAnnotation(task: DailyTaskService.DailyTask(
                id: 1,
                type: "draw_at_location",
                title: "定点绘画",
                description: "在指定地点绘画20个像素",
                target: 20,
                current: 0,
                isCompleted: false,
                isClaimed: false,
                rewardPoints: 15,
                progress: 0,
                taskCategory: "map",
                difficulty: "easy",
                locationLat: 39.9042,
                locationLng: 116.4074,
                locationRadius: 500,
                locationName: "朝阳区"
            ))

            TaskPinAnnotation(task: DailyTaskService.DailyTask(
                id: 2,
                type: "draw_distance",
                title: "距离挑战",
                description: "GPS绘画连续500米",
                target: 500,
                current: 250,
                isCompleted: false,
                isClaimed: false,
                rewardPoints: 25,
                progress: 0.5,
                taskCategory: "map",
                difficulty: "normal",
                locationLat: nil,
                locationLng: nil,
                locationRadius: nil,
                locationName: nil
            ))

            TaskPinAnnotation(task: DailyTaskService.DailyTask(
                id: 3,
                type: "collect_treasures",
                title: "宝箱猎人",
                description: "拾取1个地图宝箱",
                target: 1,
                current: 1,
                isCompleted: true,
                isClaimed: false,
                rewardPoints: 20,
                progress: 1.0,
                taskCategory: "map",
                difficulty: "easy",
                locationLat: nil,
                locationLng: nil,
                locationRadius: nil,
                locationName: nil
            ))
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
