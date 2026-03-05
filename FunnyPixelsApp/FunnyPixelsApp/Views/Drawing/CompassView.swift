//
//  CompassView.swift
//  FunnyPixelsApp
//
//  Created by Claude Code
//  Copyright © 2026 FunnyPixels. All rights reserved.
//

import SwiftUI
import CoreLocation

/// 指南针视图，显示北方方向
struct CompassView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    /// 当前方向（度数，0=北，90=东，180=南，270=西）
    let heading: Double

    /// 指南针大小
    let size: CGFloat

    init(heading: Double, size: CGFloat = 120) {
        self.heading = heading
        self.size = size
    }

    var body: some View {
        ZStack {
            // 外圈
            Circle()
                .stroke(Color.white.opacity(0.3), lineWidth: 2)
                .frame(width: size, height: size)

            // 内圈
            Circle()
                .stroke(Color.white.opacity(0.5), lineWidth: 1)
                .frame(width: size * 0.85, height: size * 0.85)

            // 方位标记
            ForEach(0..<4) { index in
                directionMarker(for: index)
            }

            // 北方箭头（绿色）
            Image(systemName: "arrowtriangle.up.fill")
                .font(.system(size: size * 0.35))
                .foregroundColor(.green)
                .rotationEffect(.degrees(-heading))  // 旋转指向北方
                .animation(.easeInOut(duration: 0.3), value: heading)

            // 中心点
            Circle()
                .fill(Color.white)
                .frame(width: 8, height: 8)
        }
        .frame(width: size, height: size)
    }

    /// 方位标记（N、E、S、W）
    @ViewBuilder
    private func directionMarker(for index: Int) -> some View {
        let directions = ["N", "E", "S", "W"]
        let angles: [Double] = [0, 90, 180, 270]

        Text(directions[index])
            .font(.system(size: size * 0.15, weight: .bold, design: .rounded))
            .foregroundColor(index == 0 ? .green : .white.opacity(0.7))
            .offset(y: -size * 0.45)
            .rotationEffect(.degrees(angles[index]))
            .rotationEffect(.degrees(-heading))  // 跟随指南针旋转
            .animation(.easeInOut(duration: 0.3), value: heading)
    }
}

// MARK: - Preview

struct CompassView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 40) {
                // 指向北方
                VStack {
                    Text("Heading: 0° (North)")
                        .foregroundColor(.white)
                    CompassView(heading: 0)
                }

                // 指向东方
                VStack {
                    Text("Heading: 90° (East)")
                        .foregroundColor(.white)
                    CompassView(heading: 90)
                }

                // 指向西南方
                VStack {
                    Text("Heading: 225° (Southwest)")
                        .foregroundColor(.white)
                    CompassView(heading: 225)
                }
            }
        }
    }
}
