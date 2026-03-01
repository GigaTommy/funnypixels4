
import Foundation
import Combine
import SwiftUI

/// Cache manager for Alliance Flag Patterns
@MainActor
class FlagPatternCache: ObservableObject {
    static let shared = FlagPatternCache()
    
    @Published var patterns: [String: AllianceService.FlagPattern] = [:]
    @Published var isLoaded = false
    
    private init() {
        Task {
            await loadPatterns()
        }
    }
    
    /// Load flag patterns from API
    func loadPatterns() async {
        if isLoaded && !patterns.isEmpty {
            Logger.info("🚩 FlagPatternCache: Already loaded with \(patterns.count) patterns, skipping reload")
            return
        }

        Logger.info("🚩 FlagPatternCache: Loading flag patterns from API...")
        do {
            let categories = try await AllianceService.shared.getFlagPatterns()
            // Combine all patterns into a single dictionary
            var newPatterns: [String: AllianceService.FlagPattern] = [:]

            let allPatterns = categories.colors + categories.emojis + categories.complex
            Logger.info("🚩 FlagPatternCache: Received \(allPatterns.count) patterns (colors: \(categories.colors.count), emojis: \(categories.emojis.count), complex: \(categories.complex.count))")

            for pattern in allPatterns {
                // Use key if available and non-empty, fallback to patternId or Int ID
                let primaryKey: String
                if let key = pattern.key, !key.isEmpty {
                    primaryKey = key
                } else if let patternId = pattern.patternId, !patternId.isEmpty {
                    primaryKey = patternId
                } else {
                    primaryKey = String(pattern.id)
                }
                newPatterns[primaryKey] = pattern

                // Also index by secondary keys for better lookup coverage
                if let patternId = pattern.patternId, !patternId.isEmpty, patternId != primaryKey {
                    newPatterns[patternId] = pattern
                }
                let idStr = String(pattern.id)
                if idStr != primaryKey {
                    newPatterns[idStr] = pattern
                }

                Logger.info("🚩   Pattern ID=\(pattern.id), key=\(pattern.key ?? "nil"), patternId=\(pattern.patternId ?? "nil"), name=\(pattern.name), renderType=\(pattern.renderType ?? "nil"), cacheKey=\(primaryKey)")
            }

            self.patterns = newPatterns
            self.isLoaded = true
            Logger.info("🚩 FlagPatternCache loaded \(newPatterns.count) entries (\(allPatterns.count) unique patterns) successfully")

        } catch {
            Logger.error("❌ FlagPatternCache: Failed to load flag patterns: \(error)")
        }
    }

    /// Force reload patterns from API (clears existing cache)
    func reloadPatterns() async {
        isLoaded = false
        patterns = [:]
        await loadPatterns()
    }

    /// Get pattern by ID (searches by key, patternId, and numeric ID)
    func getPattern(for id: String?) -> AllianceService.FlagPattern? {
        guard let id = id, !id.isEmpty else {
            Logger.debug("🚩 FlagPatternCache.getPattern: id is nil or empty")
            return nil
        }

        let pattern = patterns[id]
        if pattern == nil {
            Logger.debug("🚩 FlagPatternCache.getPattern: Pattern not found for id=\(id), cache has \(patterns.count) entries")
        } else {
            Logger.debug("🚩 FlagPatternCache.getPattern: Found pattern for id=\(id), name=\(pattern!.name), renderType=\(pattern!.renderType ?? "nil")")
        }
        return pattern
    }

    /// Get emoji character for pattern ID (if it is an emoji pattern)
    func getEmoji(for id: String?) -> String? {
        guard let id = id, let pattern = patterns[id] else {
            if let id = id {
                Logger.debug("🚩 FlagPatternCache.getEmoji: Pattern not found for id=\(id)")
            }
            return nil
        }

        if pattern.renderType == "emoji" {
            Logger.debug("🚩 FlagPatternCache.getEmoji: Found emoji for id=\(id), emoji=\(pattern.unicodeChar ?? "nil")")
            return pattern.unicodeChar
        }
        Logger.debug("🚩 FlagPatternCache.getEmoji: Pattern id=\(id) is not an emoji (renderType=\(pattern.renderType ?? "nil"))")
        return nil
    }
}
