import Foundation

actor MetricsCollector {
    private(set) var drawSuccess = 0
    private(set) var drawFailure = 0
    private(set) var drawConflict = 0
    private(set) var drawFrozen = 0
    private(set) var drawNoPoints = 0
    private(set) var drawUnauthorized = 0
    private(set) var drawErrorDetails: [String: Int] = [:]
    private(set) var drawLatencies: [TimeInterval] = []

    private(set) var readSuccess = 0
    private(set) var readFailure = 0
    private(set) var readLatencies: [TimeInterval] = []

    private(set) var mvtSuccess = 0
    private(set) var mvtFailure = 0
    private(set) var mvtLatencies: [TimeInterval] = []

    private(set) var leaderboardSuccess = 0
    private(set) var leaderboardFailure = 0
    private(set) var leaderboardLatencies: [TimeInterval] = []

    private(set) var authMeSuccess = 0
    private(set) var authMeFailure = 0
    private(set) var authMeLatencies: [TimeInterval] = []

    func recordDrawSuccess(latency: TimeInterval) {
        drawSuccess += 1
        drawLatencies.append(latency)
    }

    func recordDrawResult(_ result: DrawPixelResult, latency: TimeInterval) {
        drawLatencies.append(latency)
        switch result {
        case .success:
            drawSuccess += 1
        case .conflict:
            drawConflict += 1
        case .frozen:
            drawFrozen += 1
        case .noPoints:
            drawNoPoints += 1
        case .unauthorized:
            drawUnauthorized += 1
        case .error(let message, let code):
            drawFailure += 1
            let key = "[\(code ?? 0)] \(message.prefix(60))"
            drawErrorDetails[key, default: 0] += 1
        }
    }

    func recordDrawFailure(latency: TimeInterval) {
        drawFailure += 1
        drawLatencies.append(latency)
    }

    func recordMVTSuccess(latency: TimeInterval) {
        mvtSuccess += 1
        mvtLatencies.append(latency)
    }

    func recordMVTFailure(latency: TimeInterval) {
        mvtFailure += 1
        mvtLatencies.append(latency)
    }

    func recordLeaderboardSuccess(latency: TimeInterval) {
        leaderboardSuccess += 1
        leaderboardLatencies.append(latency)
    }

    func recordLeaderboardFailure(latency: TimeInterval) {
        leaderboardFailure += 1
        leaderboardLatencies.append(latency)
    }

    func recordAuthMeSuccess(latency: TimeInterval) {
        authMeSuccess += 1
        authMeLatencies.append(latency)
    }

    func recordAuthMeFailure(latency: TimeInterval) {
        authMeFailure += 1
        authMeLatencies.append(latency)
    }

    func getReport() -> StressTestReport {
        return StressTestReport(
            drawSuccess: drawSuccess,
            drawFailure: drawFailure,
            drawConflict: drawConflict,
            drawFrozen: drawFrozen,
            drawNoPoints: drawNoPoints,
            drawUnauthorized: drawUnauthorized,
            drawErrorDetails: drawErrorDetails,
            drawLatencies: drawLatencies,
            mvtSuccess: mvtSuccess,
            mvtFailure: mvtFailure,
            mvtLatencies: mvtLatencies,
            leaderboardSuccess: leaderboardSuccess,
            leaderboardFailure: leaderboardFailure,
            leaderboardLatencies: leaderboardLatencies,
            authMeSuccess: authMeSuccess,
            authMeFailure: authMeFailure,
            authMeLatencies: authMeLatencies
        )
    }
}

struct StressTestReport {
    let drawSuccess: Int
    let drawFailure: Int
    let drawConflict: Int
    let drawFrozen: Int
    let drawNoPoints: Int
    let drawUnauthorized: Int
    let drawErrorDetails: [String: Int]
    let drawLatencies: [TimeInterval]

    let mvtSuccess: Int
    let mvtFailure: Int
    let mvtLatencies: [TimeInterval]

    let leaderboardSuccess: Int
    let leaderboardFailure: Int
    let leaderboardLatencies: [TimeInterval]

    let authMeSuccess: Int
    let authMeFailure: Int
    let authMeLatencies: [TimeInterval]

    var drawTotal: Int { drawSuccess + drawFailure + drawConflict + drawFrozen + drawNoPoints + drawUnauthorized }
    var readTotal: Int { mvtSuccess + mvtFailure + leaderboardSuccess + leaderboardFailure + authMeSuccess + authMeFailure }

    func percentile(_ p: Double, from latencies: [TimeInterval]) -> TimeInterval {
        guard !latencies.isEmpty else { return 0 }
        let sorted = latencies.sorted()
        let index = Int(Double(sorted.count) * p)
        return sorted[min(index, sorted.count - 1)]
    }

