// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "iOSStressTest",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
    ],
    targets: [
        .executableTarget(
            name: "iOSStressTest",
            dependencies: [
                .product(name: "Alamofire", package: "Alamofire"),
            ],
            path: "Sources/iOSStressTest"
        )
    ]
)
