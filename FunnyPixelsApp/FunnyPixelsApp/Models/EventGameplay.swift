import Foundation

// MARK: - P0-2: Event Gameplay Template Models

/// 活动玩法模板
struct EventGameplay: Codable {
    let objective: LocalizedText
    let scoringRules: LocalizedTextArray
    let tips: LocalizedTextArray
    let difficulty: EventDifficulty

    // Legacy fields - kept for backward compatibility
    let timeCommitment: String?
    let recommendedFor: [String]?

    enum CodingKeys: String, CodingKey {
        case objective, scoringRules, tips, difficulty, timeCommitment, recommendedFor
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        objective = try container.decode(LocalizedText.self, forKey: .objective)
        scoringRules = try container.decode(LocalizedTextArray.self, forKey: .scoringRules)
        tips = try container.decode(LocalizedTextArray.self, forKey: .tips)

        // P2-2: Handle both old string format and new object format for difficulty
        if let difficultyObj = try? container.decode(EventDifficulty.self, forKey: .difficulty) {
            difficulty = difficultyObj
        } else if let difficultyStr = try? container.decode(String.self, forKey: .difficulty) {
            // Convert old string format to new object format
            difficulty = EventDifficulty.fromLegacyString(difficultyStr)
        } else {
            difficulty = EventDifficulty(level: 3, factors: EventDifficultyFactors(competition: 3, timeCommitment: 3, skillRequired: 3), estimatedTimePerDay: 120, recommendedFor: ["active_players"])
        }

        timeCommitment = try? container.decodeIfPresent(String.self, forKey: .timeCommitment)
        recommendedFor = try? container.decodeIfPresent([String].self, forKey: .recommendedFor)
    }
}

/// P2-2: 活动难度评级
struct EventDifficulty: Codable {
    let level: Int // 1-5 stars
    let factors: EventDifficultyFactors
    let estimatedTimePerDay: Int // minutes
    let recommendedFor: [String]

    enum CodingKeys: String, CodingKey {
        case level, factors, estimatedTimePerDay, recommendedFor
    }

    /// Convert legacy string difficulty to new format
    static func fromLegacyString(_ str: String) -> EventDifficulty {
        switch str.lowercased() {
        case "easy":
            return EventDifficulty(
                level: 2,
                factors: EventDifficultyFactors(competition: 2, timeCommitment: 2, skillRequired: 1),
                estimatedTimePerDay: 90,
                recommendedFor: ["beginners", "casual_players"]
            )
        case "hard":
            return EventDifficulty(
                level: 5,
                factors: EventDifficultyFactors(competition: 5, timeCommitment: 4, skillRequired: 4),
                estimatedTimePerDay: 210,
                recommendedFor: ["experienced_players", "competitive_alliances"]
            )
        default: // medium
            return EventDifficulty(
                level: 3,
                factors: EventDifficultyFactors(competition: 3, timeCommitment: 3, skillRequired: 3),
                estimatedTimePerDay: 150,
                recommendedFor: ["active_players", "alliances"]
            )
        }
    }
}

/// 难度评级因素
struct EventDifficultyFactors: Codable {
    let competition: Int // 1-5
    let timeCommitment: Int // 1-5
    let skillRequired: Int // 1-5
}

/// 多语言文本
struct LocalizedText: Codable {
    let en: String
    let zh: String
    let ja: String

    enum CodingKeys: String, CodingKey {
        case en, zh, ja
    }

    /// 根据当前语言环境返回本地化文本
    func localized() -> String {
        let languageCode = Locale.current.language.languageCode?.identifier ?? "en"
        switch languageCode {
        case "zh":
            return zh
        case "ja":
            return ja
        default:
            return en
        }
    }
}

/// 多语言文本数组
struct LocalizedTextArray: Codable {
    let en: [String]
    let zh: [String]
    let ja: [String]

    enum CodingKeys: String, CodingKey {
        case en, zh, ja
    }

    /// 根据当前语言环境返回本地化文本数组
    func localized() -> [String] {
        let languageCode = Locale.current.language.languageCode?.identifier ?? "en"
        switch languageCode {
        case "zh":
            return zh
        case "ja":
            return ja
        default:
            return en
        }
    }
}
