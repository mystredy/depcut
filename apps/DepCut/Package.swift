// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "DepCut",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "DepCut",
            targets: ["DepCut"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0")
    ],
    targets: [
        .target(
            name: "DepCutRuntime",
            resources: [
                .process("Resources/bundled-tools.json")
            ]
        ),
        .target(
            name: "DepCutUI"
        ),
        .executableTarget(
            name: "DepCut",
            dependencies: [
                "DepCutRuntime",
                "DepCutUI",
                .product(name: "Sparkle", package: "Sparkle")
            ],
            exclude: [
                "Resources/DepCut.icns",
                "Resources/DepCut-dev.icns",
                "Resources/DepCut.iconset"
            ],
            resources: [
                .copy("Resources/menu-bar-icon.png"),
                .copy("Resources/menu-bar-icon@2x.png")
            ]
        ),
        .testTarget(
            name: "DepCutRuntimeTests",
            dependencies: [
                "DepCut",
                "DepCutRuntime",
                "DepCutUI"
            ]
        )
    ]
)