    func average(_ latencies: [TimeInterval]) -> TimeInterval {
        guard !latencies.isEmpty else { return 0 }
        return latencies.reduce(0, +) / Double(latencies.count)
    }

    func printReport(duration: TimeInterval) {
        print("\n================================================================")
        print("  iOS STRESS TEST - RESULTS")
        print("================================================================\n")

        print("--- DURATION ---")
        print(String(format: "  Test Duration: %.1fs", duration))
        print("")

        print("--- WRITE METRICS (Draw Pixel) ---")
        print("  Total:        \(drawTotal)")
        print("  Success:      \(drawSuccess)")
        print("  Conflict:     \(drawConflict)")
        print("  Frozen:       \(drawFrozen)")
        print("  No Points:    \(drawNoPoints)")
        print("  Unauthorized: \(drawUnauthorized)")
        print("  Failure:      \(drawFailure)")
        if !drawLatencies.isEmpty {
            print(String(format: "  Success Rate: %.2f%%", Double(drawSuccess) / Double(drawTotal) * 100))
            print(String(format: "  Latency Avg:  %.1fms", average(drawLatencies) * 1000))
            print(String(format: "  Latency P50:  %.1fms", percentile(0.50, from: drawLatencies) * 1000))
            print(String(format: "  Latency P95:  %.1fms", percentile(0.95, from: drawLatencies) * 1000))
            print(String(format: "  Latency P99:  %.1fms", percentile(0.99, from: drawLatencies) * 1000))
            print(String(format: "  RPS:          %.1f", Double(drawTotal) / duration))
        }

        // Print top 5 error details if any
        if !drawErrorDetails.isEmpty {
            print("")
            print("  Top Failure Reasons:")
            for (error, count) in drawErrorDetails.sorted(by: { $0.value > $1.value }).prefix(5) {
                print(String(format: "    - %@ (%d occurrences)", error, count))
            }
        }
        print("")

        print("--- READ METRICS ---")
        print("  Total Reads:  \(readTotal)")
        print("")

        if !mvtLatencies.isEmpty {
            print("  MVT Tile:")
            print("    Success:    \(mvtSuccess)")
            print("    Failure:    \(mvtFailure)")
            print(String(format: "    Avg:        %.1fms", average(mvtLatencies) * 1000))
            print(String(format: "    P95:        %.1fms", percentile(0.95, from: mvtLatencies) * 1000))
            print("")
        }

        if !leaderboardLatencies.isEmpty {
            print("  Leaderboard:")
            print("    Success:    \(leaderboardSuccess)")
            print("    Failure:    \(leaderboardFailure)")
            print(String(format: "    Avg:        %.1fms", average(leaderboardLatencies) * 1000))
            print(String(format: "    P95:        %.1fms", percentile(0.95, from: leaderboardLatencies) * 1000))
            print("")
        }

        if !authMeLatencies.isEmpty {
            print("  Auth/me:")
            print("    Success:    \(authMeSuccess)")
            print("    Failure:    \(authMeFailure)")
            print(String(format: "    Avg:        %.1fms", average(authMeLatencies) * 1000))
            print(String(format: "    P95:        %.1fms", percentile(0.95, from: authMeLatencies) * 1000))
            print("")
        }

        let totalRequests = drawTotal + readTotal
        let totalRPS = Double(totalRequests) / duration
        print("--- GLOBAL ---")
        print("  Total Requests: \(totalRequests)")
        print(String(format: "  Total RPS:      %.1f", totalRPS))
        print("")

        print("================================================================\n")
    }
}

class StressTestRunner {
    let config: StressTestConfig
    let metrics = MetricsCollector()

    init(config: StressTestConfig) {
        self.config = config
    }

    func run() async {
        print("========================================")
        print("  iOS API Stress Test - Starting")
        print("========================================")
        print("Base URL:    \(config.baseURL)")
        print("Users:       \(config.concurrentUsers)")
        print("Duration:    \(config.durationSeconds)s")
        print("Scenario:    \(config.scenario)")
        print("")

        let startTime = Date()

        // Load test users from file
        guard let testUsers = loadTestUsers() else {
            print("❌ Failed to load test users from ops/loadtest/data/test-users.json")
            print("   Run /stress-test-prepare first to generate test users")
            return
        }

        print("✅ Loaded \(testUsers.count) test users")
        print("")

        // Verify test users exist
        print("Verifying test users exist in database...")
        let verificationPassed = await verifyTestUsersExist(testUsers: testUsers)
        if !verificationPassed {
            print("")
            print("❌ CRITICAL: Test users validation failed!")
            print("   Please run one of the following:")
            print("   1. /stress-test-prepare (will reset DB and create users)")
            print("   2. Manually create users with sufficient pixel points (1000+)")
            print("")
            return
        }
        print("✅ Test users validated")
        print("")

        // Login users and run test
        print("Logging in \(config.concurrentUsers) users...")
        var tasks: [Task<Void, Never>] = []

        for i in 0..<config.concurrentUsers {
            let user = testUsers[i % testUsers.count]
            let task = Task {
                await self.runUserSession(email: user.email, password: user.password, duration: config.durationSeconds)
            }
            tasks.append(task)
        }

        // Wait for all tasks
        for task in tasks {
            await task.value
        }

        let endTime = Date()
        let duration = endTime.timeIntervalSince(startTime)

        // Print report
        let report = await metrics.getReport()
        report.printReport(duration: duration)
    }

