import SwiftUI

// MARK: - Alliance Level Badge

struct AllianceLevelBadge: View {
    let level: Int
    let levelName: String?

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: iconForLevel(level))
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.white)

            Text("Lv.\(level)")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.white)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            LinearGradient(
                colors: gradientColorsForLevel(level),
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(Capsule())
    }

    private func iconForLevel(_ level: Int) -> String {
        switch level {
        case 1: return "shield"
        case 2: return "shield.fill"
        case 3: return "shield.lefthalf.filled"
        case 4: return "shield.checkered"
        case 5: return "star.shield"
        case 6: return "star.shield.fill"
        case 7: return "crown"
        case 8: return "crown.fill"
        case 9: return "sparkles"
        case 10: return "sun.max.fill"
        default: return "shield"
        }
    }

    private func gradientColorsForLevel(_ level: Int) -> [Color] {
        switch level {
        case 1: return [.gray, .gray.opacity(0.7)]
        case 2: return [.green, .green.opacity(0.7)]
        case 3: return [.teal, .cyan]
        case 4: return [.blue, .blue.opacity(0.7)]
        case 5: return [.purple, .indigo]
        case 6: return [.orange, .red]
        case 7: return [.yellow, .orange]
        case 8: return [.red, .pink]
        case 9: return [.indigo, .purple]
        case 10: return [.yellow, .red]
        default: return [.gray, .gray.opacity(0.7)]
        }
    }
}

// MARK: - Alliance Level Progress Bar

struct AllianceLevelProgressBar: View {
    let experience: Int
    let nextLevelExp: Int
    let progress: Double
    let level: Int
    let isMaxLevel: Bool

    var body: some View {
        VStack(spacing: 6) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Background track
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.systemGray5))
                        .frame(height: 8)

                    // Fill
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: progressColors(for: level),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, geo.size.width * CGFloat(progress)), height: 8)
                }
            }
            .frame(height: 8)

            // Labels
            HStack {
                Text(formatExp(experience))
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                Spacer()
                if isMaxLevel {
                    Text("MAX")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.orange)
                } else {
                    Text(formatExp(nextLevelExp))
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func formatExp(_ exp: Int) -> String {
        if exp >= 10000 {
            return String(format: "%.1fK", Double(exp) / 1000.0)
        }
        return "\(exp)"
    }

    private func progressColors(for level: Int) -> [Color] {
        switch level {
        case 1: return [.gray, .gray.opacity(0.7)]
        case 2: return [.green, .green.opacity(0.7)]
        case 3: return [.teal, .cyan]
        case 4: return [.blue, .blue.opacity(0.7)]
        case 5: return [.purple, .indigo]
        case 6: return [.orange, .red]
        case 7: return [.yellow, .orange]
        case 8: return [.red, .pink]
        case 9: return [.indigo, .purple]
        case 10: return [.yellow, .red]
        default: return [.gray, .gray.opacity(0.7)]
        }
    }
}

// MARK: - Alliance Level Card (combined view)

struct AllianceLevelCard: View {
    let alliance: AllianceService.Alliance

    var body: some View {
        let level = alliance.level ?? 1
        let experience = alliance.experience ?? 0
        let nextLevelExp = alliance.nextLevelExp ?? 1000
        let progress = alliance.levelProgress ?? 0.0
        let isMaxLevel = alliance.isMaxLevel ?? false
        let levelName = alliance.levelNameEn ?? "Newcomer"

        VStack(spacing: 10) {
            HStack {
                AllianceLevelBadge(level: level, levelName: levelName)

                Text(levelName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                Text("\(Int(progress * 100))%")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)
            }

            AllianceLevelProgressBar(
                experience: experience,
                nextLevelExp: nextLevelExp,
                progress: progress,
                level: level,
                isMaxLevel: isMaxLevel
            )
        }
        .padding(12)
        .background(Color(.systemGray6).opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
