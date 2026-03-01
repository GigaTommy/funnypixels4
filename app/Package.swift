// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "FunnyPixels",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v16),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "FunnyPixels",
            targets: ["FunnyPixels"]
        ),
        .executable(
            name: "FunnyPixelsApp",
            targets: ["FunnyPixelsApp"]
        ),
    ],
    dependencies: [
        // 网络请求
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),

        // 实时通信
        .package(url: "https://github.com/socketio/socket.io-client-swift.git", from: "16.0.1"),

        // 数据持久化
        .package(url: "https://github.com/realm/realm-swift.git", from: "10.42.0"),

        // 图像处理
        .package(url: "https://github.com/onevcat/Kingfisher.git", from: "7.9.0"),

        // 键值存储
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.2"),

        // 依赖注入
        .package(url: "https://github.com/pointfreeco/swift-dependencies.git", from: "1.0.0"),

        // 日志记录
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.3"),

        // 状态管理 - 使用特定版本
        .package(url: "https://github.com/pointfreeco/swift-composable-architecture.git", exact: "1.16.0"),

        // 地图渲染 - MapLibre Native
        .package(url: "https://github.com/maplibre/maplibre-gl-native-distribution.git", from: "6.0.0"),

        // 测试依赖
        .package(url: "https://github.com/Quick/Quick.git", from: "7.0.0"),
        .package(url: "https://github.com/Quick/Nimble.git", from: "9.0.0"),
    ],
    targets: [
        .target(
            name: "FunnyPixels",
            dependencies: [
                .product(name: "Alamofire", package: "Alamofire"),
                .product(name: "SocketIO", package: "socket.io-client-swift"),
                .product(name: "RealmSwift", package: "realm-swift"),
                .product(name: "Kingfisher", package: "Kingfisher"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "Dependencies", package: "swift-dependencies"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
                .product(name: "MapLibre", package: "maplibre-gl-native-distribution"),
            ],
            path: "FunnyPixels/Sources/FunnyPixels",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
                .enableUpcomingFeature("ExistentialAny"),
                .enableUpcomingFeature("InferSendableFromCaptures"),
            ]
        ),
        .executableTarget(
            name: "FunnyPixelsApp",
            dependencies: [
                "FunnyPixels"
            ],
            path: "FunnyPixels/Sources/FunnyPixelsApp",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
                .enableUpcomingFeature("ExistentialAny"),
                .enableUpcomingFeature("InferSendableFromCaptures"),
            ]
        ),
        .testTarget(
            name: "FunnyPixelsTests",
            dependencies: [
                "FunnyPixels",
                .product(name: "Quick", package: "Quick"),
                .product(name: "Nimble", package: "Nimble"),
            ],
            path: "FunnyPixels/Tests/FunnyPixelsTests"
        ),
    ]
)