    private func runUserSession(email: String, password: String, duration: Int) async {
        let client = APIClient(baseURL: config.baseURL)

        // Login
        do {
            _ = try await client.login(email: email, password: password)
        } catch {
            print("❌ Login failed for \(email): \(error)")
            return
        }

        let endTime = Date().addingTimeInterval(TimeInterval(duration))

        while Date() < endTime {
            // Mixed scenario: 30% draw, 40% MVT, 20% leaderboard, 10% auth/me
            let action = Int.random(in: 0..<100)

            if action < 30 {
                // Draw pixel
                await drawPixel(client: client)
            } else if action < 70 {
                // Load MVT tile
                await loadMVTTile(client: client)
            } else if action < 90 {
                // Get leaderboard
                await getLeaderboard(client: client)
            } else {
                // Get auth/me
                await getAuthMe(client: client)
            }

            // Random delay 0.5-2s
            try? await Task.sleep(nanoseconds: UInt64.random(in: 500_000_000...2_000_000_000))
        }
    }

    private func drawPixel(client: APIClient) async {
        let lat = Double.random(in: 39.9...40.0)
        let lon = Double.random(in: 116.3...116.4)

        let start = Date()
        do {
            let result = try await client.drawPixel(latitude: lat, longitude: lon)
            let latency = Date().timeIntervalSince(start)
            await metrics.recordDrawResult(result, latency: latency)
        } catch {
            let latency = Date().timeIntervalSince(start)
            await metrics.recordDrawFailure(latency: latency)
        }
    }

    private func loadMVTTile(client: APIClient) async {
        let zoom = 15
        let x = Int.random(in: 26900...26910)
        let y = Int.random(in: 19700...19710)

        let start = Date()
        do {
            _ = try await client.getMVTTile(zoom: zoom, x: x, y: y)
            let latency = Date().timeIntervalSince(start)
            await metrics.recordMVTSuccess(latency: latency)
        } catch {
            let latency = Date().timeIntervalSince(start)
            await metrics.recordMVTFailure(latency: latency)
        }
    }

    private func getLeaderboard(client: APIClient) async {
        let start = Date()
        do {
            _ = try await client.getPersonalLeaderboard(page: 1)
            let latency = Date().timeIntervalSince(start)
            await metrics.recordLeaderboardSuccess(latency: latency)
        } catch {
            let latency = Date().timeIntervalSince(start)
            await metrics.recordLeaderboardFailure(latency: latency)
        }
    }

    private func getAuthMe(client: APIClient) async {
        let start = Date()
        do {
            _ = try await client.getAuthMe()
            let latency = Date().timeIntervalSince(start)
            await metrics.recordAuthMeSuccess(latency: latency)
        } catch {
            let latency = Date().timeIntervalSince(start)
            await metrics.recordAuthMeFailure(latency: latency)
        }
    }

    private func verifyTestUsersExist(testUsers: [TestUser]) async -> Bool {
        // Try to login the first user to verify they exist
        let firstUser = testUsers[0]
        let client = APIClient(baseURL: config.baseURL)

        do {
            _ = try await client.login(email: firstUser.email, password: firstUser.password)
            return true
        } catch {
            print("   Login failed for \(firstUser.email): \(error)")
            return false
        }
    }

    private func loadTestUsers() -> [TestUser]? {
        // Try multiple possible paths
        let possiblePaths = [
            "../ops/loadtest/data/test-users.json",
            "ops/loadtest/data/test-users.json",
            "../../ops/loadtest/data/test-users.json",
            FileManager.default.currentDirectoryPath + "/ops/loadtest/data/test-users.json",
            FileManager.default.currentDirectoryPath + "/../ops/loadtest/data/test-users.json"
        ]

        for path in possiblePaths {
            let fileURL = URL(fileURLWithPath: path)
            if let data = try? Data(contentsOf: fileURL),
               let users = try? JSONDecoder().decode([TestUser].self, from: data) {
                print("✅ Found test users at: \(path)")
                return users
            }
        }

        print("❌ Could not find test-users.json. Tried:")
        for path in possiblePaths {
            print("   - \(path)")
        }
        return nil
    }
}

struct TestUser: Codable {
    let id: String
    let email: String
    let username: String
    let password: String

    enum CodingKeys: String, CodingKey {
        case id, email, username, password
    }
}
