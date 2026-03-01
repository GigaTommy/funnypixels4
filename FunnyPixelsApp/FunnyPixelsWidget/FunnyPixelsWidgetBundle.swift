//
//  FunnyPixelsWidgetBundle.swift
//  FunnyPixelsWidget
//
//  Created by Gino Chow on 2026/2/20.
//

import WidgetKit
import SwiftUI

@main
struct FunnyPixelsWidgetBundle: WidgetBundle {
    var body: some Widget {
        // 赛事 Live Activity (领土战 - 灵动岛 + 锁屏)
        EventLiveActivity()
        // GPS Drawing Live Activity (GPS绘制后台进度 - 灵动岛 + 锁屏)
        GPSDrawingLiveActivity()
    }
}
