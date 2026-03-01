import Foundation

// Show help
if CommandLine.arguments.contains("--help") || CommandLine.arguments.contains("-h") {
    printHelp()
    exit(0)
}

// Parse config
let config = StressTestConfig.parse(from: Array(CommandLine.arguments.dropFirst()))

// Run stress test
let runner = StressTestRunner(config: config)
await runner.run()

func printHelp() {
    print("""
        iOS API Stress Test Tool

        USAGE:
            swift run iOSStressTest [OPTIONS]

        OPTIONS:
            --url <URL>          Base URL (default: http://localhost:3001)
            --scenario <TYPE>    Scenario type: smoke, medium, full (default: smoke)
            --users <N>          Number of concurrent users (overrides scenario)
            --duration <SEC>     Test duration in seconds (overrides scenario)
            -h, --help           Show this help message

        SCENARIOS:
            smoke    5 users, 30 seconds
            medium   50 users, 5 minutes
            full     100 users, 10 minutes

        EXAMPLES:
            # Run smoke test (default)
            swift run iOSStressTest

            # Run full test
            swift run iOSStressTest --scenario full

            # Custom: 20 users for 2 minutes
            swift run iOSStressTest --users 20 --duration 120

            # Test against remote server
            swift run iOSStressTest --url https://api.example.com --scenario medium

        REQUIREMENTS:
            - Test users must exist in ../ops/loadtest/data/test-users.json
            - Run /stress-test-prepare first to generate test users
            - Backend must be running and accessible
        """)
}
