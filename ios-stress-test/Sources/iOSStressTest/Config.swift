import Foundation

struct StressTestConfig {
    let baseURL: String
    let concurrentUsers: Int
    let durationSeconds: Int
    let scenario: Scenario

    enum Scenario {
        case smoke      // 5 users, 30s
        case medium     // 50 users, 5min
        case full       // 100 users, 10min
        case custom(users: Int, duration: Int)

        var userCount: Int {
            switch self {
            case .smoke: return 5
            case .medium: return 50
            case .full: return 100
            case .custom(let users, _): return users
            }
        }

        var duration: Int {
            switch self {
            case .smoke: return 30
            case .medium: return 300
            case .full: return 600
            case .custom(_, let duration): return duration
            }
        }
    }

    static func parse(from args: [String]) -> StressTestConfig {
        var baseURL = "http://localhost:3001"
        var scenario = Scenario.smoke

        var i = 0
        while i < args.count {
            switch args[i] {
            case "--url":
                if i + 1 < args.count {
                    baseURL = args[i + 1]
                    i += 1
                }
            case "--scenario":
                if i + 1 < args.count {
                    switch args[i + 1] {
                    case "smoke": scenario = .smoke
                    case "medium": scenario = .medium
                    case "full": scenario = .full
                    default: break
                    }
                    i += 1
                }
            case "--users":
                if i + 1 < args.count, let users = Int(args[i + 1]) {
                    if case .custom(_, let duration) = scenario {
                        scenario = .custom(users: users, duration: duration)
                    } else {
                        scenario = .custom(users: users, duration: 300)
                    }
                    i += 1
                }
            case "--duration":
                if i + 1 < args.count, let duration = Int(args[i + 1]) {
                    if case .custom(let users, _) = scenario {
                        scenario = .custom(users: users, duration: duration)
                    } else {
                        scenario = .custom(users: 50, duration: duration)
                    }
                    i += 1
                }
            default:
                break
            }
            i += 1
        }

        return StressTestConfig(
            baseURL: baseURL,
            concurrentUsers: scenario.userCount,
            durationSeconds: scenario.duration,
            scenario: scenario
        )
    }
}
